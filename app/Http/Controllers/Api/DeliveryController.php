<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\DeliveryItem;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Sale;
use App\Services\ReceiptPrintService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DeliveryController extends Controller
{
    /**
     * List all deliveries
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $status = $request->input('status');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $query = Delivery::with(['sale', 'items.productVariant.product', 'deliveredBy'])
            ->orderBy('created_at', 'desc');

        if ($status && in_array($status, ['pending', 'partial', 'delivered', 'canceled'])) {
            $query->where('status', $status);
        }

        if ($dateFrom) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $deliveries = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $deliveries,
        ]);
    }

    /**
     * Show delivery details
     */
    public function show(Delivery $delivery): JsonResponse
    {
        $delivery->load([
            'sale.items.productVariant.product',
            'sale.cashier',
            'items.productVariant.product',
            'deliveredBy',
        ]);

        return response()->json([
            'success' => true,
            'data' => $delivery,
        ]);
    }

    /**
     * Get delivery for a sale
     */
    public function forSale(Sale $sale): JsonResponse
    {
        if (!$sale->is_for_delivery) {
            return response()->json([
                'success' => false,
                'message' => 'This sale is not for delivery',
            ], 422);
        }

        $sale->load([
            'items.productVariant.product',
            'deliveries.items.productVariant.product',
            'deliveries.deliveredBy',
            'refunds.items',
        ]);

        $refundedQuantities = [];
        foreach ($sale->refunds as $refund) {
            foreach ($refund->items as $refundItem) {
                $saleItemId = $refundItem->sale_item_id;
                $refundedQuantities[$saleItemId] = ($refundedQuantities[$saleItemId] ?? 0) + $refundItem->quantity;
            }
        }

        // Calculate deliverable quantities.
        $deliverableItems = $sale->items->map(function ($item) use ($sale, $refundedQuantities) {
            $deliveredQty = $sale->deliveries->flatMap->items
                ->where('sale_item_id', $item->id)
                ->sum('quantity');

            $refundedQty = $refundedQuantities[$item->id] ?? 0;
            $canceledQty = $item->canceled_quantity ?? 0;
            $deliverableQty = max(0, $item->quantity - $deliveredQty - $refundedQty - $canceledQty);

            return [
                'sale_item' => $item,
                'delivered_quantity' => $deliveredQty,
                'deliverable_quantity' => $deliverableQty,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'sale' => $sale,
                'deliverable_items' => $deliverableItems,
            ],
        ]);
    }

    /**
     * Add delivery items
     */
    public function addItems(Request $request, Sale $sale): JsonResponse
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.sale_item_id' => 'required|exists:sale_items,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string|max:500',
        ]);

        if (!$sale->is_for_delivery) {
            return response()->json([
                'success' => false,
                'message' => 'This sale is not for delivery',
            ], 422);
        }

        try {
            $delivery = DB::transaction(function () use ($request, $sale) {
                $sale->load([
                    'items.productVariant.inventory',
                    'deliveries.items',
                    'refunds.items',
                ]);

                $refundedQuantities = [];
                foreach ($sale->refunds as $refund) {
                    foreach ($refund->items as $refundItem) {
                        $saleItemId = $refundItem->sale_item_id;
                        $refundedQuantities[$saleItemId] = ($refundedQuantities[$saleItemId] ?? 0) + $refundItem->quantity;
                    }
                }

                $deliveredBySaleItem = [];
                foreach ($sale->deliveries as $existingDelivery) {
                    foreach ($existingDelivery->items as $deliveryItem) {
                        $saleItemId = $deliveryItem->sale_item_id;
                        if (!$saleItemId) {
                            continue;
                        }
                        $deliveredBySaleItem[$saleItemId] = ($deliveredBySaleItem[$saleItemId] ?? 0) + $deliveryItem->quantity;
                    }
                }

                // Reuse untouched POS placeholder for first trip, otherwise create a new delivery per trip.
                $delivery = $sale->deliveries()
                    ->where('status', 'pending')
                    ->whereNull('delivered_by_user_id')
                    ->whereNull('delivered_at')
                    ->whereDoesntHave('items')
                    ->oldest('id')
                    ->first();

                if (!$delivery) {
                    $delivery = Delivery::create([
                        'sale_id' => $sale->id,
                        'delivered_by_user_id' => $request->user()->id,
                        'delivered_at' => now(),
                        'status' => 'pending',
                        'notes' => $request->notes,
                    ]);
                } else {
                    $delivery->update([
                        'delivered_by_user_id' => $request->user()->id,
                        'delivered_at' => now(),
                        'notes' => $request->notes,
                    ]);
                }

                foreach ($request->items as $itemData) {
                    $saleItem = $sale->items->firstWhere('id', (int) $itemData['sale_item_id']);

                    if (!$saleItem) {
                        throw new \Exception("Item not found in this sale");
                    }

                    $requestedQty = (float) $itemData['quantity'];
                    $deliveredQty = $deliveredBySaleItem[$saleItem->id] ?? ($saleItem->delivered_quantity ?? 0);
                    $refundedQty = $refundedQuantities[$saleItem->id] ?? 0;
                    $canceledQty = $saleItem->canceled_quantity ?? 0;
                    $deliverableQty = max(0, $saleItem->quantity - $deliveredQty - $refundedQty - $canceledQty);

                    if ($requestedQty > $deliverableQty) {
                        throw new \Exception(
                            "Cannot deliver {$requestedQty} of {$saleItem->productVariant->description}. " .
                            "Only {$deliverableQty} remaining."
                        );
                    }

                    // Check stock availability
                    $variant = $saleItem->productVariant;
                    $currentStock = $variant->inventory->quantity_on_hand ?? 0;

                    if ($requestedQty > $currentStock) {
                        throw new \Exception(
                            "Insufficient stock for {$variant->description}. " .
                            "Available: {$currentStock}, Requested: {$requestedQty}"
                        );
                    }

                    // Create delivery item
                    DeliveryItem::create([
                        'delivery_id' => $delivery->id,
                        'sale_item_id' => $saleItem->id,
                        'product_variant_id' => $variant->id,
                        'quantity' => $requestedQty,
                    ]);

                    $newDeliveredQty = $deliveredQty + $requestedQty;
                    $saleItem->update(['delivered_quantity' => $newDeliveredQty]);
                    $deliveredBySaleItem[$saleItem->id] = $newDeliveredQty;

                    // Deduct inventory
                    $newStock = $currentStock - $requestedQty;

                    InventoryMovement::create([
                        'product_variant_id' => $variant->id,
                        'quantity' => $requestedQty,
                        'type' => 'OUT',
                        'reason' => 'delivery',
                        'reference_id' => $delivery->id,
                        'notes' => "Delivery for sale: {$sale->sale_number}",
                        'recorded_by_user_id' => $request->user()->id,
                    ]);

                    Inventory::updateOrCreate(
                        ['product_variant_id' => $variant->id],
                        ['quantity_on_hand' => $newStock]
                    );
                }

                // Update delivery status
                $delivery->update([
                    'delivered_by_user_id' => $request->user()->id,
                    'delivered_at' => now(),
                ]);

                // Compute delivery status (this also updates sale->delivery_status).
                $delivery->refresh();
                $delivery->computeStatus();

                // Update sale status
                $sale->refresh();
                $sale->computeSaleStatus();

                return $delivery;
            });

            return response()->json([
                'success' => true,
                'message' => 'Delivery processed successfully.',
                'data' => $delivery->fresh()->load(['items.productVariant.product', 'deliveredBy', 'sale']),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Get delivery receipt
     */
    public function receipt(Request $request, Delivery $delivery): JsonResponse
    {
        $delivery->load([
            'items.productVariant.product',
            'sale:id,sale_number,created_at,delivery_name,delivery_address,delivery_contact,cashier_user_id,total',
            'sale.cashier:id,name',
            'deliveredBy:id,name',
        ]);

        $deliverySummary = [
            'total_items' => $delivery->items->sum('quantity'),
            'total_value' => $delivery->sale ? ($delivery->sale->total ?? 0) : 0,
        ];

        $charWidth = $request->input('char_width', 32);
        $printService = new ReceiptPrintService($charWidth);
        $receiptText = $printService->generateDeliveryReceiptPlain($delivery, $deliverySummary);

        return response()->json([
            'success' => true,
            'data' => [
                'delivery' => $delivery,
                'delivery_summary' => $deliverySummary,
                'receipt_text' => $receiptText,
            ],
        ]);
    }
}
