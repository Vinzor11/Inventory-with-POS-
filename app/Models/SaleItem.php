<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SaleItem extends Model
{
    protected $fillable = [
        'sale_id',
        'product_variant_id',
        'quantity',
        'unit_price',
        'line_total',
        'unit_cost',
        'total_cost',
        'profit',
        'delivered_quantity',
        'canceled_quantity',
        'item_status',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'line_total' => 'decimal:2',
        'unit_cost' => 'decimal:4',
        'total_cost' => 'decimal:4',
        'profit' => 'decimal:4',
        'delivered_quantity' => 'decimal:2',
        'canceled_quantity' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        $recheckPendingPrice = function (SaleItem $saleItem): void {
            $variant = $saleItem->productVariant()->first();
            if ($variant) {
                $variant->applyPendingUnitPriceIfEligible();
            }
        };

        static::saved($recheckPendingPrice);
        static::deleted($recheckPendingPrice);
    }

    /**
     * Relationship: SaleItem belongs to a Sale
     * Each line item is part of a sale transaction
     */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class, 'sale_id');
    }

    /**
     * Relationship: SaleItem belongs to a ProductVariant
     * Tracks which variant was sold
     */
    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    /**
     * Relationship: SaleItem has many SaleAdjustments
     * Tracks all adjustments made to this item
     */
    public function adjustments(): HasMany
    {
        return $this->hasMany(SaleAdjustment::class, 'sale_item_id');
    }

    /**
     * Check if item can be canceled (fully or partially)
     * 
     * Business Rules:
     * - Item must not be fully canceled (item_status !== 'CANCELED')
     * - Must have undelivered quantity available to cancel
     * - Calculated as: quantity - delivered_quantity - canceled_quantity > 0
     */
    public function canBeCanceled(): bool
    {
        if ($this->item_status === 'CANCELED') {
            return false;
        }
        
        $delivered = $this->delivered_quantity ?? 0;
        $canceled = $this->canceled_quantity ?? 0;
        $undeliveredQty = $this->quantity - $delivered - $canceled;
        
        return $undeliveredQty > 0;
    }

    /**
     * Get the maximum quantity that can be canceled
     * This is the undelivered quantity (quantity - delivered - already canceled)
     */
    public function getMaxCancelableQuantityAttribute(): float
    {
        $delivered = $this->delivered_quantity ?? 0;
        $canceled = $this->canceled_quantity ?? 0;
        return max(0, $this->quantity - $delivered - $canceled);
    }

    /**
     * Cancel this sale item (fully or partially)
     * 
     * Business Rules:
     * - Can cancel only undelivered quantity
     * - If canceling all remaining quantity, item_status becomes CANCELED
     * - If canceling partial, item_status becomes PARTIAL_ADJUSTED (or stays ACTIVE if delivered portion exists)
     * 
     * @param float $quantityToCancel Quantity to cancel (must be <= max_cancelable_quantity)
     * @param int $processedByUserId User ID who processed the cancellation
     * @param string|null $reason Reason for cancellation
     * @return SaleAdjustment The created adjustment record
     * @throws \Exception If item cannot be canceled or quantity is invalid
     */
    public function cancel(float $quantityToCancel, int $processedByUserId, ?string $reason = null): SaleAdjustment
    {
        if (!$this->canBeCanceled()) {
            throw new \Exception('Item cannot be canceled. No undelivered quantity available.');
        }

        $maxCancelable = $this->max_cancelable_quantity;
        if ($quantityToCancel <= 0 || $quantityToCancel > $maxCancelable) {
            throw new \Exception("Invalid cancellation quantity. Maximum cancelable: {$maxCancelable}");
        }

        // Calculate amount to remove (proportional to line_total)
        $canceledAmount = ($quantityToCancel / $this->quantity) * $this->line_total;
        
        // Update canceled_quantity
        $newCanceledQty = ($this->canceled_quantity ?? 0) + $quantityToCancel;
        
        // Determine item status
        $delivered = $this->delivered_quantity ?? 0;
        $remainingQty = $this->quantity - $delivered - $newCanceledQty;
        
        $newStatus = 'ACTIVE';
        if ($remainingQty == 0) {
            // All undelivered quantity canceled
            if ($delivered > 0) {
                $newStatus = 'PARTIAL_ADJUSTED'; // Some delivered, rest canceled
            } else {
                $newStatus = 'CANCELED'; // Fully canceled (nothing delivered)
            }
        } elseif ($newCanceledQty > 0 && $delivered > 0) {
            $newStatus = 'PARTIAL_ADJUSTED'; // Partially delivered, partially canceled
        }

        // Update item
        $this->update([
            'canceled_quantity' => $newCanceledQty,
            'item_status' => $newStatus,
        ]);

        // Create adjustment record for audit trail
        $adjustment = SaleAdjustment::create([
            'sale_id' => $this->sale_id,
            'sale_item_id' => $this->id,
            'amount_removed' => $canceledAmount,
            'canceled_quantity' => $quantityToCancel,
            'reason' => $reason,
            'processed_by_user_id' => $processedByUserId,
        ]);

        return $adjustment;
    }

    /**
     * Get remaining quantity to deliver
     * Calculated as: quantity - delivered_quantity - canceled_quantity
     */
    public function getRemainingQuantityAttribute(): float
    {
        $delivered = $this->delivered_quantity ?? 0;
        $canceled = $this->canceled_quantity ?? 0;
        return max(0, $this->quantity - $delivered - $canceled);
    }
}
