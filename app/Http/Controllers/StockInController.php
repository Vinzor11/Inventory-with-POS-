<?php

namespace App\Http\Controllers;

use App\Http\Requests\StockInRequest;
use App\Models\Product;
use App\Services\PurchaseService;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class StockInController extends Controller
{
    public function __construct(
        protected PurchaseService $purchaseService
    ) {
    }

    /**
     * Display the stock-in form
     * Shows product and variant selection for receiving stock
     */
    public function create(Request $request): Response
    {
        $this->authorize('can_receive_stock');

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

        return Inertia::render('inventory/stock-in', [
            'products' => $products,
            'preselectedProductId' => $request->input('product_id'),
            'preselectedVariantId' => $request->input('variant_id'),
        ]);
    }

    /**
     * Process stock-in operation
     * Creates inventory movement (type IN) and updates stock
     * 
     * Business Rules:
     * - unit_cost is REQUIRED for IN movements
     * - Creates movement record before updating inventory
     * - Uses database transaction for data integrity
     */
    public function store(StockInRequest $request): RedirectResponse
    {
        $this->authorize('can_receive_stock');

        try {
            $receipt = $this->purchaseService->receiveStock(
                $request->validated(),
                (int) $request->user()->id
            );
        } catch (\Throwable $e) {
            return redirect()
                ->back()
                ->withInput()
                ->withErrors([
                    'stock_in' => $e->getMessage(),
                ]);
        }

        // Preserve the dashboard state in session and redirect
        return redirect()->route('inventory.index')
                        ->with('success', 'Stock received successfully. Ref: ' . $receipt->reference_code)
                        ->with('preserve_ui_state', true);
    }
}
