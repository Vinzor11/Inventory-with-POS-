<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = [
        'sale_id',
        'amount',
        'payment_method',
        'received_by_user_id',
        'received_at',
        'notes',
        'status',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'received_at' => 'datetime',
    ];

    /**
     * Relationship: Payment belongs to a Sale
     * Each payment is associated with a specific sale
     */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class, 'sale_id');
    }

    /**
     * Relationship: Payment received by a User
     * Tracks which user recorded the payment (for audit trail)
     */
    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by_user_id');
    }

    /**
     * Check if this payment is a refund (negative amount)
     */
    public function isRefund(): bool
    {
        return $this->amount < 0;
    }
}
