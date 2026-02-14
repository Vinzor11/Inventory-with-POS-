<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryMovement;
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

            return [
                'sale_item' => $item,
                'refunded_quantity' => $refundedQty,
                'refundable_quantity' => $item->quantity - $refundedQty,
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
            'items.*.sale_item_id' => 'required|exists:sale_items,id',
            'items.*.quantity' => 'required|integer|min:1',
            'reason' => 'required|string|max:500',
            'refund_method' => 'required|string|in:cash,card,gcash,maya,store_credit',
        ]);

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

                foreach ($request->items as $itemData) {
                    $saleItem = $sale->items()->find($itemData['sale_item_id']);

                    if (!$saleItem) {
                        throw new \Exception("Item not found in this sale");
                    }

                    // Calculate already refunded quantity
                    $refundedQty = $sale->refunds->flatMap->items
                        ->where('sale_item_id', $saleItem->id)
                        ->sum('quantity');

                    $refundableQty = $saleItem->quantity - $refundedQty;

                    if ($itemData['quantity'] > $refundableQty) {
                        throw new \Exception(
                            "Cannot refund {$itemData['quantity']} of {$saleItem->productVariant->description}. " .
                            "Only {$refundableQty} available for refund."
                        );
                    }

                    $refundAmount = ($saleItem->unit_price * $itemData['quantity']);
                    $totalRefundAmount += $refundAmount;

                    $refundItems[] = [
                        'sale_item' => $saleItem,
                        'quantity' => $itemData['quantity'],
                        'amount' => $refundAmount,
                    ];
                }

                // Create refund
                $refund = Refund::create([
                    'sale_id' => $sale->id,
                    'refund_number' => Refund::generateRefundNumber(),
                    'total_amount' => $totalRefundAmount,
                    'reason' => $request->reason,
                    'refund_method' => $request->refund_method,
                    'processed_by_user_id' => $request->user()->id,
                ]);

                // Create refund items and restore inventory
                foreach ($refundItems as $itemData) {
                    $saleItem = $itemData['sale_item'];

                    RefundItem::create([
                        'refund_id' => $refund->id,
                        'sale_item_id' => $saleItem->id,
                        'product_variant_id' => $saleItem->product_variant_id,
                        'quantity' => $itemData['quantity'],
                        'unit_price' => $saleItem->unit_price,
                        'amount' => $itemData['amount'],
                    ]);

                    // Restore inventory
                    $variant = $saleItem->productVariant;
                    $currentStock = $variant->inventory->quantity_on_hand ?? 0;
                    $newStock = $currentStock + $itemData['quantity'];

                    InventoryMovement::create([
                        'product_variant_id' => $variant->id,
                        'quantity' => $itemData['quantity'],
                        'type' => 'IN',
                        'reason' => 'refund',
                        'reference_id' => $refund->id,
                        'notes' => "Refund: {$refund->refund_number}",
                        'recorded_by_user_id' => $request->user()->id,
                    ]);

                    Inventory::updateOrCreate(
                        ['product_variant_id' => $variant->id],
                        ['quantity_on_hand' => $newStock]
                    );
                }

                // Update sale status
                $sale->refresh();
                $sale->computeSaleStatus();
                $sale->updatePaymentStatus();

                return $refund;
            });

            return response()->json([
                'success' => true,
                'message' => 'Refund processed successfully',
                'data' => $refund->load(['items.productVariant.product', 'processedBy', 'sale']),
            ]);
        } catch (\Exception $e) {
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

