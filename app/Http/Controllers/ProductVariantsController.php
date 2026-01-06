<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Inventory;
use App\Http\Requests\StoreProductVariantRequest;
use App\Http\Requests\UpdateProductVariantRequest;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

class ProductVariantsController extends Controller
{
    /**
     * Store a newly created product variant
     * Creates variant and initializes inventory record
     */
    public function store(StoreProductVariantRequest $request, Product $product): RedirectResponse
    {
        DB::transaction(function () use ($request, $product) {
            // Create the variant
            $variant = $product->variants()->create($request->validated());

            // Initialize inventory record
            Inventory::create([
                'product_variant_id' => $variant->id,
                'quantity_on_hand' => 0,
            ]);
        });

        return redirect()->back()
                        ->with('success', 'Product variant created successfully.');
    }

    /**
     * Update the specified product variant
     * With shallow routing, product parameter is not needed in URL but kept for consistency
     */
    public function update(UpdateProductVariantRequest $request, ProductVariant $variant): RedirectResponse
    {
        $variant->update($request->validated());

        return redirect()->back()
                        ->with('success', 'Product variant updated successfully.');
    }

    /**
     * Remove the specified product variant
     * Only allow if no inventory movements exist
     * With shallow routing, product parameter is not needed in URL
     */
    public function destroy(ProductVariant $variant): RedirectResponse
    {
        if ($variant->inventoryMovements()->exists()) {
            return redirect()->back()
                            ->with('error', 'Cannot delete variant with inventory history.');
        }

        DB::transaction(function () use ($variant) {
            // Delete inventory record first (cascade will handle this, but being explicit)
            $variant->inventory()->delete();
            $variant->delete();
        });

        return redirect()->back()
                        ->with('success', 'Product variant deleted successfully.');
    }
}
