<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CookedCopraSaleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CookedCopraSaleController extends Controller
{
    public function __construct(
        protected CookedCopraSaleService $cookedCopraSaleService
    ) {
    }

    public function stockSummary(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        try {
            $summary = $this->cookedCopraSaleService->getStockSummary();
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'stock' => [$e->getMessage()],
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $summary,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'quantity' => 'required|numeric|min:0.0001',
            'unit_price' => 'required|numeric|min:0.0001',
            'sale_date' => 'nullable|date',
            'customer_name' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $result = $this->cookedCopraSaleService->createProductionStockOutRun(
                $validated,
                (int) $request->user()->id
            );
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'sale' => [$e->getMessage()],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Cooked copra stock-out recorded.',
            'data' => $result,
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        if (!$request->user()?->isAdmin()) {
            abort(403, 'Only administrators can perform cooked copra sales.');
        }
    }
}
