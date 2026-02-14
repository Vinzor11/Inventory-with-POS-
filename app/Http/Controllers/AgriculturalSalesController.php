<?php

namespace App\Http\Controllers;

use App\Services\CookedCopraSaleService;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\JsonResponse;

class AgriculturalSalesController extends Controller
{
    public function __construct(
        protected CookedCopraSaleService $cookedCopraSaleService
    ) {
    }

    /**
     * Get cooked copra stock summary for inventory sell dialog.
     */
    public function getStockSummary(): JsonResponse
    {
        try {
            $summary = $this->cookedCopraSaleService->getStockSummary();
        } catch (\Throwable $e) {
            return response()->json([
                'total_stock' => 0,
                'unit' => 'kg',
                'average_cost' => 0,
                'variant' => null,
                'variants' => [],
            ]);
        }

        return response()->json([
            'total_stock' => $summary['stock'],
            'unit' => $summary['unit'],
            'average_cost' => $summary['average_cost'],
            'variant' => $summary,
            // Backward-compatible shape used by existing inventory page modal.
            'variants' => [[
                'id' => $summary['variant_id'],
                'name' => $summary['name'],
                'description' => $summary['description'],
                'unit_price' => $summary['unit_price'],
                'base_unit' => $summary['unit'],
                'stock' => $summary['stock'],
                'average_cost' => $summary['average_cost'],
            ]],
        ]);
    }

    /**
     * Process cooked copra stock-out sale.
     */
    public function checkout(Request $request): RedirectResponse
    {
        $request->validate([
            'quantity' => 'required|numeric|min:0.0001',
            'unit_price' => 'nullable|numeric|min:0.0001',
            'sale_date' => 'nullable|date',
            'customer_name' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $sale = $this->cookedCopraSaleService->createSale([
                'quantity' => $request->input('quantity'),
                'unit_price' => $request->input('unit_price'),
                'sale_date' => $request->input('sale_date'),
                'customer_name' => $request->input('customer_name'),
                'notes' => $request->input('notes'),
            ], (int) auth()->id());

            return redirect()->route('inventory.index')
                ->with('success', 'Cooked copra sale recorded. Ref: ' . $sale->sale_number);
        } catch (\Exception $e) {
            throw ValidationException::withMessages([
                'checkout' => [$e->getMessage()],
            ]);
        }
    }
}
