<?php

namespace App\Http\Controllers;

use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\JsonResponse;

class AgriculturalSalesController extends Controller
{
    /**
     * Get agricultural products stock summary for inventory page
     */
    public function getStockSummary(): JsonResponse
    {
        $agriculturalCategory = ProductCategory::where('name', 'Agricultural Products')
            ->where('is_active', true)
            ->first();

        if (!$agriculturalCategory) {
            return response()->json([
                'total_stock' => 0,
                'variants' => [],
            ]);
        }

        $variants = ProductVariant::whereHas('product', function ($query) use ($agriculturalCategory) {
            $query->where('category_id', $agriculturalCategory->id);
        })
        ->with(['inventory', 'product'])
        ->get();

        $totalStock = 0;
        $variantData = [];

        foreach ($variants as $variant) {
            $stock = $variant->inventory->quantity_on_hand ?? 0;
            $totalStock += $stock;
            
            $variantData[] = [
                'id' => $variant->id,
                'name' => $variant->product->name,
                'description' => $variant->description,
                'unit_price' => $variant->unit_price,
                'base_unit' => $variant->product->base_unit,
                'stock' => $stock,
            ];
        }

        return response()->json([
            'total_stock' => $totalStock,
            'variants' => $variantData,
        ]);
    }

    /**
     * Process Agricultural Products sale - treats all as one product
     */
    public function checkout(Request $request): RedirectResponse
    {
        $request->validate([
            'quantity' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $sale = DB::transaction(function () use ($request) {
                $agriculturalCategory = ProductCategory::where('name', 'Agricultural Products')
                    ->where('is_active', true)
                    ->first();

                if (!$agriculturalCategory) {
                    throw new \Exception("Agricultural Products category not found.");
                }

                // Get all agricultural product variants
                $variants = ProductVariant::whereHas('product', function ($query) use ($agriculturalCategory) {
                    $query->where('category_id', $agriculturalCategory->id);
                })
                ->with(['inventory', 'product'])
                ->get();

                if ($variants->isEmpty()) {
                    throw new \Exception("No agricultural products found.");
                }

                // Calculate total available stock
                $totalAvailableStock = $variants->sum(function ($variant) {
                    return $variant->inventory->quantity_on_hand ?? 0;
                });

                $requestedQuantity = $request->quantity;

                // Validate stock availability
                if ($requestedQuantity > $totalAvailableStock) {
                    throw new \Exception(
                        "Insufficient stock. Available: {$totalAvailableStock}, Requested: {$requestedQuantity}"
                    );
                }

                // Create sale
                $sale = Sale::create([
                    'sale_number' => Sale::generateSaleNumber(),
                    'status' => 'COMPLETED',
                    'payment_status' => 'UNPAID',
                    'is_for_delivery' => false,
                    'subtotal' => 0, // Will calculate from items
                    'total' => 0,
                    'notes' => $request->notes ?? 'Agricultural Products Sale',
                    'cashier_user_id' => auth()->id(),
                ]);

                $totalSaleAmount = 0;
                $remainingQuantity = $requestedQuantity;

                // Distribute quantity across variants proportionally
                foreach ($variants as $variant) {
                    if ($remainingQuantity <= 0) break;

                    $variantStock = $variant->inventory->quantity_on_hand ?? 0;
                    if ($variantStock <= 0) continue;

                    // Take as much as possible from this variant
                    $quantityToDeduct = min($variantStock, $remainingQuantity);
                    
                    $unitPrice = $variant->unit_price;
                    $lineTotal = $quantityToDeduct * $unitPrice;
                    $totalSaleAmount += $lineTotal;

                    // Create sale item
                    SaleItem::create([
                        'sale_id' => $sale->id,
                        'product_variant_id' => $variant->id,
                        'quantity' => $quantityToDeduct,
                        'unit_price' => $unitPrice,
                        'line_total' => $lineTotal,
                    ]);

                    // Deduct inventory
                    $newStock = $variantStock - $quantityToDeduct;

                    // Create inventory movement (OUT)
                    InventoryMovement::create([
                        'product_variant_id' => $variant->id,
                        'quantity' => $quantityToDeduct,
                        'type' => 'OUT',
                        'reason' => 'sale',
                        'reference_id' => $sale->id,
                        'unit_cost' => null,
                        'notes' => "Agricultural Sale: {$sale->sale_number}",
                        'recorded_by_user_id' => auth()->id(),
                    ]);

                    // Update inventory quantity
                    Inventory::updateOrCreate(
                        ['product_variant_id' => $variant->id],
                        ['quantity_on_hand' => $newStock]
                    );

                    $remainingQuantity -= $quantityToDeduct;
                }

                // Update sale totals
                $sale->update([
                    'subtotal' => $totalSaleAmount,
                    'total' => $totalSaleAmount,
                ]);

                $sale->computeSaleStatus();

                return $sale;
            });

            return redirect()->route('inventory.index')
                ->with('success', 'Agricultural products sold successfully.');
        } catch (\Exception $e) {
            throw ValidationException::withMessages([
                'checkout' => [$e->getMessage()],
            ]);
        }
    }
}
