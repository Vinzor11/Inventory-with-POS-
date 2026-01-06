<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Delivery extends Model
{
    protected $fillable = [
        'sale_id',
        'delivered_by_user_id',
        'delivered_at',
        'status',
        'notes',
    ];

    protected $casts = [
        'delivered_at' => 'datetime',
    ];

    /**
     * Compute delivery status based on delivered quantities vs sale quantities (minus refunded quantities)
     * 
     * Business Rules:
     * - pending: no items delivered
     * - partial: some but not all remaining quantities delivered (after refunds)
     * - delivered: all remaining quantities delivered (sold - refunded)
     * 
     * When items are refunded:
     * - Refunded items are no longer considered for delivery
     * - Delivery status is recalculated based on: (sold quantity - refunded quantity)
     * - If items were already delivered and then refunded, they count as returned
     * 
     * Status is computed automatically, not manually set
     */
    public function computeStatus(): void
    {
        // Load sale with items, refunds, and refund items to compare quantities
        $this->load(['sale.items', 'sale.refunds.items', 'sale.deliveries.items', 'items']);
        
        $saleItems = $this->sale->items;
        $deliveryItems = $this->items;
        
        // Calculate refunded quantities per sale item
        $refundedQuantities = [];
        foreach ($this->sale->refunds as $refund) {
            foreach ($refund->items as $refundItem) {
                $saleItemId = $refundItem->sale_item_id;
                $refundedQuantities[$saleItemId] = ($refundedQuantities[$saleItemId] ?? 0) + $refundItem->quantity;
            }
        }
        
        // Calculate delivered quantities from ALL deliveries for this sale (not just this one)
        $allDeliveredQuantities = [];
        foreach ($this->sale->deliveries as $delivery) {
            foreach ($delivery->items as $deliveryItem) {
                $variantId = $deliveryItem->product_variant_id;
                $allDeliveredQuantities[$variantId] = ($allDeliveredQuantities[$variantId] ?? 0) + $deliveryItem->quantity;
            }
        }
        
        // Group THIS delivery's items by product_variant_id and sum quantities
        $thisDeliveryQuantities = [];
        foreach ($deliveryItems as $deliveryItem) {
            $variantId = $deliveryItem->product_variant_id;
            $thisDeliveryQuantities[$variantId] = ($thisDeliveryQuantities[$variantId] ?? 0) + $deliveryItem->quantity;
        }
        
        // If no delivery items, check if there are items remaining to deliver
        if ($deliveryItems->isEmpty()) {
            // Check if there are any items that still need delivery (not fully refunded)
            $hasRemainingItems = false;
            foreach ($saleItems as $saleItem) {
                $refundedQty = $refundedQuantities[$saleItem->id] ?? 0;
                $remainingQty = $saleItem->quantity - $refundedQty;
                if ($remainingQty > 0) {
                    $hasRemainingItems = true;
                    break;
                }
            }
            
            if ($hasRemainingItems) {
                $this->update(['status' => 'pending']);
                $this->sale->update(['delivery_status' => 'PENDING']);
            } else {
                // All items refunded, no delivery needed
                $this->update(['status' => 'pending']);
                $this->sale->update(['delivery_status' => 'CANCELED']);
            }
            return;
        }
        
        // Check if all remaining items (after refunds) are fully delivered across ALL deliveries
        $allDelivered = true;
        $someDelivered = false;
        $hasRemainingItems = false;
        
        foreach ($saleItems as $saleItem) {
            $variantId = $saleItem->product_variant_id;
            $soldQty = $saleItem->quantity;
            $refundedQty = $refundedQuantities[$saleItem->id] ?? 0;
            $canceledQty = $saleItem->canceled_quantity ?? 0;
            $remainingQty = $soldQty - $refundedQty - $canceledQty; // Items that still need delivery
            $totalDeliveredQty = $allDeliveredQuantities[$variantId] ?? 0; // From ALL deliveries
            
            // Only consider items that still need delivery (not fully refunded or canceled)
            if ($remainingQty > 0) {
                $hasRemainingItems = true;
                
                if ($totalDeliveredQty > 0) {
                    $someDelivered = true;
                }
                
                // Compare total delivered quantity (from all deliveries) against remaining quantity
                if ($totalDeliveredQty < $remainingQty) {
                    $allDelivered = false;
                }
            }
        }
        
        // Determine status for THIS delivery record
        // A delivery record is 'delivered' if it has items, but the sale status depends on all deliveries
        $hasItems = !$deliveryItems->isEmpty();
        
        if (!$hasItems) {
            $deliveryStatus = 'pending';
        } elseif ($allDelivered && $someDelivered) {
            // All items delivered across all deliveries, and this delivery has items
            $deliveryStatus = 'delivered';
        } elseif ($someDelivered) {
            // Some items delivered but not all, and this delivery has items
            $deliveryStatus = 'partial';
        } else {
            $deliveryStatus = 'pending';
        }
        
        $this->update(['status' => $deliveryStatus]);
        
        // Determine sale's delivery_status based on ALL deliveries
        if (!$hasRemainingItems) {
            // All items refunded or canceled, no delivery needed
            $saleDeliveryStatus = 'CANCELED';
        } elseif ($allDelivered && $someDelivered) {
            $saleDeliveryStatus = 'DELIVERED';
        } elseif ($someDelivered) {
            $saleDeliveryStatus = 'PARTIAL';
        } else {
            $saleDeliveryStatus = 'PENDING';
        }
        
        // Also update the sale's delivery_status (uppercase format)
        $this->sale->update(['delivery_status' => $saleDeliveryStatus]);
        
        // Recompute sale status based on updated delivery status
        $this->sale->computeSaleStatus();
    }

    /**
     * Relationship: Delivery belongs to a sale
     */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class, 'sale_id');
    }

    /**
     * Relationship: Delivery belongs to a user (delivered by)
     */
    public function deliveredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delivered_by_user_id');
    }

    /**
     * Relationship: Delivery has many items
     */
    public function items(): HasMany
    {
        return $this->hasMany(DeliveryItem::class, 'delivery_id');
    }
}
