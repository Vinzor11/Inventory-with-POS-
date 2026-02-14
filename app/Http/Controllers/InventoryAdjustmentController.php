<?php

namespace App\Http\Controllers;

use App\Http\Requests\InventoryAdjustmentRequest;
use App\Models\Product;
use App\Services\StockAdjustmentService;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class InventoryAdjustmentController extends Controller
{
    public function __construct(
        protected StockAdjustmentService $stockAdjustmentService
    ) {
    }

    /**
     * Display the inventory adjustment form
     * Used for damage, loss, recount, initial stock, etc.
     */
    public function create(Request $request): Response
    {
        $this->authorize('can_adjust_stock');

        // Get active products with their categories and variants
        $products = Product::where('is_active', true)
            ->with([
                'category:id,name',
                'variants' => function ($query) {
                    $query->with('inventory')->orderBy('description');
                }
            ])
            ->orderBy('name')
            ->get()
            ->map(function ($product) {
                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'category' => $product->category ? [
                        'id' => $product->category->id,
                        'name' => $product->category->name,
                    ] : null,
                    'variants' => $product->variants->map(fn ($variant) => [
                        'id' => $variant->id,
                        'description' => $variant->description,
                        'unit_price' => $variant->unit_price,
                        'current_stock' => $variant->inventory?->quantity_on_hand ?? 0,
                        'unit' => $product->official_stock_unit ?? $product->base_unit,
                    ])->toArray(),
                ];
            })
            ->toArray();

        // Physical count correction reasons
        $reasons = [
            'physical_count' => 'Physical Count',
            'damage' => 'Damage',
            'spoilage' => 'Spoilage',
            'correction' => 'Correction',
        ];

        return Inertia::render('inventory/adjustment', [
            'products' => $products,
            'reasons' => $reasons,
            'preselectedProductId' => $request->input('product_id'),
            'preselectedVariantId' => $request->input('variant_id'),
        ]);
    }

    /**
     * Process inventory adjustment
     * Creates inventory movement and updates stock
     * 
     * Business Rules:
     * - Quantity can be positive or negative
     * - Reason is REQUIRED
     * - Notes are REQUIRED for audit trail
     * - unit_cost is NULL for adjustments (OUT movements)
     * - Prevents negative stock for OUT movements
     */
    public function store(InventoryAdjustmentRequest $request): RedirectResponse
    {
        $this->authorize('can_adjust_stock');

        try {
            $movement = $this->stockAdjustmentService->adjustStock(
                $request->validated(),
                (int) $request->user()->id
            );
        } catch (\Throwable $e) {
            return redirect()
                ->back()
                ->withInput()
                ->withErrors([
                    'adjustment' => $e->getMessage(),
                ]);
        }

        return redirect()->route('inventory.index')
                        ->with('success', 'Inventory adjusted successfully. Movement #' . $movement->id);
    }
}
