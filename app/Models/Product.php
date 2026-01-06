<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = [
        'category_id',
        'name',
        'brand',
        'sku',
        'image',
        'base_unit',
        'track_stock',
        'is_active',
    ];

    protected $casts = [
        'track_stock' => 'boolean',
        'is_active' => 'boolean',
    ];

    /**
     * Relationship: Product belongs to a category
     * Used for grouping and filtering products
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    /**
     * Relationship: Product has many variants
     * Variants handle different sizes, thicknesses, etc. that affect price/inventory
     */
    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class, 'product_id');
    }

    /**
     * Scope for active products only
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope for products that track stock
     */
    public function scopeTrackStock($query)
    {
        return $query->where('track_stock', true);
    }
}
