<?php

namespace App\Services;

use App\Models\Delivery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Deliveries Report Query Service
 * 
 * Provides query logic for deliveries reports.
 * This service is used by both the Deliveries Report and the Dashboard.
 * Dashboard aggregates these queries to show KPIs.
 */
class DeliveriesReportQueryService
{
    /**
     * Base query for deliveries report
     * Can be filtered by date range, status, and sale
     */
    public function baseQuery(array $filters = []): Builder
    {
        $query = Delivery::query();

        // Filter by date range
        if (isset($filters['date_from'])) {
            $query->whereDate('delivered_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->whereDate('delivered_at', '<=', $filters['date_to']);
        }

        // Filter by status
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        // Filter by sale
        if (isset($filters['sale_id'])) {
            $query->where('sale_id', $filters['sale_id']);
        }

        return $query;
    }

    /**
     * Get deliveries with pagination
     * Only loads essential relationships
     */
    public function getPaginated(array $filters = [], int $perPage = 15)
    {
        return $this->baseQuery($filters)
            ->select('deliveries.*')
            ->with([
                'sale:id,sale_number',
                'deliveredBy:id,name',
                'items:id,delivery_id,product_variant_id,quantity',
                'items.productVariant:id,product_id,description',
                'items.productVariant.product:id,name'
            ])
            ->orderBy('delivered_at', 'desc')
            ->paginate($perPage);
    }

    /**
     * Get delivery counts by status (for dashboard)
     * Uses database aggregation for performance
     */
    public function getDeliveryCounts(array $filters = []): array
    {
        // Count by CURRENT sale delivery status (not historical delivery trips)
        $query = DB::table('sales')
            ->where('is_for_delivery', true);

        if (isset($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        if (isset($filters['status'])) {
            $query->where('delivery_status', strtoupper((string) $filters['status']));
        }

        if (isset($filters['sale_id'])) {
            $query->where('id', $filters['sale_id']);
        }

        $counts = $query
            ->selectRaw("
                SUM(CASE WHEN delivery_status = 'PENDING' OR delivery_status IS NULL THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN delivery_status = 'PARTIAL' THEN 1 ELSE 0 END) as partial,
                SUM(CASE WHEN delivery_status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN delivery_status = 'CANCELED' OR delivery_status = 'RETURNED' THEN 1 ELSE 0 END) as canceled
            ")
            ->first();

        return [
            'pending' => (int) ($counts->pending ?? 0),
            'partial' => (int) ($counts->partial ?? 0),
            'delivered' => (int) ($counts->delivered ?? 0),
            'canceled' => (int) ($counts->canceled ?? 0),
        ];
    }
}

