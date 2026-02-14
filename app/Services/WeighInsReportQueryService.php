<?php

namespace App\Services;

use App\Models\WeighIn;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Weigh-Ins Report Query Service
 * 
 * Provides query logic for weigh-ins reports.
 * This service is used by both the Weigh-Ins Report and the Dashboard.
 * Dashboard aggregates these queries to show KPIs.
 */
class WeighInsReportQueryService
{
    private function transactionsQuery(array $filters = [])
    {
        $query = DB::table('weigh_in_transactions');

        if (isset($filters['date_from'])) {
            $query->whereDate('weighed_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->whereDate('weighed_at', '<=', $filters['date_to']);
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['weighed_by_user_id'])) {
            $query->where('weighed_by_user_id', $filters['weighed_by_user_id']);
        }

        if (isset($filters['type'])) {
            $type = $filters['type'];
            $query->whereExists(function ($sub) use ($type) {
                $sub->select(DB::raw(1))
                    ->from('weigh_ins')
                    ->whereColumn('weigh_ins.weigh_in_transaction_id', 'weigh_in_transactions.id')
                    ->where('weigh_ins.type', $type);
            });
        }

        return $query;
    }

    /**
     * Base query for weigh-ins report
     * Can be filtered by date range, type, status, and weighed_by
     */
    public function baseQuery(array $filters = []): Builder
    {
        $query = WeighIn::query();

        // Filter by date range - use weighed_at for date filtering
        if (isset($filters['date_from'])) {
            $query->whereDate('weighed_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->whereDate('weighed_at', '<=', $filters['date_to']);
        }

        // Filter by type
        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        // Filter by status
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        // Filter by weighed_by_user_id
        if (isset($filters['weighed_by_user_id'])) {
            $query->where('weighed_by_user_id', $filters['weighed_by_user_id']);
        }

        return $query;
    }

    /**
     * Get weigh-ins with pagination
     * Only loads essential relationships to reduce query time
     */
    public function getPaginated(array $filters = [], int $perPage = 15)
    {
        return $this->baseQuery($filters)
            ->select('weigh_ins.*')
            ->with([
                'weighedBy:id,name,email'
            ])
            ->orderBy('weighed_at', 'desc')
            ->paginate($perPage);
    }

    /**
     * Get weigh-ins summary by type (for dashboard)
     * Returns aggregated totals by type
     */
    public function getSummaryByType(array $filters = []): array
    {
        $query = DB::table('weigh_ins');

        if (isset($filters['date_from'])) {
            $query->whereDate('weighed_at', '>=', $filters['date_from']);
        }
        if (isset($filters['date_to'])) {
            $query->whereDate('weighed_at', '<=', $filters['date_to']);
        }

        $results = $query
            ->select('type')
            ->selectRaw('COUNT(DISTINCT weigh_in_transaction_id) as count')
            ->selectRaw('SUM(total_amount) as total_amount')
            ->selectRaw('SUM(CASE WHEN type IN ("cooked_copra", "uncooked_copra", "bagol") THEN weight_kg ELSE 0 END) as total_weight_kg')
            ->selectRaw('SUM(CASE WHEN type = "coconut" THEN count ELSE 0 END) as total_count')
            ->groupBy('type')
            ->get();

        $summary = [
            'cooked_copra' => ['count' => 0, 'total_amount' => 0, 'total_weight_kg' => 0],
            'uncooked_copra' => ['count' => 0, 'total_amount' => 0, 'total_weight_kg' => 0],
            'bagol' => ['count' => 0, 'total_amount' => 0, 'total_weight_kg' => 0],
            'coconut' => ['count' => 0, 'total_amount' => 0, 'total_count' => 0],
        ];

        foreach ($results as $result) {
            $type = $result->type;
            if (isset($summary[$type])) {
                $summary[$type]['count'] = (int) $result->count;
                $summary[$type]['total_amount'] = (float) $result->total_amount;
                if (in_array($type, ['cooked_copra', 'uncooked_copra', 'bagol'])) {
                    $summary[$type]['total_weight_kg'] = (float) $result->total_weight_kg;
                } else {
                    $summary[$type]['total_count'] = (int) $result->total_count;
                }
            }
        }

        return $summary;
    }

    /**
     * Get total weigh-ins amount for a date range
     */
    public function getTotalAmount(array $filters = []): float
    {
        return (float) $this->transactionsQuery($filters)->sum('total_amount');
    }

    /**
     * Get weigh-ins count for a date range
     */
    public function getCount(array $filters = []): int
    {
        return (int) $this->transactionsQuery($filters)->count();
    }

    /**
     * Get recent weigh-in transactions (for dashboard)
     */
    public function getRecentWeighIns(int $limit = 5): array
    {
        return \App\Models\WeighInTransaction::query()
            ->select('id', 'ref_num', 'total_amount', 'status', 'weighed_at', 'weighed_by_user_id')
            ->with(['weighedBy:id,name', 'weighIns:id,weigh_in_transaction_id,type'])
            ->orderBy('weighed_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($transaction) {
                // Get the primary type from the first weigh-in
                $primaryType = $transaction->weighIns->first()?->type ?? 'unknown';
                return [
                    'id' => $transaction->id,
                    'ref_num' => $transaction->ref_num,
                    'total_amount' => (float) $transaction->total_amount,
                    'status' => $transaction->status,
                    'type' => $primaryType,
                    'weighed_by' => $transaction->weighedBy ? ['name' => $transaction->weighedBy->name] : null,
                ];
            })
            ->toArray();
    }

    /**
     * Get summary by status (for dashboard)
     */
    public function getSummaryByStatus(array $filters = []): array
    {
        $results = $this->transactionsQuery($filters)
            ->select('status')
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('SUM(total_amount) as total_amount')
            ->groupBy('status')
            ->get();

        $summary = [
            'unpaid' => ['count' => 0, 'total_amount' => 0],
            'paid' => ['count' => 0, 'total_amount' => 0],
        ];

        foreach ($results as $result) {
            $status = $result->status;
            if (isset($summary[$status])) {
                $summary[$status]['count'] = (int) $result->count;
                $summary[$status]['total_amount'] = (float) $result->total_amount;
            }
        }

        return $summary;
    }
}

