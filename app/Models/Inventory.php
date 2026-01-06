<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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

    /**
     * Relationship: Inventory belongs to a product variant
     * Each variant has exactly one inventory record tracking its stock
     */
    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
