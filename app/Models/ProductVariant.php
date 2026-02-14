<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\DB;

class ProductVariant extends Model
{
    protected $fillable = [
        'product_id',
        'size',
        'thickness',
        'diameter',
        'description',
        'unit_price',
        'pending_unit_price',
        'pending_price_quantity',
        'purchase_price',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'pending_unit_price' => 'decimal:2',
        'pending_price_quantity' => 'decimal:2',
        'purchase_price' => 'decimal:2',
    ];

    /**
     * Relationship: Variant belongs to a product
     * Each variant represents a different physical version of the same product
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    /**
     * Relationship: Variant has one inventory record
     * Tracks current stock level for this specific variant
     */
    public function inventory(): HasOne
    {
        return $this->hasOne(Inventory::class, 'product_variant_id');
    }

    /**
     * Relationship: Variant has many inventory movements
     * Complete history of stock changes for audit trail
     */
    public function inventoryMovements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class, 'product_variant_id');
    }

    /**
     * Production lines where this variant is used as input/output.
     */
    public function productionLines(): HasMany
    {
        return $this->hasMany(ProductionLine::class, 'product_variant_id');
    }

    /**
     * Get current stock quantity (helper method)
     */
    public function getCurrentStock(): float
    {
        return $this->inventory?->quantity_on_hand ?? 0;
    }

    public function getOfficialStockUnit(): string
    {
        return $this->product?->official_stock_unit
            ?? $this->product?->base_unit
            ?? 'pcs';
    }

    /**
     * Quantity already sold for delivery but not yet fully completed.
     */
    public function getReservedForDeliveryQuantity(): float
    {
        $refundSubquery = DB::table('refund_items')
            ->select('sale_item_id', DB::raw('SUM(quantity) as refunded_qty'))
            ->groupBy('sale_item_id');

        $reserved = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->leftJoinSub($refundSubquery, 'refund_totals', function ($join) {
                $join->on('refund_totals.sale_item_id', '=', 'sale_items.id');
            })
            ->where('sale_items.product_variant_id', $this->id)
            ->where('sales.is_for_delivery', true)
            ->whereIn('sales.delivery_status', ['PENDING', 'PARTIAL'])
            ->where('sales.status', '!=', 'VOIDED')
            ->selectRaw(
                'SUM(GREATEST(sale_items.quantity - COALESCE(sale_items.delivered_quantity, 0) - COALESCE(sale_items.canceled_quantity, 0) - COALESCE(refund_totals.refunded_qty, 0), 0)) as reserved_qty'
            )
            ->value('reserved_qty');

        return max(0, (float) ($reserved ?? 0));
    }

    /**
     * Apply pending batch unit price when older stock has been depleted.
     * Returns true if a pending price was applied.
     */
    public function applyPendingUnitPriceIfEligible(?float $currentStock = null, ?float $reservedForDelivery = null): bool
    {
        $pendingUnitPrice = $this->pending_unit_price !== null ? (float) $this->pending_unit_price : null;
        $pendingQuantity = $this->pending_price_quantity !== null ? (float) $this->pending_price_quantity : null;

        if ($pendingUnitPrice === null || $pendingQuantity === null || $pendingQuantity <= 0) {
            return false;
        }

        $stockOnHand = $currentStock ?? (float) ($this->inventory?->quantity_on_hand ?? 0);
        $reserved = $reservedForDelivery ?? $this->getReservedForDeliveryQuantity();
        $availableStock = max(0, $stockOnHand - max(0, (float) $reserved));

        if ($availableStock > $pendingQuantity) {
            return false;
        }

        $this->forceFill([
            'unit_price' => $pendingUnitPrice,
            'pending_unit_price' => null,
            'pending_price_quantity' => null,
        ])->save();

        return true;
    }
}
