<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ProductVariant extends Model
{
    protected $fillable = [
        'product_id',
        'size',
        'thickness',
        'diameter',
        'description',
        'unit_price',
        'purchase_price',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'purchase_price' => 'decimal:2',
    ];

    /**
     * Relationship: Variant belongs to a product
     * Each variant represents a different physical version of the same product
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    /**
     * Relationship: Variant has one inventory record
     * Tracks current stock level for this specific variant
     */
    public function inventory(): HasOne
    {
        return $this->hasOne(Inventory::class, 'product_variant_id');
    }

    /**
     * Relationship: Variant has many inventory movements
     * Complete history of stock changes for audit trail
     */
    public function inventoryMovements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class, 'product_variant_id');
    }

    /**
     * Get current stock quantity (helper method)
     */
    public function getCurrentStock(): float
    {
        return $this->inventory?->quantity_on_hand ?? 0;
    }
}
