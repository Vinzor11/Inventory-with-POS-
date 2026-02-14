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
        $normalizedType = strtolower(trim($type));
        $price = self::query()->where('type', $normalizedType)->first();

        if ($price) {
            return (float) ($price->price ?? 0);
        }

        try {
            self::query()->updateOrCreate(
                ['type' => $normalizedType],
                ['price' => 0.00]
            );

            return 0.0;
        } catch (\Throwable) {
            return null;
        }
    }
}
