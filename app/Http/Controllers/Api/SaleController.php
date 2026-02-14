<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Sale;
use App\Services\ReceiptPrintService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleController extends Controller
{
    /**
     * Display a listing of sales
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $search = $request->input('search');
        $status = $request->input('status');
        $paymentStatus = $request->input('payment_status');
        $deliveryStatus = $request->input('delivery_status');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $query = Sale::with(['cashier', 'voidedBy', 'items.productVariant.product.category', 'refunds.items', 'deliveries.items'])
            ->withCount('items')
            ->orderBy('created_at', 'desc');

        if ($search) {
            $query->where('sale_number', 'like', "%{$search}%");
        }

        if ($status && in_array($status, ['OPEN', 'COMPLETED', 'PARTIAL', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED'])) {
            $query->where('status', $status);
        }

        if ($paymentStatus && in_array($paymentStatus, ['UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REVERSED'])) {
            $query->where('payment_status', $paymentStatus);
        }

        if ($deliveryStatus) {
            if ($deliveryStatus === 'WALK_IN') {
                $query->where('is_for_delivery', false);
            } elseif (in_array($deliveryStatus, ['PENDING', 'PARTIAL', 'DELIVERED', 'RETURNED', 'CANCELED'])) {
                $query->where('is_for_delivery', true)
                    ->where('delivery_status', $deliveryStatus);
            }
        }

        if ($dateFrom) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $sales = $query->paginate($perPage);

        // Match web sales listing behavior: expose whether a delivery sale still has
        // deliverable quantity after delivered/refunded/canceled adjustments.
        $sales->getCollection()->transform(function ($sale) {
            if (!$sale->is_for_delivery) {
                $sale->has_remaining_delivery = false;
                return $sale;
            }

            $refundedQuantities = [];
            foreach ($sale->refunds as $refund) {
                foreach ($refund->items as $refundItem) {
                    $saleItemId = $refundItem->sale_item_id;
                    $refundedQuantities[$saleItemId] = ($refundedQuantities[$saleItemId] ?? 0) + $refundItem->quantity;
                }
            }

            $hasRemaining = false;
            foreach ($sale->items as $saleItem) {
                $itemStatus = $saleItem->item_status ?? 'ACTIVE';
                if ($itemStatus === 'CANCELED') {
                    continue;
                }

                $refundedQty = $refundedQuantities[$saleItem->id] ?? 0;
                $deliveredQty = $saleItem->delivered_quantity ?? 0;
                $canceledQty = $saleItem->canceled_quantity ?? 0;
                $remainingQty = $saleItem->quantity - $refundedQty - $deliveredQty - $canceledQty;

                if ($remainingQty > 0) {
                    $hasRemaining = true;
                    break;
                }
            }

            $sale->has_remaining_delivery = $hasRemaining;
            return $sale;
        });

        return response()->json([
            'success' => true,
            'data' => $sales,
        ]);
    }

    /**
     * Display the specified sale
     */
    public function show(Sale $sale): JsonResponse
    {
        $sale->load([
            'cashier',
            'voidedBy',
            'items.productVariant.product.category',
            'payments.receivedBy',
            'refunds.items.productVariant.product',
            'refunds.processedBy',
            'deliveries.items.productVariant.product',
            'deliveries.deliveredBy',
            'adjustments.processedBy',
        ]);

        return response()->json([
            'success' => true,
            'data' => $sale,
        ]);
    }

    /**
     * Void a sale
     */
    public function void(Request $request, Sale $sale): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        if ($sale->status === 'VOIDED') {
            return response()->json([
                'success' => false,
                'message' => 'Sale is already voided',
            ], 422);
        }

        if ($sale->status === 'REFUNDED') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot void a refunded sale',
            ], 422);
        }

        DB::transaction(function () use ($sale, $request) {
            // Restore inventory for non-delivery sales
            if (!$sale->is_for_delivery) {
                foreach ($sale->items as $item) {
                    $variant = $item->productVariant;
                    $currentStock = $variant->inventory->quantity_on_hand ?? 0;
                    $newStock = $currentStock + $item->quantity;

                    InventoryMovement::create([
                        'product_variant_id' => $variant->id,
                        'quantity' => $item->quantity,
                        'type' => 'IN',
                        'reason' => 'void',
                        'reference_id' => $sale->id,
                        'notes' => "Void: {$sale->sale_number} - {$request->reason}",
                        'recorded_by_user_id' => $request->user()->id,
                    ]);

                    Inventory::updateOrCreate(
                        ['product_variant_id' => $variant->id],
                        ['quantity_on_hand' => $newStock]
                    );
                }
            }

            $sale->update([
                'status' => 'VOIDED',
                'voided_at' => now(),
                'voided_by_user_id' => $request->user()->id,
                'void_reason' => $request->reason,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Sale voided successfully',
            'data' => $sale->fresh()->load(['cashier', 'voidedBy', 'items.productVariant.product']),
        ]);
    }

    /**
     * Cancel an item from a sale
     */
    public function cancelItem(Request $request, Sale $sale): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'sale_item_id' => 'required|exists:sale_items,id',
            'quantity_to_cancel' => 'nullable|numeric|min:0.01',
            'reason' => 'nullable|string|max:500',
        ]);

        $saleItem = $sale->items()->find($request->sale_item_id);

        if (!$saleItem) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found in this sale',
            ], 422);
        }

        if (!$saleItem->canBeCanceled()) {
            return response()->json([
                'success' => false,
                'message' => 'Item cannot be canceled. No undelivered quantity available.',
            ], 422);
        }

        try {
            $quantityToCancel = $request->input('quantity_to_cancel', $saleItem->max_cancelable_quantity);

            DB::transaction(function () use ($sale, $saleItem, $request, $quantityToCancel) {
                $saleItem->cancel(
                    (float) $quantityToCancel,
                    $request->user()->id,
                    $request->input('reason')
                );
                $sale->adjustSale();
            });
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Item canceled successfully',
            'data' => $sale->fresh()->load(['cashier', 'items.productVariant.product']),
        ]);
    }

    /**
     * Get receipt for a sale
     */
    public function receipt(Request $request, Sale $sale): JsonResponse
    {
        $sale->load([
            'items.productVariant.product',
            'cashier',
            'payments.receivedBy',
        ]);

        $totalPaid = $sale->total_paid;
        $saleTotal = $sale->total;
        $balance = max(0, $saleTotal - $totalPaid);
        $change = max(0, $totalPaid - $saleTotal);

        $paymentSummary = [
            'total_paid' => $totalPaid,
            'balance' => $balance,
            'change' => $change,
        ];

        $charWidth = $request->input('char_width', 32);
        $printService = new ReceiptPrintService($charWidth);
        $receiptText = $printService->generateSalesReceiptPlain($sale, $paymentSummary);

        return response()->json([
            'success' => true,
            'data' => [
                'sale' => $sale,
                'payment_summary' => $paymentSummary,
                'receipt_text' => $receiptText,
            ],
        ]);
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

