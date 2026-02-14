<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class Inventory extends Model
{
    protected $table = 'inventory';

    protected $fillable = [
        'product_variant_id',
        'quantity_on_hand',
    ];

    protected $casts = [
        'quantity_on_hand' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::saved(function (Inventory $inventory) {
            $variant = $inventory->productVariant;
            if ($variant) {
                $variant->applyPendingUnitPriceIfEligible((float) $inventory->quantity_on_hand);

                if (Schema::hasColumn('products', 'stock_qty')) {
                    $totalStock = DB::table('inventory')
                        ->join('product_variants', 'product_variants.id', '=', 'inventory.product_variant_id')
                        ->where('product_variants.product_id', $variant->product_id)
                        ->sum('inventory.quantity_on_hand');

                    $variant->product?->update([
                        'stock_qty' => (float) $totalStock,
                    ]);
                }
            }
        });
    }

    /**
     * Relationship: Inventory belongs to a product variant
     * Each variant has exactly one inventory record tracking its stock
     */
    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
