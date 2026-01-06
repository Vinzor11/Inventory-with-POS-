<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Sale extends Model
{
    protected $fillable = [
        'sale_number',
        'status',
        'payment_status',
        'is_for_delivery',
        'delivery_status',
        'delivery_name',
        'delivery_address',
        'delivery_contact',
        'subtotal',
        'total',
        'notes',
        'cashier_user_id',
        'voided_by_user_id',
        'voided_at',
        'void_reason',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'total' => 'decimal:2',
        'is_for_delivery' => 'boolean',
        'voided_at' => 'datetime',
    ];

    /**
     * Relationship: Sale belongs to a User (cashier)
     * Tracks which cashier processed the sale
     */
    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_user_id');
    }

    /**
     * Relationship: Sale belongs to a User (voided by)
     * Tracks which user voided the sale (for audit trail)
     */
    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by_user_id');
    }

    /**
     * Relationship: Sale has many SaleItems
     * Each sale contains multiple line items
     */
    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class, 'sale_id');
    }

    /**
     * Relationship: Sale has many Payments
     * Tracks all payments received for this sale (including refunds)
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'sale_id');
    }

    /**
     * Relationship: Sale has many deliveries
     * A sale can have multiple deliveries (partial deliveries)
     */
    public function deliveries(): HasMany
    {
        return $this->hasMany(Delivery::class, 'sale_id');
    }

    /**
     * Relationship: Sale has many Refunds
     * A sale can have multiple refunds (partial refunds)
     */
    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class, 'sale_id');
    }

    /**
     * Relationship: Sale has many SaleAdjustments
     * Tracks all adjustments made to this sale (item cancellations)
     */
    public function adjustments(): HasMany
    {
        return $this->hasMany(SaleAdjustment::class, 'sale_id');
    }

    /**
     * Generate a unique sale number
     * Format: SALE-YYYYMMDD-XXXX (e.g., SALE-20251216-0001)
     */
    public static function generateSaleNumber(): string
    {
        $date = now()->format('Ymd');
        $lastSale = self::where('sale_number', 'like', "SALE-{$date}-%")
            ->orderBy('sale_number', 'desc')
            ->first();

        if ($lastSale) {
            $lastNumber = (int) substr($lastSale->sale_number, -4);
            $nextNumber = str_pad($lastNumber + 1, 4, '0', STR_PAD_LEFT);
        } else {
            $nextNumber = '0001';
        }

        return "SALE-{$date}-{$nextNumber}";
    }

    /**
     * Calculate total amount paid (sum of all payments)
     * Includes refunds (negative payments) in the calculation
     */
    public function getTotalPaidAttribute(): float
    {
        return (float) $this->payments()->sum('amount');
    }

    /**
     * Calculate remaining balance
     * Balance = sale.total - total_paid
     */
    public function getBalanceAttribute(): float
    {
        return max(0, $this->total - $this->total_paid);
    }

    /**
     * Update payment status based on payments
     * 
     * Business Rules:
     * - paid: total_paid >= total and no refunds
     * - partial: 0 < total_paid < total and no refunds
     * - unpaid: total_paid <= 0 and no refunds
     * - refunded: total refunded >= total
     * - partially_refunded: refund exists but sale not fully refunded
     * 
     * This is called automatically after payment insert/update
     */
    public function updatePaymentStatus(): void
    {
        $totalPaid = $this->total_paid;
        $totalRefunded = $this->refunds()->sum('refund_amount');

        // If fully refunded
        if ($totalRefunded >= $this->total) {
            $status = 'REFUNDED';
        }
        // If partially refunded
        elseif ($totalRefunded > 0) {
            $status = 'PARTIALLY_REFUNDED';
        }
        // Normal payment status
        elseif ($totalPaid <= 0) {
            $status = 'UNPAID'; // No payment yet, but sale exists
        } elseif ($totalPaid >= $this->total) {
            $status = 'FULLY_PAID';
        } else {
            $status = 'PARTIALLY_PAID'; // Some payment received but not fully paid
        }

        $this->update(['payment_status' => $status]);
    }

    /**
     * Compute and update sale_status based on payment_status, delivery_status, and refunds
     * 
     * Priority Order (highest → lowest):
     * 1. VOIDED
     * 2. REFUNDED
     * 3. PARTIALLY_REFUNDED
     * 4. COMPLETED
     * 5. PARTIAL
     * 6. OPEN
     * 
     * Rule Definitions:
     * - VOIDED: sale_status = VOIDED → immutable
     * - REFUNDED: total_refunded >= sale.total → REFUNDED
     * - PARTIALLY_REFUNDED: 0 < total_refunded < sale.total → PARTIALLY_REFUNDED
     * - COMPLETED: payment_status = FULLY_PAID AND (delivery_status = DELIVERED OR no delivery required)
     * - PARTIAL: (payment_status = PARTIALLY_PAID) OR (payment_status = FULLY_PAID AND (delivery_status = PARTIAL OR delivery_status = PENDING))
     * - OPEN: payment_status = UNPAID AND (delivery_status = PENDING OR no delivery)
     */
    public function computeSaleStatus(): void
    {
        // Priority 1: VOIDED - immutable, cannot be changed
        if ($this->status === 'VOIDED') {
            return;
        }

        $totalRefunded = $this->refunds()->sum('refund_amount');

        // Priority 2: REFUNDED - total_refunded >= sale.total
        if ($totalRefunded >= $this->total) {
            $this->update(['status' => 'REFUNDED']);
            return;
        }

        // Priority 3: PARTIALLY_REFUNDED - 0 < total_refunded < sale.total
        if ($totalRefunded > 0) {
            $this->update(['status' => 'PARTIALLY_REFUNDED']);
            return;
        }

        // Get delivery status (null if not for delivery, or actual status if for delivery)
        $deliveryStatus = $this->is_for_delivery ? $this->delivery_status : null;

        // Priority 4: COMPLETED - payment_status = FULLY_PAID AND (delivery_status = DELIVERED OR no delivery required)
        if ($this->payment_status === 'FULLY_PAID' && 
            ($deliveryStatus === 'DELIVERED' || $deliveryStatus === null)) {
            $this->update(['status' => 'COMPLETED']);
            return;
        }

        // Priority 5: PARTIAL - (payment_status = PARTIALLY_PAID) OR (payment_status = FULLY_PAID AND delivery_status = PARTIAL) OR (payment_status = FULLY_PAID AND delivery_status = PENDING)
        if ($this->payment_status === 'PARTIALLY_PAID' || 
            ($this->payment_status === 'FULLY_PAID' && ($deliveryStatus === 'PARTIAL' || $deliveryStatus === 'PENDING'))) {
            $this->update(['status' => 'PARTIAL']);
            return;
        }

        // Priority 6: OPEN - payment_status = UNPAID AND (delivery_status = PENDING OR no delivery)
        if ($this->payment_status === 'UNPAID' && 
            ($deliveryStatus === 'PENDING' || $deliveryStatus === null)) {
            $this->update(['status' => 'OPEN']);
            return;
        }

        // Fallback: Default to PARTIAL if none of the above conditions match
        $this->update(['status' => 'PARTIAL']);
    }

    /**
     * Check if sale is eligible for refund
     * 
     * Business Rules:
     * - Sale must be paid (FULLY_PAID or PARTIALLY_REFUNDED)
     * - Sale cannot be VOIDED
     * - Sale cannot be already fully REFUNDED
     * - Total refunded amount must be less than sale total
     * 
     * Eligibility Conditions:
     * 1. sale_status must NOT be 'VOIDED' or 'REFUNDED'
     * 2. payment_status must NOT be 'REFUNDED'
     * 3. Total refunded amount must be less than sale total
     * 4. payment_status must be 'FULLY_PAID' or 'PARTIALLY_REFUNDED'
     */
    public function isEligibleForRefund(): bool
    {
        // Rule 1: Sale cannot be voided
        if ($this->status === 'VOIDED') {
            return false;
        }

        // Rule 2: Sale cannot be already fully refunded (by sale status)
        if ($this->status === 'REFUNDED') {
            return false;
        }

        // Rule 3: Payment status cannot be fully refunded
        if ($this->payment_status === 'REFUNDED') {
            return false;
        }

        // Rule 4: Check if total refunded amount exceeds or equals sale total
        // Ensure refunds are loaded
        if (!$this->relationLoaded('refunds')) {
            $this->load('refunds');
        }

        $totalRefunded = $this->refunds()->sum('refund_amount');
        if ($totalRefunded >= $this->total) {
            return false;
        }

        // Rule 5: Sale must be paid (fully or partially refunded)
        // Only FULLY_PAID or PARTIALLY_REFUNDED sales can be refunded
        // UNPAID and PARTIALLY_PAID sales cannot be refunded (no payment or partial payment only)
        return $this->payment_status === 'FULLY_PAID' || $this->payment_status === 'PARTIALLY_REFUNDED';
    }

    /**
     * Calculate total refunded amount
     */
    public function getTotalRefundedAttribute(): float
    {
        return (float) $this->refunds()->sum('refund_amount');
    }

    /**
     * Calculate remaining refundable amount
     */
    public function getRemainingRefundableAttribute(): float
    {
        return max(0, $this->total - $this->total_refunded);
    }

    /**
     * Calculate net total after refunds
     * 
     * Business Rules:
     * - Original total is immutable (for audit trail)
     * - Net total = original total - total refunded
     * - Used for display purposes to show actual sale amount after refunds
     */
    public function getNetTotalAttribute(): float
    {
        return max(0, $this->total - $this->total_refunded);
    }

    /**
     * Adjust sale after item cancellation (supports partial cancellation)
     * 
     * Business Rules:
     * 1. Recalculate sale.total_amount by subtracting canceled quantities proportionally
     * 2. Recalculate sale.balance_due = total_amount - paid_amount
     * 3. Update payment_status if paid_amount == adjusted_total_amount → FULLY_PAID
     * 4. Update sale status: COMPLETED if no balance due and no deliverable items
     * 5. Update delivery status: PARTIAL if some items delivered, some canceled
     * 
     * This method should be called after canceling one or more items (fully or partially)
     */
    public function adjustSale(): void
    {
        // Reload items to get latest status
        $this->load('items');
        
        // Calculate new total by summing adjusted line_totals
        // Rules:
        // - Items with item_status = 'CANCELED': exclude entirely (line_total = 0)
        // - Items with canceled_quantity > 0: subtract proportional amount
        // - Active items: use full line_total
        $newTotal = 0;
        foreach ($this->items as $item) {
            $itemStatus = $item->item_status ?? 'ACTIVE';
            
            // Fully canceled items are excluded entirely
            if ($itemStatus === 'CANCELED') {
                continue; // Skip this item entirely
            }
            
            $canceledQty = $item->canceled_quantity ?? 0;
            $itemQuantity = $item->quantity ?? 0;
            $itemLineTotal = $item->line_total ?? 0;
            
            // Skip if quantity is 0 or line_total is 0
            if ($itemQuantity <= 0 || $itemLineTotal <= 0) {
                continue;
            }
            
            if ($canceledQty > 0) {
                // Calculate proportional amount to subtract for canceled quantity
                // Ensure canceledQty doesn't exceed itemQuantity
                $actualCanceledQty = min($canceledQty, $itemQuantity);
                $canceledAmount = ($actualCanceledQty / $itemQuantity) * $itemLineTotal;
                $adjustedLineTotal = $itemLineTotal - $canceledAmount;
            } else {
                // No cancellation, use full line_total
                $adjustedLineTotal = $itemLineTotal;
            }
            
            // Only add positive values
            if ($adjustedLineTotal > 0) {
                $newTotal += $adjustedLineTotal;
            }
        }
        
        // Prevent negative totals and round to 2 decimal places
        $newTotal = max(0, round($newTotal, 2));
        
        // Update sale total
        $this->update(['total' => $newTotal]);
        
        // Recalculate payment status
        $this->updatePaymentStatus();
        
        // Check if there are any deliverable items remaining
        // Deliverable = quantity - delivered - canceled > 0
        $hasDeliverableItems = $this->items()
            ->whereRaw('(quantity - COALESCE(delivered_quantity, 0) - COALESCE(canceled_quantity, 0)) > 0')
            ->exists();
        
        // Update delivery status if sale is for delivery
        if ($this->is_for_delivery) {
            $hasDeliveredItems = $this->items()
                ->where('delivered_quantity', '>', 0)
                ->exists();
            
            $hasCanceledItems = $this->items()
                ->where('canceled_quantity', '>', 0)
                ->exists();
            
            $hasPartiallyAdjustedItems = $this->items()
                ->where('item_status', 'PARTIAL_ADJUSTED')
                ->exists();
            
            if (($hasDeliveredItems && $hasCanceledItems) || $hasPartiallyAdjustedItems) {
                // Some items delivered, some canceled → PARTIAL
                $this->update(['delivery_status' => 'PARTIAL']);
            } elseif (!$hasDeliverableItems && !$hasDeliveredItems) {
                // All items canceled, no delivery needed
                $this->update(['delivery_status' => 'CANCELED']);
            } elseif (!$hasDeliverableItems && $hasDeliveredItems) {
                // All remaining items delivered
                $this->update(['delivery_status' => 'DELIVERED']);
            }
        }
        
        // Recompute sale status
        $this->computeSaleStatus();
    }

    /**
     * Calculate total amount from canceled items
     */
    public function getTotalCanceledAmountAttribute(): float
    {
        return (float) $this->items()
            ->where('item_status', 'CANCELED')
            ->sum('line_total');
    }
}
