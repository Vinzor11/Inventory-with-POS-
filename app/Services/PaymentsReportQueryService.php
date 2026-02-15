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
            ->join('sales', 'payments.sale_id', '=', 'sales.id')
            ->where('sales.status', '!=', 'VOIDED')
            ->where('amount', '>', 0)
            ->sum('payments.amount');
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
            ")
            ->whereNotIn('status', ['VOIDED', 'REFUNDED']);

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
     * Outstanding is computed from:
     *   adjusted_due = max(sales.total - total_refunded, 0)
     *   outstanding  = max(adjusted_due - total_positive_payments, 0)
     *
     * Notes:
     * - `sales.total` already reflects item cancellations (adjustSale()).
     * - Subtracting refunds prevents refunded amounts from appearing as outstanding.
     * - Positive payments are used (cash-in only), so refund outflows do not
     *   incorrectly increase receivables.
     */
    public function getOutstandingBalances(array $filters = []): float
    {
        $paymentTotals = DB::table('payments')
            ->select('sale_id')
            ->selectRaw('COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as paid_amount')
            ->groupBy('sale_id');

        $refundTotals = DB::table('refunds')
            ->select('sale_id')
            ->selectRaw('COALESCE(SUM(refund_amount), 0) as refunded_amount')
            ->groupBy('sale_id');

        $query = DB::table('sales')
            ->leftJoinSub($refundTotals, 'refund_totals', function ($join): void {
                $join->on('refund_totals.sale_id', '=', 'sales.id');
            })
            ->leftJoinSub($paymentTotals, 'payment_totals', function ($join): void {
                $join->on('payment_totals.sale_id', '=', 'sales.id');
            })
            ->whereNotIn('sales.status', ['VOIDED', 'REFUNDED'])
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN ((CASE WHEN (sales.total - COALESCE(refund_totals.refunded_amount, 0)) > 0 THEN (sales.total - COALESCE(refund_totals.refunded_amount, 0)) ELSE 0 END) - COALESCE(payment_totals.paid_amount, 0)) > 0 THEN ((CASE WHEN (sales.total - COALESCE(refund_totals.refunded_amount, 0)) > 0 THEN (sales.total - COALESCE(refund_totals.refunded_amount, 0)) ELSE 0 END) - COALESCE(payment_totals.paid_amount, 0)) ELSE 0 END), 0) as outstanding'
            );

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

