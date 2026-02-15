<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\RefundItem;
use App\Models\Sale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RefundController extends Controller
{
    /**
     * List all refunds
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $query = Refund::with(['sale', 'items.productVariant.product', 'processedBy'])
            ->orderBy('created_at', 'desc');

        if ($dateFrom) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $refunds = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $refunds,
        ]);
    }

    /**
     * Show refund details for a sale
     */
    public function show(Sale $sale): JsonResponse
    {
        $sale->load([
            'items.productVariant.product',
            'refunds.items.productVariant.product',
            'refunds.processedBy',
        ]);

        // Calculate refundable quantities
        $refundableItems = $sale->items->map(function ($item) use ($sale) {
            $refundedQty = $sale->refunds->flatMap->items
                ->where('sale_item_id', $item->id)
                ->sum('quantity');
            $canceledQty = (float) ($item->canceled_quantity ?? 0);
            $refundableQty = max(0, ((float) $item->quantity) - ((float) $refundedQty) - $canceledQty);

            return [
                'sale_item' => $item,
                'refunded_quantity' => $refundedQty,
                'refundable_quantity' => $refundableQty,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'sale' => $sale,
                'refundable_items' => $refundableItems,
            ],
        ]);
    }

    /**
     * Process a refund
     */
    public function store(Request $request, Sale $sale): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.sale_item_id' => 'required|integer|distinct',
            'items.*.quantity' => 'required|integer|min:1',
            'reason' => 'required|string|max:500',
            'refund_method' => 'required|string|in:cash,card,gcash,maya,store_credit',
        ]);

        $sale->load([
            'items.productVariant.inventory',
            'items.productVariant.product',
            'refunds.items',
            'deliveries.items',
        ]);

        if (!$sale->isEligibleForRefund()) {
            return response()->json([
                'success' => false,
                'message' => 'This sale is not eligible for refund.',
            ], 422);
        }

        if ($sale->status === 'VOIDED') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot refund a voided sale',
            ], 422);
        }

        try {
            $refund = DB::transaction(function () use ($request, $sale) {
                $totalRefundAmount = 0;
                $refundItems = [];
                $existingRefundedBySaleItem = $sale->refunds
                    ->flatMap->items
                    ->groupBy('sale_item_id')
                    ->map(fn ($items) => (float) $items->sum('quantity'));

                foreach ($request->items as $itemData) {
                    $saleItemId = (int) $itemData['sale_item_id'];
                    $saleItem = $sale->items->firstWhere('id', $saleItemId);

                    if (!$saleItem) {
                        throw new \Exception("Item not found in this sale");
                    }

                    $requestedQty = (float) $itemData['quantity'];
                    $refundedQty = (float) ($existingRefundedBySaleItem[$saleItem->id] ?? 0);
                    $canceledQty = (float) ($saleItem->canceled_quantity ?? 0);
                    $refundableQty = max(0, ((float) $saleItem->quantity) - $refundedQty - $canceledQty);

                    if ($requestedQty > $refundableQty) {
                        throw new \Exception(
                            "Cannot refund {$itemData['quantity']} of {$saleItem->productVariant->description}. " .
                            "Only {$refundableQty} available for refund."
                        );
                    }

                    $refundAmount = ((float) $saleItem->unit_price) * $requestedQty;
                    $totalRefundAmount += $refundAmount;

                    $refundItems[] = [
                        'sale_item' => $saleItem,
                        'quantity' => $requestedQty,
                        'amount' => $refundAmount,
                        'restore_inventory' => true,
                    ];

                    $existingRefundedBySaleItem[$saleItem->id] = $refundedQty + $requestedQty;
                }

                if ($totalRefundAmount <= 0) {
                    throw new \Exception('Refund amount must be greater than zero.');
                }

                $remainingRefundable = (float) $sale->remaining_refundable;
                if ($totalRefundAmount > $remainingRefundable) {
                    throw new \Exception(
                        "Refund amount ({$totalRefundAmount}) exceeds remaining refundable amount ({$remainingRefundable})."
                    );
                }

                $isFullRefund = $totalRefundAmount >= $remainingRefundable;

                $refund = Refund::create([
                    'sale_id' => $sale->id,
                    'refund_amount' => $totalRefundAmount,
                    'reason' => $request->reason,
                    'processed_by_user_id' => $request->user()->id,
                    'type' => $isFullRefund ? 'full' : 'partial',
                ]);

                foreach ($refundItems as $itemData) {
                    $saleItem = $itemData['sale_item'];
                    $variant = $saleItem->productVariant;

                    RefundItem::create([
                        'refund_id' => $refund->id,
                        'sale_item_id' => $saleItem->id,
                        'product_variant_id' => $variant->id,
                        'quantity' => $itemData['quantity'],
                        'amount' => $itemData['amount'],
                        'restore_inventory' => $itemData['restore_inventory'],
                    ]);

                    if ($itemData['restore_inventory']) {
                        $currentStock = (float) ($variant->inventory->quantity_on_hand ?? 0);
                        $newStock = $currentStock + ((float) $itemData['quantity']);

                        InventoryMovement::create([
                            'branch_id' => $sale->branch_id ?? ($request->user()->branch_id ?? 1),
                            'product_variant_id' => $variant->id,
                            'product_id' => $variant->product_id,
                            'quantity' => $itemData['quantity'],
                            'qty' => $itemData['quantity'],
                            'type' => 'IN',
                            'movement_type' => 'IN',
                            'reason' => 'refund',
                            'reference_id' => $sale->id,
                            'reference_type' => Sale::class,
                            'unit_cost' => $saleItem->unit_cost ?? null,
                            'total_cost' => ($saleItem->unit_cost ?? null) !== null
                                ? ((float) $saleItem->unit_cost) * ((float) $itemData['quantity'])
                                : null,
                            'notes' => "Refund for sale: {$sale->sale_number}",
                            'recorded_by_user_id' => $request->user()->id,
                        ]);

                        Inventory::updateOrCreate(
                            ['product_variant_id' => $variant->id],
                            ['quantity_on_hand' => $newStock]
                        );
                    }
                }

                $paymentMethod = match ($request->refund_method) {
                    'cash' => 'cash',
                    'gcash' => 'gcash',
                    'card', 'store_credit' => 'credit',
                    'maya' => 'gcash',
                    default => 'cash',
                };

                Payment::create([
                    'sale_id' => $sale->id,
                    'amount' => -$totalRefundAmount,
                    'payment_method' => $paymentMethod,
                    'received_by_user_id' => $request->user()->id,
                    'received_at' => now(),
                    'notes' => "Refund: {$request->reason}",
                ]);

                $sale->refresh();
                $sale->load('payments', 'refunds');
                $sale->updatePaymentStatus();
                $sale->computeSaleStatus();

                if ($sale->is_for_delivery) {
                    $sale->load('deliveries');
                    foreach ($sale->deliveries as $delivery) {
                        $delivery->computeStatus();
                    }
                    $sale->refresh();
                }

                return $refund;
            });

            return response()->json([
                'success' => true,
                'message' => 'Refund processed successfully',
                'data' => $refund->load(['items.productVariant.product', 'processedBy', 'sale']),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Authorize admin access
     */
    private function authorizeAdmin(Request $request): void
    {
        if (!$request->user()->isAdmin()) {
            abort(403, 'Only administrators can perform this action.');
        }
    }
}

