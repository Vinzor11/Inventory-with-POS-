<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WeighInTransaction extends Model
{
    protected $fillable = [
        'ref_num',
        'weighed_by_user_id',
        'weighed_at',
        'total_amount',
        'status',
        'notes',
        'paid_by_user_id',
        'paid_at',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'weighed_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function ($transaction) {
            if (!$transaction->ref_num) {
                $transaction->ref_num = self::generateRefNum();
            }
        });

        static::saved(function ($transaction) {
            // Auto-calculate total_amount from related weigh-ins
            if ($transaction->exists && $transaction->wasRecentlyCreated) {
                $totalAmount = $transaction->weighIns()->sum('total_amount');
                $transaction->total_amount = $totalAmount;
                $transaction->saveQuietly();
            }
        });
    }

    /**
     * Generate a unique reference number
     * Format: WIT-YYYYMMDD-XXXXXX (e.g., WIT-20251220-384729)
     */
    public static function generateRefNum(): string
    {
        $date = now()->format('Ymd');
        
        do {
            $todayCount = self::where('ref_num', 'like', "WIT-{$date}-%")->count();
            $sequential = str_pad(min($todayCount + 1, 999), 3, '0', STR_PAD_LEFT);
            $random = str_pad(random_int(0, 999), 3, '0', STR_PAD_LEFT);
            $uniqueId = $sequential . $random;
            $refNum = sprintf('WIT-%s-%s', $date, $uniqueId);
        } while (self::where('ref_num', $refNum)->exists());
        
        return $refNum;
    }

    public function weighedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'weighed_by_user_id');
    }

    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by_user_id');
    }

    public function weighIns(): HasMany
    {
        return $this->hasMany(WeighIn::class, 'weigh_in_transaction_id');
    }
}
