<?php

namespace App\Services;

use App\Models\InventoryMovement;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Inventory Movement Report Query Service
 * 
 * Provides query logic for inventory movement reports.
 * This service is used by both the Inventory Movement Report and the Dashboard.
 * Dashboard aggregates these queries to show KPIs.
 */
class InventoryMovementReportQueryService
{
    /**
     * Get agricultural category id if configured.
     */
    protected function getAgriculturalCategoryId(): ?int
    {
        $categoryId = DB::table('product_categories')
            ->where('name', 'Agricultural Products')
            ->where('is_active', true)
            ->value('id');

        return $categoryId !== null ? (int) $categoryId : null;
    }

    /**
     * Base inventory valuation query (stock on hand x cost basis).
     */
    protected function inventoryValuationQuery(): \Illuminate\Database\Query\Builder
    {
        return DB::table('inventory')
            ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->where('products.track_stock', true)
            ->where('inventory.quantity_on_hand', '>', 0);
    }

    /**
     * Build potential profit query.
     */
    protected function potentialProfitQuery(): \Illuminate\Database\Query\Builder
    {
        return DB::table('inventory')
            ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->where('products.track_stock', true)
            ->where('inventory.quantity_on_hand', '>', 0);
    }

    /**
     * Base query for inventory movements report
     * Can be filtered by date range, type, and product variant
     */
    public function baseQuery(array $filters = []): Builder
    {
        $query = InventoryMovement::query();

        // Filter by date range
        if (isset($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        // Filter by type (IN/OUT)
        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        // Filter by product variant
        if (isset($filters['product_variant_id'])) {
            $query->where('product_variant_id', $filters['product_variant_id']);
        }

        // Filter by reason
        if (isset($filters['reason'])) {
            $query->where('reason', $filters['reason']);
        }

        return $query;
    }

    /**
     * Get inventory movements with pagination
     * Only loads essential relationships
     */
    public function getPaginated(array $filters = [], int $perPage = 15)
    {
        return $this->baseQuery($filters)
            ->select('inventory_movements.*')
            ->with([
                'productVariant:id,product_id,description',
                'productVariant.product:id,name',
                'recordedBy:id,name'
            ])
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);
    }

    /**
     * Get low-stock items (for dashboard)
     * Returns individual variants (not products) with quantity_on_hand <= threshold (default 5)
     * Each variant is shown separately, even if multiple variants belong to the same product
     * Only loads essential columns
     */
    public function getLowStockItems(int $threshold = 5, int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return \App\Models\ProductVariant::select('product_variants.id', 'product_variants.product_id', 'product_variants.description', 'product_variants.unit_price', 'product_variants.purchase_price')
            ->with([
                'product:id,name',
                'inventory:id,product_variant_id,quantity_on_hand'
            ])
            ->join('inventory', 'inventory.product_variant_id', '=', 'product_variants.id')
            ->where('inventory.quantity_on_hand', '<=', $threshold)
            ->orderBy('inventory.quantity_on_hand', 'asc')
            ->limit($limit)
            ->get()
            ->unique('id'); // Ensure no duplicate variants
    }

    /**
     * Get fast-moving items (for dashboard)
     * Returns variants with most units sold in the last 30 days
     * Only loads essential columns
     */
    public function getFastMovingItems(int $limit = 10): array
    {
        $thirtyDaysAgo = now()->subDays(30);

        // Get top selling products from sale_items in the last 30 days
        return \Illuminate\Support\Facades\DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('product_variants', 'sale_items.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->select(
                'product_variants.id',
                'products.name as product_name',
                'product_variants.description',
                \Illuminate\Support\Facades\DB::raw('SUM(sale_items.quantity) as total_sold')
            )
            ->whereDate('sales.created_at', '>=', $thirtyDaysAgo)
            ->whereNotIn('sales.status', ['VOIDED', 'REFUNDED'])
            ->groupBy('product_variants.id', 'products.name', 'product_variants.description')
            ->orderByDesc('total_sold')
            ->limit($limit)
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'product' => ['name' => $item->product_name],
                    'description' => $item->description,
                    'total_sold' => (int) $item->total_sold,
                ];
            })
            ->toArray();
    }

    /**
     * Get inventory value (for dashboard)
     * Calculates total value of inventory on hand using purchase_price fallback unit_price.
     */
    public function getInventoryValue(): float
    {
        $totalValue = $this->inventoryValuationQuery()
            ->selectRaw('COALESCE(SUM(inventory.quantity_on_hand * COALESCE(NULLIF(product_variants.purchase_price, 0), product_variants.unit_price, 0)), 0) as total_value')
            ->value('total_value');

        return (float) ($totalValue ?? 0);
    }

    /**
     * Get inventory value split by hardware vs agricultural categories.
     *
     * @return array{hardware_value: float, agricultural_value: float, total_value: float}
     */
    public function getInventoryValueSplit(): array
    {
        $agriculturalCategoryId = $this->getAgriculturalCategoryId();
        $valueExpression = 'COALESCE(SUM(inventory.quantity_on_hand * COALESCE(NULLIF(product_variants.purchase_price, 0), product_variants.unit_price, 0)), 0) as total_value';

        if ($agriculturalCategoryId === null) {
            $hardwareValue = (float) ($this->inventoryValuationQuery()
                ->selectRaw($valueExpression)
                ->value('total_value') ?? 0);

            return [
                'hardware_value' => $hardwareValue,
                'agricultural_value' => 0.0,
                'total_value' => $hardwareValue,
            ];
        }

        $hardwareValue = (float) ($this->inventoryValuationQuery()
            ->where('products.category_id', '!=', $agriculturalCategoryId)
            ->selectRaw($valueExpression)
            ->value('total_value') ?? 0);

        $agriculturalValue = (float) ($this->inventoryValuationQuery()
            ->where('products.category_id', '=', $agriculturalCategoryId)
            ->selectRaw($valueExpression)
            ->value('total_value') ?? 0);

        return [
            'hardware_value' => $hardwareValue,
            'agricultural_value' => $agriculturalValue,
            'total_value' => $hardwareValue + $agriculturalValue,
        ];
    }

    /**
     * Get potential profit (for dashboard)
     * Calculates total potential profit based on purchase_price and unit_price
     */
    public function getPotentialProfit(bool $hardwareOnly = false): float
    {
        $query = $this->potentialProfitQuery();

        if ($hardwareOnly) {
            $agriculturalCategoryId = $this->getAgriculturalCategoryId();
            if ($agriculturalCategoryId !== null) {
                $query->where('products.category_id', '!=', $agriculturalCategoryId);
            }
        }

        $profitPerUnitExpression = DB::getDriverName() === 'sqlite'
            ? 'MAX(COALESCE(product_variants.unit_price, 0) - COALESCE(NULLIF(product_variants.purchase_price, 0), COALESCE(product_variants.unit_price, 0)), 0)'
            : 'GREATEST(COALESCE(product_variants.unit_price, 0) - COALESCE(NULLIF(product_variants.purchase_price, 0), COALESCE(product_variants.unit_price, 0)), 0)';

        $totalProfit = $query
            ->selectRaw("COALESCE(SUM(inventory.quantity_on_hand * {$profitPerUnitExpression}), 0) as total_profit")
            ->value('total_profit');

        return (float) ($totalProfit ?? 0);
    }
}

