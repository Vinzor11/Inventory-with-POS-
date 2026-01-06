<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleAdjustment extends Model
{
    protected $fillable = [
        'sale_id',
        'sale_item_id',
        'amount_removed',
        'canceled_quantity',
        'reason',
        'processed_by_user_id',
    ];

    protected $casts = [
        'amount_removed' => 'decimal:2',
        'canceled_quantity' => 'decimal:2',
    ];

    /**
     * Relationship: SaleAdjustment belongs to a Sale
     */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class, 'sale_id');
    }

    /**
     * Relationship: SaleAdjustment belongs to a SaleItem
     */
    public function saleItem(): BelongsTo
    {
        return $this->belongsTo(SaleItem::class, 'sale_item_id');
    }

    /**
     * Relationship: SaleAdjustment belongs to a User (processed by)
     */
    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by_user_id');
    }
}
