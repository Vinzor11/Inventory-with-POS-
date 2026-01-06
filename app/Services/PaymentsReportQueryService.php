<?php

namespace App\Services;

use App\Models\Payment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Payments Report Query Service
 * 
 * Provides query logic for payments reports.
 * This service is used by both the Payments Report and the Dashboard.
 * Dashboard aggregates these queries to show KPIs.
 */
class PaymentsReportQueryService
{
    /**
     * Base query for payments report
     * Can be filtered by date range, payment method, and status
     */
    public function baseQuery(array $filters = []): Builder
    {
        $query = Payment::query();

        // Filter by date range
        if (isset($filters['date_from'])) {
            $query->whereDate('received_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->whereDate('received_at', '<=', $filters['date_to']);
        }

        // Filter by payment method
        if (isset($filters['payment_method'])) {
            $query->where('payment_method', $filters['payment_method']);
        }

        // Filter by status
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        // Separate refunds (negative payments) from regular payments
        if (isset($filters['type'])) {
            if ($filters['type'] === 'payment') {
                $query->where('amount', '>', 0);
            } elseif ($filters['type'] === 'refund') {
                $query->where('amount', '<', 0);
            }
        }

        return $query;
    }

    /**
     * Get payments with pagination
     * Only loads essential relationships
     */
    public function getPaginated(array $filters = [], int $perPage = 15)
    {
        return $this->baseQuery($filters)
            ->select('payments.*')
            ->with([
                'sale:id,sale_number',
                'receivedBy:id,name'
            ])
            ->orderBy('received_at', 'desc')
            ->paginate($perPage);
    }

    /**
     * Get total payments received (positive amounts only) (for dashboard)
     */
    public function getTotalPaymentsReceived(array $filters = []): float
    {
        return (float) $this->baseQuery($filters)
            ->where('amount', '>', 0)
            ->sum('amount');
    }

    /**
     * Get total refunds (negative amounts) (for dashboard)
     */
    public function getTotalRefunds(array $filters = []): float
    {
        return abs((float) $this->baseQuery($filters)
            ->where('amount', '<', 0)
            ->sum('amount'));
    }

    /**
     * Get payment counts by status (for dashboard)
     * Uses single query with conditional aggregation
     */
    public function getPaymentCounts(array $filters = []): array
    {
        $query = DB::table('sales')
            ->selectRaw("
                SUM(CASE WHEN payment_status = 'FULLY_PAID' THEN 1 ELSE 0 END) as fully_paid,
                SUM(CASE WHEN payment_status = 'PARTIALLY_PAID' THEN 1 ELSE 0 END) as partially_paid,
                SUM(CASE WHEN payment_status = 'UNPAID' THEN 1 ELSE 0 END) as unpaid
            ");

        if (isset($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        $result = $query->first();

        return [
            'fully_paid' => (int) ($result->fully_paid ?? 0),
            'partially_paid' => (int) ($result->partially_paid ?? 0),
            'unpaid' => (int) ($result->unpaid ?? 0),
        ];
    }

    /**
     * Get outstanding balances (for dashboard)
     * Uses single query with LEFT JOIN for maximum performance
     */
    public function getOutstandingBalances(array $filters = []): float
    {
        $query = DB::table('sales')
            ->selectRaw('COALESCE(SUM(sales.total), 0) - COALESCE(SUM(payments.amount), 0) as outstanding')
            ->leftJoin('payments', 'payments.sale_id', '=', 'sales.id');

        if (isset($filters['date_from'])) {
            $query->whereDate('sales.created_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->whereDate('sales.created_at', '<=', $filters['date_to']);
        }

        $result = $query->value('outstanding');

        return max(0, (float) $result);
    }
}

