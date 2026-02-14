<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryMovement extends Model
{
    protected $table = 'inventory_movements';

    protected $fillable = [
        'product_variant_id',
        'product_id',
        'quantity',
        'qty',
        'type',
        'movement_type',
        'unit',
        'reason',
        'reference_id',
        'reference_type',
        'unit_cost',
        'total_cost',
        'notes',
        'recorded_by_user_id',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
        'qty' => 'decimal:4',
        'unit_cost' => 'decimal:4',
        'total_cost' => 'decimal:4',
    ];

    /**
     * Relationship: Movement belongs to a product variant
     * Tracks which variant's stock changed
     */
    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    /**
     * Relationship: Movement is recorded by a user
     * For audit trail - who made the inventory change
     */
    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by_user_id');
    }

    /**
     * Scope for IN movements (stock additions)
     */
    public function scopeIncoming($query)
    {
        return $query->where('type', 'IN');
    }

    /**
     * Scope for OUT movements (stock reductions)
     */
    public function scopeOutgoing($query)
    {
        return $query->where('type', 'OUT');
    }
}
