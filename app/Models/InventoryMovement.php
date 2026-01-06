<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryMovement extends Model
{
    protected $table = 'inventory_movements';

    protected $fillable = [
        'product_variant_id',
        'quantity',
        'type',
        'reason',
        'reference_id',
        'unit_cost',
        'notes',
        'recorded_by_user_id',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_cost' => 'decimal:2',
    ];

    /**
     * Relationship: Movement belongs to a product variant
     * Tracks which variant's stock changed
     */
    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
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
