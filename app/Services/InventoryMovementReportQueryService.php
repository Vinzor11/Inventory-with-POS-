<?php

namespace App\Services;

use App\Models\InventoryMovement;
use Illuminate\Database\Eloquent\Builder;

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
     * Calculates total value of inventory on hand using purchase_price
     * Excludes agricultural products
     */
    public function getInventoryValue(): float
    {
        return (float) \App\Models\ProductVariant::join('inventory', 'inventory.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->join('product_categories', 'products.category_id', '=', 'product_categories.id')
            ->whereNotNull('product_variants.purchase_price')
            ->where('product_variants.purchase_price', '>', 0)
            ->where('product_categories.name', '!=', 'Agricultural Products')
            ->selectRaw('SUM(inventory.quantity_on_hand * product_variants.purchase_price) as total_value')
            ->value('total_value') ?? 0;
    }

    /**
     * Get potential profit (for dashboard)
     * Calculates total potential profit based on purchase_price and unit_price
     */
    public function getPotentialProfit(): float
    {
        return (float) \App\Models\ProductVariant::join('inventory', 'inventory.product_variant_id', '=', 'product_variants.id')
            ->whereNotNull('product_variants.purchase_price')
            ->selectRaw('SUM(inventory.quantity_on_hand * (product_variants.unit_price - product_variants.purchase_price)) as total_profit')
            ->value('total_profit') ?? 0;
    }
}

