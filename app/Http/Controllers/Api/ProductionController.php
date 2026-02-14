<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductionRun;
use App\Services\ProductionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ProductionController extends Controller
{
    public function __construct(
        protected ProductionService $productionService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeProducer($request);

        $perPage = min(max((int) $request->input('per_page', 30), 1), 200);

        $runs = ProductionRun::query()
            ->with([
                'createdBy:id,name',
                'lines:id,production_run_id,direction,qty,unit,unit_cost,total_cost',
            ])
            ->when($request->filled('run_type'), function ($query) use ($request) {
                $query->where('run_type', (string) $request->input('run_type'));
            })
            ->when($request->filled('date_from'), function ($query) use ($request) {
                $query->whereDate('production_date', '>=', (string) $request->input('date_from'));
            })
            ->when($request->filled('date_to'), function ($query) use ($request) {
                $query->whereDate('production_date', '<=', (string) $request->input('date_to'));
            })
            ->orderByDesc('production_date')
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $runs,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeProducer($request);

        $validated = $request->validate([
            'run_type' => 'required|in:coconut_to_uncooked,uncooked_to_cooked,coconut_to_cooked',
            'input_variant_id' => 'nullable|exists:product_variants,id',
            'output_variant_id' => 'nullable|exists:product_variants,id',
            'input_qty' => 'required|numeric|min:0.0001',
            'output_weight_kg' => 'required_without:output_weigh_in_id|nullable|numeric|min:0.0001',
            'output_weigh_in_id' => 'nullable|exists:weigh_ins,id',
            'record_weigh_in' => 'nullable|boolean',
            'production_date' => 'required|date',
            'operator' => 'nullable|string|max:255',
            'supplier_source' => 'nullable|string|max:255',
            'drying_method' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $run = $this->productionService->createRun(
                $validated,
                (int) $request->user()->id
            );
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Production run saved.',
            'data' => $run,
        ]);
    }

    private function authorizeProducer(Request $request): void
    {
        if (!$request->user()?->can('can_produce')) {
            abort(403, 'Only administrators can perform production actions.');
        }
    }
}
