<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DeliveryLandingController extends Controller
{
    /**
     * Display the delivery landing page
     * Shows only pending and partial deliveries
     */
    public function index(): Response
    {
        // Get sales with pending or partial deliveries
        $sales = Sale::query()
            ->where('is_for_delivery', true)
            ->whereIn('delivery_status', ['PENDING', 'PARTIAL'])
            ->with([
                'cashier:id,name',
                'items.productVariant.product:id,name,image',
                'deliveries.items.productVariant.product:id,name,image'
            ])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($sale) {
                // Calculate remaining quantities for each item
                $sale->load('refunds.items');
                
                $refundedQuantities = [];
                foreach ($sale->refunds as $refund) {
                    foreach ($refund->items as $refundItem) {
                        $saleItemId = $refundItem->sale_item_id;
                        $refundedQuantities[$saleItemId] = ($refundedQuantities[$saleItemId] ?? 0) + $refundItem->quantity;
                    }
                }
                
                $deliveredQuantities = [];
                foreach ($sale->deliveries as $delivery) {
                    foreach ($delivery->items as $deliveryItem) {
                        $variantId = $deliveryItem->product_variant_id;
                        $deliveredQuantities[$variantId] = ($deliveredQuantities[$variantId] ?? 0) + $deliveryItem->quantity;
                    }
                }
                
                $itemsWithRemaining = $sale->items->map(function ($saleItem) use ($deliveredQuantities, $refundedQuantities) {
                    $variantId = $saleItem->product_variant_id;
                    $soldQty = $saleItem->quantity;
                    $deliveredQty = $deliveredQuantities[$variantId] ?? 0;
                    $refundedQty = $refundedQuantities[$saleItem->id] ?? 0;
                    $canceledQty = $saleItem->canceled_quantity ?? 0;
                    $remainingQty = max(0, $soldQty - $deliveredQty - $refundedQty - $canceledQty);
                    
                    return [
                        'id' => $saleItem->id,
                        'product_variant_id' => $variantId,
                        'quantity' => $soldQty,
                        'unit_price' => $saleItem->unit_price,
                        'line_total' => $saleItem->line_total,
                        'delivered_quantity' => $deliveredQty,
                        'refunded_quantity' => $refundedQty,
                        'canceled_quantity' => $canceledQty,
                        'remaining_quantity' => $remainingQty,
                        'product_variant' => $saleItem->productVariant ? [
                            'id' => $saleItem->productVariant->id,
                            'description' => $saleItem->productVariant->description,
                            'product' => $saleItem->productVariant->product ? [
                                'id' => $saleItem->productVariant->product->id,
                                'name' => $saleItem->productVariant->product->name,
                                'image' => $saleItem->productVariant->product->image,
                            ] : null,
                        ] : null,
                    ];
                })->filter(function ($item) {
                    return $item['remaining_quantity'] > 0;
                });
                
                return [
                    'id' => $sale->id,
                    'sale_number' => $sale->sale_number,
                    'delivery_status' => $sale->delivery_status,
                    'created_at' => $sale->created_at,
                    'notes' => $sale->notes,
                    'cashier' => $sale->cashier,
                    'delivery_name' => $sale->delivery_name,
                    'delivery_address' => $sale->delivery_address,
                    'delivery_contact' => $sale->delivery_contact,
                    'items' => $itemsWithRemaining->values(),
                ];
            })
            ->filter(function ($sale) {
                return $sale['items']->count() > 0;
            })
            ->values();

        return Inertia::render('delivery-landing', [
            'deliveries' => $sales,
        ]);
    }

    /**
     * Process delivery - similar to POS checkout but for deliveries
     */
    public function processDelivery(Request $request, Sale $sale): RedirectResponse
    {
        $request->validate([
            'pin' => 'required|string',
            'items' => 'required|array|min:1',
            'items.*.product_variant_id' => 'required|exists:product_variants,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'delivered_at' => 'required|date',
            'notes' => 'nullable|string|max:1000',
        ]);

        // Verify PIN against active users only.
        $deliveredBy = User::findActiveByPin($request->pin);

        if (!$deliveredBy) {
            throw ValidationException::withMessages([
                'pin' => ['Invalid PIN. Please try again.'],
            ]);
        }

        try {
            $delivery = DB::transaction(function () use ($request, $sale, $deliveredBy) {
                // Load sale items to validate quantities
                $sale->load('items', 'deliveries.items', 'refunds.items');
                $saleItems = $sale->items;
                
                // Calculate already delivered quantities from ALL deliveries for this sale
                $deliveredQuantities = [];
                foreach ($sale->deliveries as $del) {
                    foreach ($del->items as $item) {
                        $variantId = $item->product_variant_id;
                        $deliveredQuantities[$variantId] = ($deliveredQuantities[$variantId] ?? 0) + $item->quantity;
                    }
                }
                
                // Calculate refunded quantities
                $refundedQuantities = [];
                foreach ($sale->refunds as $refund) {
                    foreach ($refund->items as $refundItem) {
                        $saleItemId = $refundItem->sale_item_id;
                        $refundedQuantities[$saleItemId] = ($refundedQuantities[$saleItemId] ?? 0) + $refundItem->quantity;
                    }
                }
                
                // Create a NEW delivery record for this partial delivery
                $delivery = \App\Models\Delivery::create([
                    'sale_id' => $sale->id,
                    'delivered_by_user_id' => $deliveredBy->id,
                    'delivered_at' => $request->delivered_at,
                    'status' => 'pending',
                    'notes' => $request->notes,
                ]);
                
                // Validate and create delivery items
                foreach ($request->items as $itemData) {
                    $variantId = $itemData['product_variant_id'];
                    $requestedQty = $itemData['quantity'];
                    
                    // Find corresponding sale item
                    $saleItem = $saleItems->firstWhere('product_variant_id', $variantId);
                    if (!$saleItem) {
                        throw new \Exception("Product variant {$variantId} not found in sale {$sale->id}");
                    }
                    
                    $soldQty = $saleItem->quantity;
                    $alreadyDelivered = $deliveredQuantities[$variantId] ?? 0;
                    $refundedQty = $refundedQuantities[$saleItem->id] ?? 0;
                    $canceledQty = $saleItem->canceled_quantity ?? 0;
                    // Remaining quantity = sold - delivered - refunded - canceled
                    $remainingQty = $soldQty - $alreadyDelivered - $refundedQty - $canceledQty;
                    
                    // Validate quantity doesn't exceed remaining
                    if ($requestedQty > $remainingQty) {
                        throw new \Exception(
                            "Delivery quantity ({$requestedQty}) exceeds remaining quantity ({$remainingQty})"
                        );
                    }
                    
                    // Create delivery item
                    $delivery->items()->create([
                        'product_variant_id' => $variantId,
                        'quantity' => $requestedQty,
                    ]);
                    
                    // Update delivered_quantity on sale_item (sum of all deliveries for this variant)
                    $newDeliveredQty = $alreadyDelivered + $requestedQty;
                    $saleItem->update(['delivered_quantity' => $newDeliveredQty]);
                    
                    // Deduct inventory when items are delivered
                    $variant = \App\Models\ProductVariant::with('inventory')->findOrFail($variantId);
                    $currentStock = $variant->inventory->quantity_on_hand ?? 0;
                    $newStock = $currentStock - $requestedQty;
                    
                    // Validate stock availability
                    if ($newStock < 0) {
                        throw new \Exception(
                            "Insufficient stock for delivery. Available: {$currentStock}, Requested: {$requestedQty}"
                        );
                    }
                    
                    // Create inventory movement (OUT) for delivery
                    \App\Models\InventoryMovement::create([
                        'product_variant_id' => $variantId,
                        'quantity' => $requestedQty,
                        'type' => 'OUT',
                        'reason' => 'delivery',
                        'reference_id' => $sale->id,
                        'unit_cost' => null,
                        'notes' => "Delivery for sale: {$sale->sale_number}",
                        'recorded_by_user_id' => $deliveredBy->id,
                    ]);
                    
                    // Update inventory quantity
                    \App\Models\Inventory::updateOrCreate(
                        ['product_variant_id' => $variantId],
                        ['quantity_on_hand' => $newStock]
                    );
                }
                
                // Reload delivery with items
                $delivery->load('items');
                
                // Recompute delivery status
                $delivery->computeStatus();
                
                return $delivery;
            });
            
            return redirect()->route('delivery-landing.success', ['delivery' => $delivery->id])
                ->with('success', 'Delivery processed successfully.');
        } catch (\Exception $e) {
            throw ValidationException::withMessages([
                'delivery' => [$e->getMessage()],
            ]);
        }
    }

    /**
     * Display delivery success page
     */
    public function success(\App\Models\Delivery $delivery): Response
    {
        $delivery->load([
            'sale.items.productVariant.product',
            'sale.cashier',
            'deliveredBy',
            'items.productVariant.product'
        ]);

        // Calculate delivery summary
        $deliverySummary = [
            'total_items' => $delivery->items->sum('quantity'),
            'total_value' => $delivery->items->sum(function ($item) {
                $unitPrice = $item->productVariant->unit_price ?? 0;
                return $item->quantity * $unitPrice;
            }),
        ];

        return Inertia::render('delivery-landing/success', [
            'delivery' => $delivery,
            'deliverySummary' => $deliverySummary,
        ]);
    }
}

