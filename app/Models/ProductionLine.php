<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductionLine extends Model
{
    protected $fillable = [
        'production_run_id',
        'product_id',
        'product_variant_id',
        'direction',
        'qty',
        'unit',
        'unit_cost',
        'total_cost',
        'weigh_in_id',
    ];

    protected $casts = [
        'qty' => 'decimal:4',
        'unit_cost' => 'decimal:4',
        'total_cost' => 'decimal:4',
    ];

    public function productionRun(): BelongsTo
    {
        return $this->belongsTo(ProductionRun::class, 'production_run_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function weighIn(): BelongsTo
    {
        return $this->belongsTo(WeighIn::class, 'weigh_in_id');
    }
}
