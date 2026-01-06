<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WeighInPrice extends Model
{
    protected $fillable = [
        'type',
        'price',
    ];

    protected $casts = [
        'price' => 'decimal:2',
    ];

    /**
     * Get the price for a specific type
     */
    public static function getPriceForType(string $type): ?float
    {
        $price = self::where('type', $type)->first();
        return $price ? (float) $price->price : null;
    }
}
