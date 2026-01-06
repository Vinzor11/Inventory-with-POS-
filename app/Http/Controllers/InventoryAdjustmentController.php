<?php

namespace App\Http\Controllers;

use App\Http\Requests\InventoryAdjustmentRequest;
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

class InventoryAdjustmentController extends Controller
{
    /**
     * Display the inventory adjustment form
     * Used for damage, loss, recount, initial stock, etc.
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

        // Common adjustment reasons
        $reasons = [
            'damage' => 'Damage',
            'loss' => 'Loss/Theft',
            'recount' => 'Recount Correction',
            'initial_stock' => 'Initial Stock',
            'expired' => 'Expired',
            'returned' => 'Returned to Supplier',
            'other' => 'Other',
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
        DB::transaction(function () use ($request) {
            $variant = ProductVariant::findOrFail($request->product_variant_id);
            
            // Get current stock
            $currentStock = $variant->inventory->quantity_on_hand ?? 0;
            $newStock = $currentStock + $request->quantity; // Can be positive or negative

            // Determine movement type based on quantity
            $type = $request->quantity > 0 ? 'IN' : 'OUT';
            $quantity = abs($request->quantity);

            // Prevent negative stock for OUT movements
            if ($newStock < 0) {
                throw new \Exception('Insufficient stock for this adjustment. Current stock: ' . $currentStock);
            }

            // Create inventory movement record (audit trail)
            InventoryMovement::create([
                'product_variant_id' => $variant->id,
                'quantity' => $quantity,
                'type' => $type,
                'reason' => $request->reason,
                'unit_cost' => null, // NULL for adjustments (OUT movements)
                'notes' => $request->notes, // Required for adjustments
                'recorded_by_user_id' => auth()->id(),
            ]);

            // Update inventory quantity
            Inventory::updateOrCreate(
                ['product_variant_id' => $variant->id],
                ['quantity_on_hand' => $newStock]
            );
        });

        return redirect()->route('inventory.index')
                        ->with('success', 'Inventory adjusted successfully.');
    }
}
