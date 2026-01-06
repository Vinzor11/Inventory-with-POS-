<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Models\ProductVariant;
use App\Models\ProductCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class InventoryDashboardController extends Controller
{
    /**
     * Display inventory dashboard
     * Shows overview statistics and low stock alerts
     * 
     * Metrics:
     * - Total product variants
     * - Total stock quantity
     * - Low stock list (configurable threshold)
     */
    public function index(Request $request): Response
    {
        try {
            // Configurable low stock threshold (default: 5)
            $lowStockThreshold = $request->integer('low_stock_threshold', 5);

            // Total product variants
            $totalVariants = ProductVariant::count();

            // Get agricultural category ID
            $agriculturalCategoryId = ProductCategory::where('name', 'Agricultural Products')
                ->where('is_active', true)
                ->value('id');

            // Total stock quantity across all variants
            $totalStock = Inventory::sum('quantity_on_hand') ?? 0;

            // Calculate inventory value (excluding agricultural products, using purchase_price)
            // Only include variants that have purchase_price set and are not agricultural products
            $query = DB::table('inventory')
                ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
                ->join('products', 'product_variants.product_id', '=', 'products.id')
                ->join('product_categories', 'products.category_id', '=', 'product_categories.id')
                ->whereNotNull('product_variants.purchase_price')
                ->where('product_variants.purchase_price', '>', 0)
                ->where('product_categories.name', '!=', 'Agricultural Products');
            
            $inventoryValue = $query->sum(DB::raw('inventory.quantity_on_hand * product_variants.purchase_price')) ?? 0;

            // Low stock items (quantity <= threshold)
            $lowStockItems = ProductVariant::query()
                ->with(['product.category', 'inventory'])
                ->whereHas('inventory', function ($query) use ($lowStockThreshold) {
                    $query->where('quantity_on_hand', '<=', $lowStockThreshold);
                })
                ->join('products', 'product_variants.product_id', '=', 'products.id')
                ->select('product_variants.*')
                ->orderBy('products.name')
                ->limit(20) // Show top 20 low stock items
                ->get();

            return Inertia::render('inventory/dashboard', [
                'totalVariants' => $totalVariants,
                'totalStock' => $totalStock,
                'inventoryValue' => $inventoryValue,
                'lowStockItems' => $lowStockItems,
                'lowStockThreshold' => $lowStockThreshold,
            ]);
        } catch (\Exception $e) {
            Log::error('InventoryDashboardController@index error: ' . $e->getMessage());
            throw $e;
        }
    }
}
