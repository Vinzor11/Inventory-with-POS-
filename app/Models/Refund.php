<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Refund extends Model
{
    protected $fillable = [
        'sale_id',
        'refund_amount',
        'reason',
        'processed_by_user_id',
        'type',
    ];

    protected $casts = [
        'refund_amount' => 'decimal:2',
    ];

    /**
     * Relationship: Refund belongs to a Sale
     * Each refund is associated with a specific sale
     */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class, 'sale_id');
    }

    /**
     * Relationship: Refund processed by a User
     * Tracks which user processed the refund (for audit trail)
     */
    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by_user_id');
    }

    /**
     * Relationship: Refund has many RefundItems
     * Tracks individual items being refunded
     */
    public function items(): HasMany
    {
        return $this->hasMany(RefundItem::class, 'refund_id');
    }

    /**
     * Check if this is a full refund
     */
    public function isFull(): bool
    {
        return $this->type === 'full';
    }

    /**
     * Check if this is a partial refund
     */
    public function isPartial(): bool
    {
        return $this->type === 'partial';
    }
}
