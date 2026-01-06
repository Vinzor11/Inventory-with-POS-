<?php

namespace App\Http\Controllers;

use App\Http\Requests\StockInRequest;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class StockInController extends Controller
{
    /**
     * Display the stock-in form
     * Shows product and variant selection for receiving stock
     */
    public function create(Request $request): Response
    {
        // Get active products with their categories and variants
        $products = Product::where('is_active', true)
            ->with([
                'category:id,name',
                'variants' => function ($query) {
                    $query->orderBy('description');
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
                    'variants' => $product->variants->map(function ($variant) {
                        return [
                            'id' => $variant->id,
                            'description' => $variant->description,
                            'unit_price' => $variant->unit_price,
                        ];
                    })->toArray(),
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
        DB::transaction(function () use ($request) {
            $variant = ProductVariant::findOrFail($request->product_variant_id);
            
            // Get current stock
            $currentStock = $variant->inventory->quantity_on_hand ?? 0;
            $newStock = $currentStock + $request->quantity;

            // Create inventory movement record (audit trail)
            InventoryMovement::create([
                'product_variant_id' => $variant->id,
                'quantity' => $request->quantity,
                'type' => 'IN',
                'reason' => 'purchase',
                'unit_cost' => $request->unit_cost, // Required for IN
                'notes' => $request->notes,
                'recorded_by_user_id' => auth()->id(),
            ]);

            // Update purchase_price to reflect the latest purchase cost
            $variant->update([
                'purchase_price' => $request->unit_cost,
            ]);

            // Update inventory quantity
            Inventory::updateOrCreate(
                ['product_variant_id' => $variant->id],
                ['quantity_on_hand' => $newStock]
            );
        });

        // Preserve the dashboard state in session and redirect
        return redirect()->route('inventory.index')
                        ->with('success', 'Stock received successfully.')
                        ->with('preserve_ui_state', true);
    }
}
