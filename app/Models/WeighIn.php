<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\WeighInPrice;

class WeighIn extends Model
{
    protected $fillable = [
        'ref_num',
        'weigh_in_transaction_id',
        'type',
        'weight_kg',
        'count',
        'unit_price',
        'total_amount',
        'status',
        'weighed_by_user_id',
        'weighed_at',
        'notes',
    ];

    protected $casts = [
        'weight_kg' => 'decimal:2',
        'count' => 'integer',
        'unit_price' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'weighed_at' => 'datetime',
    ];

    /**
     * Auto-fetch price and calculate total_amount when saving
     */
    protected static function booted(): void
    {
        static::creating(function ($weighIn) {
            // Generate unique reference number if not set
            if (!$weighIn->ref_num) {
                $weighIn->ref_num = self::generateRefNum();
            }
        });

        static::saving(function ($weighIn) {
            // Set weight_kg to null for coconuts (they use count instead)
            if ($weighIn->type === 'coconut') {
                $weighIn->weight_kg = null;
            }
            
            // Set count to null for copra types (they use weight_kg instead)
            if (in_array($weighIn->type, ['cooked_copra', 'uncooked_copra'])) {
                $weighIn->count = null;
            }

            // Auto-fetch price from database if not set
            if (!$weighIn->unit_price && $weighIn->type) {
                $price = WeighInPrice::getPriceForType($weighIn->type);
                if ($price) {
                    $weighIn->unit_price = $price;
                }
            }

            // Auto-calculate total_amount
            if (in_array($weighIn->type, ['cooked_copra', 'uncooked_copra']) && $weighIn->weight_kg && $weighIn->unit_price) {
                $weighIn->total_amount = $weighIn->weight_kg * $weighIn->unit_price;
            } elseif ($weighIn->type === 'coconut' && $weighIn->count && $weighIn->unit_price) {
                $weighIn->total_amount = $weighIn->count * $weighIn->unit_price;
            }
        });

        static::saved(function ($weighIn) {
            // Update transaction total when weigh-in is saved
            if ($weighIn->weigh_in_transaction_id) {
                $transaction = $weighIn->transaction;
                if ($transaction) {
                    $totalAmount = $transaction->weighIns()->sum('total_amount');
                    $transaction->total_amount = $totalAmount;
                    $transaction->saveQuietly();
                }
            }
        });
    }

    /**
     * Generate a unique reference number
     * Format: WI-YYYYMMDD-XXXXXX (e.g., WI-20251220-384729)
     * 
     * Uses:
     * - Date (YYYYMMDD) for organization
     * - 6-digit unique identifier combining sequential counter + random component
     * - Ensures uniqueness through database check
     */
    public static function generateRefNum(): string
    {
        $date = now()->format('Ymd');
        
        do {
            // Get count of weigh-ins for today to get base sequential number
            $todayCount = self::where('ref_num', 'like', "WI-{$date}-%")
                ->count();
            
            // Generate a 3-digit sequential component (001-999)
            $sequential = str_pad(min($todayCount + 1, 999), 3, '0', STR_PAD_LEFT);
            
            // Generate a 3-digit random component (000-999) for uniqueness
            $random = str_pad(random_int(0, 999), 3, '0', STR_PAD_LEFT);
            
            // Combine: sequential + random = 6 digits
            $uniqueId = $sequential . $random;
            
            // Format: WI-YYYYMMDD-XXXXXX
            $refNum = sprintf('WI-%s-%s', $date, $uniqueId);
            
            // Ensure uniqueness by checking database
            $exists = self::where('ref_num', $refNum)->exists();
            
            // If collision, regenerate with new random component
            if ($exists) {
                // Try up to 100 times to find unique combination
                $attempts = 0;
                while ($exists && $attempts < 100) {
                    $random = str_pad(random_int(0, 999), 3, '0', STR_PAD_LEFT);
                    $uniqueId = $sequential . $random;
                    $refNum = sprintf('WI-%s-%s', $date, $uniqueId);
                    $exists = self::where('ref_num', $refNum)->exists();
                    $attempts++;
                }
                
                // If still exists after 100 attempts, increment sequential and try again
                if ($exists) {
                    $sequential = str_pad(min($todayCount + 2, 999), 3, '0', STR_PAD_LEFT);
                    $random = str_pad(random_int(0, 999), 3, '0', STR_PAD_LEFT);
                    $uniqueId = $sequential . $random;
                    $refNum = sprintf('WI-%s-%s', $date, $uniqueId);
                }
            }
        } while (self::where('ref_num', $refNum)->exists());
        
        return $refNum;
    }

    /**
     * Relationship: Weigh-in belongs to a user (weighed by)
     */
    public function weighedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'weighed_by_user_id');
    }

    /**
     * Relationship: Weigh-in belongs to a transaction
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(WeighInTransaction::class, 'weigh_in_transaction_id');
    }
}
