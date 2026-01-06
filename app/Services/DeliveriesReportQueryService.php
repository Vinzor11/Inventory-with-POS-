<?php

namespace App\Services;

use App\Models\Delivery;
use Illuminate\Database\Eloquent\Builder;

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
        $query = $this->baseQuery($filters);

        // Use a single query with conditional aggregation
        $counts = $query
            ->selectRaw("
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled
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

