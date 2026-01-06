<?php

namespace App\Services;

use App\Models\Refund;
use App\Models\SaleAdjustment;
use Illuminate\Database\Eloquent\Builder;

/**
 * Refunds & Adjustments Report Query Service
 * 
 * Provides query logic for refunds and adjustments reports.
 * This service is used by both the Refunds & Adjustments Report and the Dashboard.
 * Dashboard aggregates these queries to show KPIs.
 */
class RefundsAdjustmentsReportQueryService
{
    /**
     * Base query for refunds report
     * Can be filtered by date range and sale
     */
    public function refundsBaseQuery(array $filters = []): Builder
    {
        $query = Refund::query();

        // Filter by date range
        if (isset($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        // Filter by sale
        if (isset($filters['sale_id'])) {
            $query->where('sale_id', $filters['sale_id']);
        }

        return $query;
    }

    /**
     * Base query for adjustments report
     * Can be filtered by date range and sale
     */
    public function adjustmentsBaseQuery(array $filters = []): Builder
    {
        $query = SaleAdjustment::query();

        // Filter by date range
        if (isset($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        // Filter by sale
        if (isset($filters['sale_id'])) {
            $query->where('sale_id', $filters['sale_id']);
        }

        return $query;
    }

    /**
     * Get refunds with pagination
     * Only loads essential relationships
     */
    public function getRefundsPaginated(array $filters = [], int $perPage = 15)
    {
        return $this->refundsBaseQuery($filters)
            ->select('refunds.*')
            ->with([
                'sale:id,sale_number',
                'processedBy:id,name'
            ])
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);
    }

    /**
     * Get adjustments with pagination
     * Only loads essential relationships
     */
    public function getAdjustmentsPaginated(array $filters = [], int $perPage = 15)
    {
        return $this->adjustmentsBaseQuery($filters)
            ->select('sale_adjustments.*')
            ->with([
                'sale:id,sale_number',
                'saleItem:id,sale_id,product_variant_id',
                'saleItem.productVariant:id,product_id,description',
                'saleItem.productVariant.product:id,name',
                'processedBy:id,name'
            ])
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);
    }

    /**
     * Get recent refunds (for dashboard activity feed)
     * Only loads essential columns
     */
    public function getRecentRefunds(int $limit = 5): \Illuminate\Database\Eloquent\Collection
    {
        return Refund::select('id', 'sale_id', 'refund_amount', 'processed_by_user_id', 'created_at')
            ->with([
                'sale:id,sale_number',
                'processedBy:id,name'
            ])
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get recent adjustments (for dashboard activity feed)
     * Only loads essential columns
     */
    public function getRecentAdjustments(int $limit = 5): \Illuminate\Database\Eloquent\Collection
    {
        return SaleAdjustment::select('id', 'sale_id', 'canceled_quantity', 'reason', 'processed_by_user_id', 'created_at')
            ->with([
                'sale:id,sale_number',
                'processedBy:id,name'
            ])
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }
}

