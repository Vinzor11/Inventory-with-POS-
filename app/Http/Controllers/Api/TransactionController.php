<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();
        $perPage = (int) ($validated['per_page'] ?? 30);

        $page = Sale::query()
            ->select([
                'id',
                'sale_number',
                'delivery_name',
                'total',
                'status',
                'created_at',
            ])
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('created_at')
            ->simplePaginate($perPage)
            ->through(function (Sale $sale): array {
                return [
                    'id' => $sale->id,
                    'number' => $sale->sale_number,
                    'customer_name' => $sale->delivery_name,
                    'total' => (float) $sale->total,
                    'status' => $sale->status,
                    'created_at' => optional($sale->created_at)->toIso8601String(),
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $page,
        ]);
    }
}
