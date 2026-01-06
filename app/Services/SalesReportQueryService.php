<?php

namespace App\Services;

use App\Models\Sale;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Sales Report Query Service
 * 
 * Provides query logic for sales reports.
 * This service is used by both the Sales Report and the Dashboard.
 * Dashboard aggregates these queries to show KPIs.
 */
class SalesReportQueryService
{
    /**
     * Base query for sales report
     * Can be filtered by date range, cashier, and sale_status
     */
    public function baseQuery(array $filters = []): Builder
    {
        $query = Sale::query();

        // Filter by date range - qualify with table name to avoid ambiguity
        if (isset($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
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
        return $this->baseQuery($filters)
            ->select('sales.*')
            ->with([
                'cashier:id,name,email',
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

        if (isset($filters['date_from'])) {
            $salesQuery->whereDate('created_at', '>=', $filters['date_from']);
        }
        if (isset($filters['date_to'])) {
            $salesQuery->whereDate('created_at', '<=', $filters['date_to']);
        }
        if (isset($filters['cashier_id'])) {
            $salesQuery->where('cashier_user_id', $filters['cashier_id']);
        }
        if (isset($filters['status'])) {
            $salesQuery->where('status', $filters['status']);
        }

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

        if (isset($filters['date_from'])) {
            $refundsQuery->whereDate('sales.created_at', '>=', $filters['date_from']);
        }
        if (isset($filters['date_to'])) {
            $refundsQuery->whereDate('sales.created_at', '<=', $filters['date_to']);
        }
        if (isset($filters['cashier_id'])) {
            $refundsQuery->where('sales.cashier_user_id', $filters['cashier_id']);
        }
        if (isset($filters['status'])) {
            $refundsQuery->where('sales.status', $filters['status']);
        }

        $refundsByStatus = $refundsQuery->get()->keyBy('status');

        // Combine results
        $summary = [];
        foreach ($salesByStatus as $status => $data) {
            $totalRefunded = (float) ($refundsByStatus[$status]->total_refunded ?? 0);
            $summary[$status] = [
                'count' => (int) $data->count,
                'gross_sales' => (float) $data->gross_sales,
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
        return (float) $this->baseQuery($filters)
            ->sum('total');
    }

    /**
     * Get net sales total (gross - refunds) (for dashboard)
     * Uses single query with subquery for maximum performance
     */
    public function getNetSalesTotal(array $filters = []): float
    {
        $query = DB::table('sales')
            ->selectRaw('COALESCE(SUM(sales.total), 0) - COALESCE(SUM(refunds.refund_amount), 0) as net_total')
            ->leftJoin('refunds', 'refunds.sale_id', '=', 'sales.id');

        // Apply filters
        if (isset($filters['date_from'])) {
            $query->whereDate('sales.created_at', '>=', $filters['date_from']);
        }
        if (isset($filters['date_to'])) {
            $query->whereDate('sales.created_at', '<=', $filters['date_to']);
        }
        if (isset($filters['cashier_id'])) {
            $query->where('sales.cashier_user_id', $filters['cashier_id']);
        }
        if (isset($filters['status'])) {
            $query->where('sales.status', $filters['status']);
        }

        $result = $query->value('net_total');

        return max(0, (float) $result);
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

