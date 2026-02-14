<?php

namespace App\Services;

use App\Models\Sale;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sales Report Query Service
 * 
 * Provides query logic for sales reports.
 * This service is used by both the Sales Report and the Dashboard.
 * Dashboard aggregates these queries to show KPIs.
 */
class SalesReportQueryService
{
    private ?bool $isSqlite = null;
    private ?bool $salesHasSaleDateColumn = null;
    private ?bool $saleItemsHasCanceledQuantityColumn = null;
    private ?bool $saleItemsHasUnitCostColumn = null;
    private ?bool $saleItemsHasTotalCostColumn = null;
    private ?bool $saleItemsHasProfitColumn = null;
    private ?bool $productVariantsHasPurchasePriceColumn = null;

    private function isSqlite(): bool
    {
        if ($this->isSqlite === null) {
            $this->isSqlite = DB::getDriverName() === 'sqlite';
        }

        return $this->isSqlite;
    }

    private function saleDateExpression(string $table = 'sales'): string
    {
        if ($this->salesHasSaleDateColumn === null) {
            $this->salesHasSaleDateColumn = Schema::hasColumn('sales', 'sale_date');
        }

        if ($this->salesHasSaleDateColumn) {
            return "COALESCE({$table}.sale_date, DATE({$table}.created_at))";
        }

        return "DATE({$table}.created_at)";
    }

    private function saleItemsHasCanceledQuantityColumn(): bool
    {
        if ($this->saleItemsHasCanceledQuantityColumn === null) {
            $this->saleItemsHasCanceledQuantityColumn = Schema::hasColumn('sale_items', 'canceled_quantity');
        }

        return $this->saleItemsHasCanceledQuantityColumn;
    }

    private function saleItemsHasUnitCostColumn(): bool
    {
        if ($this->saleItemsHasUnitCostColumn === null) {
            $this->saleItemsHasUnitCostColumn = Schema::hasColumn('sale_items', 'unit_cost');
        }

        return $this->saleItemsHasUnitCostColumn;
    }

    private function saleItemsHasTotalCostColumn(): bool
    {
        if ($this->saleItemsHasTotalCostColumn === null) {
            $this->saleItemsHasTotalCostColumn = Schema::hasColumn('sale_items', 'total_cost');
        }

        return $this->saleItemsHasTotalCostColumn;
    }

    private function saleItemsHasProfitColumn(): bool
    {
        if ($this->saleItemsHasProfitColumn === null) {
            $this->saleItemsHasProfitColumn = Schema::hasColumn('sale_items', 'profit');
        }

        return $this->saleItemsHasProfitColumn;
    }

    private function productVariantsHasPurchasePriceColumn(): bool
    {
        if ($this->productVariantsHasPurchasePriceColumn === null) {
            $this->productVariantsHasPurchasePriceColumn = Schema::hasColumn('product_variants', 'purchase_price');
        }

        return $this->productVariantsHasPurchasePriceColumn;
    }

    private function remainingQuantityExpression(): string
    {
        if ($this->saleItemsHasCanceledQuantityColumn()) {
            if ($this->isSqlite()) {
                return 'MAX(sale_items.quantity - COALESCE(sale_items.canceled_quantity, 0), 0)';
            }

            return 'GREATEST(sale_items.quantity - COALESCE(sale_items.canceled_quantity, 0), 0)';
        }

        return 'sale_items.quantity';
    }

    private function variantFallbackUnitCostExpression(): string
    {
        if ($this->productVariantsHasPurchasePriceColumn()) {
            return 'COALESCE(NULLIF(product_variants.purchase_price, 0), product_variants.unit_price, 0)';
        }

        return 'COALESCE(product_variants.unit_price, 0)';
    }

    private function saleItemTotalCostExpression(): string
    {
        $remainingQty = $this->remainingQuantityExpression();
        $fallbackUnitCost = $this->variantFallbackUnitCostExpression();
        $snapshotUnitCostExpr = "(($remainingQty) * COALESCE(sale_items.unit_cost, $fallbackUnitCost))";

        if (!$this->saleItemsHasTotalCostColumn()) {
            if ($this->saleItemsHasUnitCostColumn()) {
                return $snapshotUnitCostExpr;
            }

            return "(($remainingQty) * $fallbackUnitCost)";
        }

        $ratioExpr = 'CASE WHEN sale_items.quantity > 0 THEN ' . $remainingQty . ' / sale_items.quantity ELSE 0 END';
        $snapshotTotalCostExpr = "(sale_items.total_cost * ($ratioExpr))";

        if ($this->saleItemsHasUnitCostColumn()) {
            return "COALESCE($snapshotTotalCostExpr, $snapshotUnitCostExpr)";
        }

        return "COALESCE($snapshotTotalCostExpr, (($remainingQty) * $fallbackUnitCost))";
    }

    private function applySalesFiltersToQuery($query, array $filters = [], string $table = 'sales'): void
    {
        $saleDateExpression = $this->saleDateExpression($table);

        if (isset($filters['date_from'])) {
            $query->whereRaw("{$saleDateExpression} >= ?", [$filters['date_from']]);
        }
        if (isset($filters['date_to'])) {
            $query->whereRaw("{$saleDateExpression} <= ?", [$filters['date_to']]);
        }
        if (isset($filters['cashier_id'])) {
            $query->where("{$table}.cashier_user_id", $filters['cashier_id']);
        }
        if (isset($filters['status'])) {
            $query->where("{$table}.status", $filters['status']);
        }
    }

    /**
     * Base query for sales report
     * Can be filtered by date range, cashier, and sale_status
     */
    public function baseQuery(array $filters = []): Builder
    {
        $query = Sale::query();
        $saleDateExpression = $this->saleDateExpression('sales');

        // Filter by date range - qualify with table name to avoid ambiguity
        if (isset($filters['date_from'])) {
            $query->whereRaw("{$saleDateExpression} >= ?", [$filters['date_from']]);
        }

        if (isset($filters['date_to'])) {
            $query->whereRaw("{$saleDateExpression} <= ?", [$filters['date_to']]);
        }

        // Filter by cashier
        if (isset($filters['cashier_id'])) {
            $query->where('cashier_user_id', $filters['cashier_id']);
        }

        // Filter by sale_status
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query;
    }

    /**
     * Get sales with pagination
     * Only loads essential relationships to reduce query time
     */
    public function getPaginated(array $filters = [], int $perPage = 15)
    {
        $saleItemColumns = [
            'id',
            'sale_id',
            'product_variant_id',
            'quantity',
            'unit_price',
            'line_total',
        ];

        if ($this->saleItemsHasCanceledQuantityColumn()) {
            $saleItemColumns[] = 'canceled_quantity';
        }
        if ($this->saleItemsHasUnitCostColumn()) {
            $saleItemColumns[] = 'unit_cost';
        }
        if ($this->saleItemsHasTotalCostColumn()) {
            $saleItemColumns[] = 'total_cost';
        }
        if ($this->saleItemsHasProfitColumn()) {
            $saleItemColumns[] = 'profit';
        }

        $saleItemsSelect = implode(',', $saleItemColumns);

        return $this->baseQuery($filters)
            ->select('sales.*')
            ->with([
                'cashier:id,name,email',
                "items:$saleItemsSelect",
                'payments:id,sale_id,amount',
                'refunds:id,sale_id,refund_amount'
            ])
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);
    }

    /**
     * Get sales summary (for dashboard)
     * Returns aggregated totals by sale_status
     * Uses optimized queries - separate aggregation for sales and refunds
     */
    public function getSummaryByStatus(array $filters = []): array
    {
        // Get sales aggregated by status
        $salesQuery = DB::table('sales');
        $this->applySalesFiltersToQuery($salesQuery, $filters, 'sales');

        $salesByStatus = $salesQuery
            ->select('status')
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('SUM(total) as gross_sales')
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        // Get refunds aggregated by sale status
        $refundsQuery = DB::table('refunds')
            ->join('sales', 'refunds.sale_id', '=', 'sales.id')
            ->select('sales.status')
            ->selectRaw('SUM(refunds.refund_amount) as total_refunded')
            ->groupBy('sales.status');
        $this->applySalesFiltersToQuery($refundsQuery, $filters, 'sales');

        $refundsByStatus = $refundsQuery->get()->keyBy('status');

        $totalCostExpression = $this->saleItemTotalCostExpression();
        $costByStatusQuery = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('product_variants', 'sale_items.product_variant_id', '=', 'product_variants.id')
            ->select('sales.status')
            ->selectRaw("SUM($totalCostExpression) as total_cost")
            ->groupBy('sales.status');
        $this->applySalesFiltersToQuery($costByStatusQuery, $filters, 'sales');

        $costByStatus = $costByStatusQuery->get()->keyBy('status');

        // Combine results
        $summary = [];
        foreach ($salesByStatus as $status => $data) {
            $totalRefunded = (float) ($refundsByStatus[$status]->total_refunded ?? 0);
            $totalCost = (float) ($costByStatus[$status]->total_cost ?? 0);
            $summary[$status] = [
                'count' => (int) $data->count,
                'gross_sales' => (float) $data->gross_sales,
                'total_cost' => $totalCost,
                'gross_profit' => (float) $data->gross_sales - $totalCost,
                'total_refunded' => $totalRefunded,
                'net_sales' => (float) $data->gross_sales - $totalRefunded,
            ];
        }

        return $summary;
    }

    /**
     * Get gross sales total (for dashboard)
     */
    public function getGrossSalesTotal(array $filters = []): float
    {
        $query = $this->baseQuery($filters);

        if (!isset($filters['status'])) {
            $query->where('status', '!=', 'VOIDED');
        }

        return (float) $query->sum('total');
    }

    /**
     * Get net sales total (gross - refunds) (for dashboard)
     * Uses single query with subquery for maximum performance
     */
    public function getNetSalesTotal(array $filters = []): float
    {
        $grossQuery = DB::table('sales');
        $this->applySalesFiltersToQuery($grossQuery, $filters, 'sales');
        if (!isset($filters['status'])) {
            $grossQuery->where('sales.status', '!=', 'VOIDED');
        }
        $grossTotal = (float) $grossQuery->sum('sales.total');

        $refundsQuery = DB::table('refunds')
            ->join('sales', 'refunds.sale_id', '=', 'sales.id');
        $this->applySalesFiltersToQuery($refundsQuery, $filters, 'sales');
        if (!isset($filters['status'])) {
            $refundsQuery->where('sales.status', '!=', 'VOIDED');
        }
        $totalRefunded = (float) $refundsQuery->sum('refunds.refund_amount');

        return max(0, $grossTotal - $totalRefunded);
    }

    /**
     * Get total item cost using average cost basis per variant
     * (purchase_price as weighted-average cache, with unit_price fallback).
     */
    public function getSalesCostTotal(array $filters = []): float
    {
        $costQuery = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('product_variants', 'sale_items.product_variant_id', '=', 'product_variants.id');

        $this->applySalesFiltersToQuery($costQuery, $filters, 'sales');

        if (!isset($filters['status'])) {
            $costQuery->where('sales.status', '!=', 'VOIDED');
        }

        $totalCostExpression = $this->saleItemTotalCostExpression();

        return (float) $costQuery
            ->selectRaw("COALESCE(SUM($totalCostExpression), 0) as total_cost")
            ->value('total_cost');
    }

    /**
     * Gross profit = gross revenue - total item cost.
     */
    public function getGrossProfitTotal(array $filters = []): float
    {
        $gross = $this->getGrossSalesTotal($filters);
        $cost = $this->getSalesCostTotal($filters);

        return $gross - $cost;
    }

    /**
     * Get sales count (for dashboard)
     */
    public function getSalesCount(array $filters = []): int
    {
        return $this->baseQuery($filters)->count();
    }

    /**
     * Get recent sales (for dashboard activity feed)
     * Only loads essential columns
     */
    public function getRecentSales(int $limit = 5): \Illuminate\Database\Eloquent\Collection
    {
        return Sale::select('id', 'sale_number', 'total', 'status', 'cashier_user_id', 'created_at')
            ->with(['cashier:id,name'])
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }
}
