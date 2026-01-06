<?php

namespace App\Services;

use App\Models\Sale;
use App\Models\Delivery;
use App\Models\WeighInTransaction;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Dashboard Query Service
 * 
 * Aggregates data from report query services to provide KPIs for the dashboard.
 * 
 * IMPORTANT: This service REUSES report query services to ensure consistency.
 * Dashboard numbers MUST exactly match report totals.
 */
class DashboardQueryService
{
    protected SalesReportQueryService $salesReportService;
    protected PaymentsReportQueryService $paymentsReportService;
    protected RefundsAdjustmentsReportQueryService $refundsAdjustmentsReportService;
    protected DeliveriesReportQueryService $deliveriesReportService;
    protected InventoryMovementReportQueryService $inventoryMovementReportService;
    protected WeighInsReportQueryService $weighInsReportService;

    public function __construct(
        SalesReportQueryService $salesReportService,
        PaymentsReportQueryService $paymentsReportService,
        RefundsAdjustmentsReportQueryService $refundsAdjustmentsReportService,
        DeliveriesReportQueryService $deliveriesReportService,
        InventoryMovementReportQueryService $inventoryMovementReportService,
        WeighInsReportQueryService $weighInsReportService
    ) {
        $this->salesReportService = $salesReportService;
        $this->paymentsReportService = $paymentsReportService;
        $this->refundsAdjustmentsReportService = $refundsAdjustmentsReportService;
        $this->deliveriesReportService = $deliveriesReportService;
        $this->inventoryMovementReportService = $inventoryMovementReportService;
        $this->weighInsReportService = $weighInsReportService;
    }

    /**
     * Get all dashboard KPIs
     */
    public function getDashboardData(): array
    {
        $today = Carbon::today();
        $thisWeek = Carbon::now()->startOfWeek();
        $thisMonth = Carbon::now()->startOfMonth();

        return [
            'sales' => $this->getSalesKPIs($today, $thisWeek, $thisMonth),
            'payments' => $this->getPaymentsKPIs($today, $thisWeek, $thisMonth),
            'deliveries' => $this->getDeliveriesKPIs($today, $thisWeek, $thisMonth),
            'inventory' => $this->getInventoryKPIs(),
            'weigh_ins' => $this->getWeighInsKPIs($today, $thisWeek, $thisMonth),
            'recent_activity' => $this->getRecentActivity(),
            'charts' => $this->getChartData($thisMonth),
            'alerts' => $this->getAlerts(),
            'top_products' => $this->getTopProducts($thisMonth),
            'last_updated' => Carbon::now()->toIso8601String(),
        ];
    }

    /**
     * Get Sales KPIs
     */
    protected function getSalesKPIs(Carbon $today, Carbon $thisWeek, Carbon $thisMonth): array
    {
        // Today
        $todayFilters = ['date_from' => $today->format('Y-m-d'), 'date_to' => $today->format('Y-m-d')];
        $todayGross = $this->salesReportService->getGrossSalesTotal($todayFilters);
        $todayNet = $this->salesReportService->getNetSalesTotal($todayFilters);

        // This Week
        $weekFilters = ['date_from' => $thisWeek->format('Y-m-d'), 'date_to' => Carbon::now()->format('Y-m-d')];
        $weekGross = $this->salesReportService->getGrossSalesTotal($weekFilters);
        $weekNet = $this->salesReportService->getNetSalesTotal($weekFilters);

        // This Month
        $monthFilters = ['date_from' => $thisMonth->format('Y-m-d'), 'date_to' => Carbon::now()->format('Y-m-d')];
        $monthGross = $this->salesReportService->getGrossSalesTotal($monthFilters);
        $monthNet = $this->salesReportService->getNetSalesTotal($monthFilters);

        // Sales by status (all time for now, can be filtered)
        $salesByStatus = $this->salesReportService->getSummaryByStatus([]);

        return [
            'today' => [
                'gross_sales' => $todayGross,
                'net_sales' => $todayNet,
            ],
            'this_week' => [
                'gross_sales' => $weekGross,
                'net_sales' => $weekNet,
            ],
            'this_month' => [
                'gross_sales' => $monthGross,
                'net_sales' => $monthNet,
            ],
            'by_status' => [
                'OPEN' => $salesByStatus['OPEN'] ?? ['count' => 0, 'gross_sales' => 0, 'total_refunded' => 0, 'net_sales' => 0],
                'PARTIAL' => $salesByStatus['PARTIAL'] ?? ['count' => 0, 'gross_sales' => 0, 'total_refunded' => 0, 'net_sales' => 0],
                'COMPLETED' => $salesByStatus['COMPLETED'] ?? ['count' => 0, 'gross_sales' => 0, 'total_refunded' => 0, 'net_sales' => 0],
                'PARTIALLY_REFUNDED' => $salesByStatus['PARTIALLY_REFUNDED'] ?? ['count' => 0, 'gross_sales' => 0, 'total_refunded' => 0, 'net_sales' => 0],
                'REFUNDED' => $salesByStatus['REFUNDED'] ?? ['count' => 0, 'gross_sales' => 0, 'total_refunded' => 0, 'net_sales' => 0],
                'VOIDED' => $salesByStatus['VOIDED'] ?? ['count' => 0, 'gross_sales' => 0, 'total_refunded' => 0, 'net_sales' => 0],
            ],
        ];
    }

    /**
     * Get Payments KPIs
     */
    protected function getPaymentsKPIs(Carbon $today, Carbon $thisWeek, Carbon $thisMonth): array
    {
        // Today
        $todayFilters = ['date_from' => $today->format('Y-m-d'), 'date_to' => $today->format('Y-m-d')];
        $todayPayments = $this->paymentsReportService->getTotalPaymentsReceived($todayFilters);
        $todayOutstanding = $this->paymentsReportService->getOutstandingBalances($todayFilters);
        $todayCounts = $this->paymentsReportService->getPaymentCounts($todayFilters);

        // This Week
        $weekFilters = ['date_from' => $thisWeek->format('Y-m-d'), 'date_to' => Carbon::now()->format('Y-m-d')];
        $weekPayments = $this->paymentsReportService->getTotalPaymentsReceived($weekFilters);
        $weekOutstanding = $this->paymentsReportService->getOutstandingBalances($weekFilters);
        $weekCounts = $this->paymentsReportService->getPaymentCounts($weekFilters);

        // This Month
        $monthFilters = ['date_from' => $thisMonth->format('Y-m-d'), 'date_to' => Carbon::now()->format('Y-m-d')];
        $monthPayments = $this->paymentsReportService->getTotalPaymentsReceived($monthFilters);
        $monthOutstanding = $this->paymentsReportService->getOutstandingBalances($monthFilters);
        $monthCounts = $this->paymentsReportService->getPaymentCounts($monthFilters);

        return [
            'today' => [
                'total_payments' => $todayPayments,
                'outstanding_balances' => $todayOutstanding,
                'fully_paid_count' => $todayCounts['fully_paid'],
                'partially_paid_count' => $todayCounts['partially_paid'],
                'unpaid_count' => $todayCounts['unpaid'],
            ],
            'this_week' => [
                'total_payments' => $weekPayments,
                'outstanding_balances' => $weekOutstanding,
                'fully_paid_count' => $weekCounts['fully_paid'],
                'partially_paid_count' => $weekCounts['partially_paid'],
                'unpaid_count' => $weekCounts['unpaid'],
            ],
            'this_month' => [
                'total_payments' => $monthPayments,
                'outstanding_balances' => $monthOutstanding,
                'fully_paid_count' => $monthCounts['fully_paid'],
                'partially_paid_count' => $monthCounts['partially_paid'],
                'unpaid_count' => $monthCounts['unpaid'],
            ],
        ];
    }

    /**
     * Get Deliveries KPIs
     */
    protected function getDeliveriesKPIs(Carbon $today, Carbon $thisWeek, Carbon $thisMonth): array
    {
        // Today
        $todayFilters = ['date_from' => $today->format('Y-m-d'), 'date_to' => $today->format('Y-m-d')];
        $todayCounts = $this->deliveriesReportService->getDeliveryCounts($todayFilters);

        // This Week
        $weekFilters = ['date_from' => $thisWeek->format('Y-m-d'), 'date_to' => Carbon::now()->format('Y-m-d')];
        $weekCounts = $this->deliveriesReportService->getDeliveryCounts($weekFilters);

        // This Month
        $monthFilters = ['date_from' => $thisMonth->format('Y-m-d'), 'date_to' => Carbon::now()->format('Y-m-d')];
        $monthCounts = $this->deliveriesReportService->getDeliveryCounts($monthFilters);

        return [
            'today' => $todayCounts,
            'this_week' => $weekCounts,
            'this_month' => $monthCounts,
        ];
    }

    /**
     * Get Inventory KPIs
     */
    protected function getInventoryKPIs(): array
    {
        return [
            'low_stock_items' => $this->inventoryMovementReportService->getLowStockItems(5, 100), // Show up to 100 low stock variants
            'fast_moving_items' => $this->inventoryMovementReportService->getFastMovingItems(10),
            'inventory_value' => $this->inventoryMovementReportService->getInventoryValue(),
            'potential_profit' => $this->inventoryMovementReportService->getPotentialProfit(),
        ];
    }

    /**
     * Get Weigh-Ins KPIs
     */
    protected function getWeighInsKPIs(Carbon $today, Carbon $thisWeek, Carbon $thisMonth): array
    {
        // Today
        $todayFilters = ['date_from' => $today->format('Y-m-d'), 'date_to' => $today->format('Y-m-d')];
        $todayTotal = $this->weighInsReportService->getTotalAmount($todayFilters);
        $todayCount = $this->weighInsReportService->getCount($todayFilters);
        $todayByType = $this->weighInsReportService->getSummaryByType($todayFilters);
        $todayByStatus = $this->weighInsReportService->getSummaryByStatus($todayFilters);

        // This Week
        $weekFilters = ['date_from' => $thisWeek->format('Y-m-d'), 'date_to' => Carbon::now()->format('Y-m-d')];
        $weekTotal = $this->weighInsReportService->getTotalAmount($weekFilters);
        $weekCount = $this->weighInsReportService->getCount($weekFilters);
        $weekByType = $this->weighInsReportService->getSummaryByType($weekFilters);
        $weekByStatus = $this->weighInsReportService->getSummaryByStatus($weekFilters);

        // This Month
        $monthFilters = ['date_from' => $thisMonth->format('Y-m-d'), 'date_to' => Carbon::now()->format('Y-m-d')];
        $monthTotal = $this->weighInsReportService->getTotalAmount($monthFilters);
        $monthCount = $this->weighInsReportService->getCount($monthFilters);
        $monthByType = $this->weighInsReportService->getSummaryByType($monthFilters);
        $monthByStatus = $this->weighInsReportService->getSummaryByStatus($monthFilters);

        return [
            'today' => [
                'total_amount' => $todayTotal,
                'count' => $todayCount,
                'by_type' => $todayByType,
                'by_status' => $todayByStatus,
            ],
            'this_week' => [
                'total_amount' => $weekTotal,
                'count' => $weekCount,
                'by_type' => $weekByType,
                'by_status' => $weekByStatus,
            ],
            'this_month' => [
                'total_amount' => $monthTotal,
                'count' => $monthCount,
                'by_type' => $monthByType,
                'by_status' => $monthByStatus,
            ],
        ];
    }

    /**
     * Get Recent Activity
     */
    protected function getRecentActivity(): array
    {
        return [
            'recent_sales' => $this->salesReportService->getRecentSales(5),
            'recent_refunds' => $this->refundsAdjustmentsReportService->getRecentRefunds(5),
            'recent_adjustments' => $this->refundsAdjustmentsReportService->getRecentAdjustments(5),
            'recent_weigh_ins' => $this->weighInsReportService->getRecentWeighIns(5),
        ];
    }

    /**
     * Get Chart Data for sales trend
     */
    protected function getChartData(Carbon $thisMonth): array
    {
        // Daily sales for the current month
        $dailySales = DB::table('sales')
            ->select(DB::raw('DATE(created_at) as date'))
            ->selectRaw('SUM(total) as gross_sales')
            ->selectRaw('COUNT(*) as count')
            ->whereDate('created_at', '>=', $thisMonth->format('Y-m-d'))
            ->whereDate('created_at', '<=', Carbon::now()->format('Y-m-d'))
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => $item->date,
                    'gross_sales' => (float) $item->gross_sales,
                    'count' => (int) $item->count,
                ];
            })
            ->toArray();

        // Daily weigh-ins for the current month
        $dailyWeighIns = DB::table('weigh_in_transactions')
            ->select(DB::raw('DATE(weighed_at) as date'))
            ->selectRaw('SUM(total_amount) as total_amount')
            ->selectRaw('COUNT(*) as count')
            ->whereDate('weighed_at', '>=', $thisMonth->format('Y-m-d'))
            ->whereDate('weighed_at', '<=', Carbon::now()->format('Y-m-d'))
            ->groupBy(DB::raw('DATE(weighed_at)'))
            ->orderBy('date')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => $item->date,
                    'total_amount' => (float) $item->total_amount,
                    'count' => (int) $item->count,
                ];
            })
            ->toArray();

        // Payment collection rate (paid vs unpaid sales)
        $paymentStats = DB::table('sales')
            ->select(DB::raw("
                SUM(CASE WHEN total <= (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payments.sale_id = sales.id) THEN 1 ELSE 0 END) as fully_paid,
                SUM(CASE WHEN total > (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payments.sale_id = sales.id) AND (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payments.sale_id = sales.id) > 0 THEN 1 ELSE 0 END) as partially_paid,
                SUM(CASE WHEN (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payments.sale_id = sales.id) = 0 THEN 1 ELSE 0 END) as unpaid
            "))
            ->whereDate('created_at', '>=', $thisMonth->format('Y-m-d'))
            ->first();

        return [
            'daily_sales' => $dailySales,
            'daily_weigh_ins' => $dailyWeighIns,
            'payment_collection' => [
                'fully_paid' => (int) ($paymentStats->fully_paid ?? 0),
                'partially_paid' => (int) ($paymentStats->partially_paid ?? 0),
                'unpaid' => (int) ($paymentStats->unpaid ?? 0),
            ],
        ];
    }

    /**
     * Get Business Alerts
     */
    protected function getAlerts(): array
    {
        $alerts = [];

        // Out of stock variants (quantity = 0) - count all variants, not just products
        $outOfStockCount = DB::table('inventory')
            ->where('quantity_on_hand', '<=', 0)
            ->count();

        if ($outOfStockCount > 0) {
            // Get sample items for display (limited to 10)
            $outOfStockSamples = DB::table('inventory')
                ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
                ->join('products', 'product_variants.product_id', '=', 'products.id')
                ->where('inventory.quantity_on_hand', '<=', 0)
                ->select('products.name as product_name', 'product_variants.description', 'inventory.quantity_on_hand')
                ->limit(10)
                ->get();

            $alerts[] = [
                'type' => 'danger',
                'title' => 'Out of Stock',
                'message' => $outOfStockCount . ' variant' . ($outOfStockCount !== 1 ? 's' : '') . ' ' . ($outOfStockCount === 1 ? 'is' : 'are') . ' out of stock',
                'count' => $outOfStockCount,
                'items' => $outOfStockSamples->toArray(),
                'action' => '/inventory?filter=out_of_stock',
            ];
        }

        // Pending deliveries older than 3 days
        $overdueDeliveries = Delivery::where('status', 'pending')
            ->where('created_at', '<', Carbon::now()->subDays(3))
            ->count();

        if ($overdueDeliveries > 0) {
            $alerts[] = [
                'type' => 'warning',
                'title' => 'Overdue Deliveries',
                'message' => $overdueDeliveries . ' deliveries pending for more than 3 days',
                'count' => $overdueDeliveries,
                'action' => '/deliveries?status=pending',
            ];
        }

        // Large unpaid weigh-ins (> 5000)
        $largeUnpaidWeighIns = WeighInTransaction::where('status', 'unpaid')
            ->where('total_amount', '>', 5000)
            ->count();

        if ($largeUnpaidWeighIns > 0) {
            $alerts[] = [
                'type' => 'warning',
                'title' => 'Large Unpaid Weigh-Ins',
                'message' => $largeUnpaidWeighIns . ' unpaid weigh-ins over ₱5,000',
                'count' => $largeUnpaidWeighIns,
                'action' => '/weigh-ins?status=unpaid',
            ];
        }

        // Outstanding balances older than 7 days
        $oldOutstanding = Sale::whereRaw('total > (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payments.sale_id = sales.id)')
            ->where('created_at', '<', Carbon::now()->subDays(7))
            ->whereNotIn('status', ['VOIDED', 'REFUNDED'])
            ->count();

        if ($oldOutstanding > 0) {
            $alerts[] = [
                'type' => 'info',
                'title' => 'Outstanding Balances',
                'message' => $oldOutstanding . ' sales with unpaid balance for over 7 days',
                'count' => $oldOutstanding,
                'action' => '/sales?payment_status=unpaid',
            ];
        }

        return $alerts;
    }

    /**
     * Get Top Selling Products
     */
    protected function getTopProducts(Carbon $thisMonth): array
    {
        // Top products by quantity sold
        $topByQuantity = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('product_variants', 'sale_items.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->select(
                'products.id',
                'products.name',
                'product_variants.description',
                DB::raw('SUM(sale_items.quantity) as total_quantity'),
                DB::raw('SUM(sale_items.line_total) as total_revenue')
            )
            ->whereDate('sales.created_at', '>=', $thisMonth->format('Y-m-d'))
            ->whereNotIn('sales.status', ['VOIDED', 'REFUNDED'])
            ->groupBy('products.id', 'products.name', 'product_variants.description')
            ->orderByDesc('total_quantity')
            ->limit(5)
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'description' => $item->description,
                    'total_quantity' => (float) $item->total_quantity,
                    'total_revenue' => (float) $item->total_revenue,
                ];
            })
            ->toArray();

        // Top products by revenue
        $topByRevenue = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('product_variants', 'sale_items.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->select(
                'products.id',
                'products.name',
                'product_variants.description',
                DB::raw('SUM(sale_items.quantity) as total_quantity'),
                DB::raw('SUM(sale_items.line_total) as total_revenue')
            )
            ->whereDate('sales.created_at', '>=', $thisMonth->format('Y-m-d'))
            ->whereNotIn('sales.status', ['VOIDED', 'REFUNDED'])
            ->groupBy('products.id', 'products.name', 'product_variants.description')
            ->orderByDesc('total_revenue')
            ->limit(5)
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'description' => $item->description,
                    'total_quantity' => (float) $item->total_quantity,
                    'total_revenue' => (float) $item->total_revenue,
                ];
            })
            ->toArray();

        return [
            'by_quantity' => $topByQuantity,
            'by_revenue' => $topByRevenue,
        ];
    }
}

