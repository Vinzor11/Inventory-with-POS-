<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefundItem extends Model
{
    protected $fillable = [
        'refund_id',
        'sale_item_id',
        'product_variant_id',
        'quantity',
        'amount',
        'restore_inventory',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'amount' => 'decimal:2',
        'restore_inventory' => 'boolean',
    ];

    protected static function booted(): void
    {
        $recheckPendingPrice = function (RefundItem $refundItem): void {
            $variant = $refundItem->productVariant()->first();
            if ($variant) {
                $variant->applyPendingUnitPriceIfEligible();
            }
        };

        static::saved($recheckPendingPrice);
        static::deleted($recheckPendingPrice);
    }

    /**
     * Relationship: RefundItem belongs to a Refund
     * Each refund item is part of a refund transaction
     */
    public function refund(): BelongsTo
    {
        return $this->belongsTo(Refund::class, 'refund_id');
    }

    /**
     * Relationship: RefundItem belongs to a SaleItem
     * Links back to the original sale item being refunded
     */
    public function saleItem(): BelongsTo
    {
        return $this->belongsTo(SaleItem::class, 'sale_item_id');
    }

    /**
     * Relationship: RefundItem belongs to a ProductVariant
     * Tracks which variant is being refunded (for inventory restoration)
     */
    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
