<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductionRun extends Model
{
    protected $fillable = [
        'batch_code',
        'run_type',
        'production_date',
        'notes',
        'operator',
        'supplier_source',
        'drying_method',
        'input_qty',
        'output_qty',
        'yield_value',
        'yield_percent',
        'shrinkage_qty',
        'shrinkage_percent',
        'total_input_cost',
        'output_unit_cost',
        'created_by_user_id',
    ];

    protected $casts = [
        'production_date' => 'date',
        'input_qty' => 'decimal:4',
        'output_qty' => 'decimal:4',
        'yield_value' => 'decimal:6',
        'yield_percent' => 'decimal:4',
        'shrinkage_qty' => 'decimal:4',
        'shrinkage_percent' => 'decimal:4',
        'total_input_cost' => 'decimal:4',
        'output_unit_cost' => 'decimal:4',
    ];

    public function lines(): HasMany
    {
        return $this->hasMany(ProductionLine::class, 'production_run_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
