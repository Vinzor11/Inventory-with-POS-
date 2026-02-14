<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Models\ProductVariant;
use App\Services\StockMovementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class InventoryDashboardController extends Controller
{
    public function __construct(
        protected StockMovementService $stockMovementService
    ) {
    }

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

            // Total stock quantity across all variants
            $totalStock = Inventory::sum('quantity_on_hand') ?? 0;

            // Calculate inventory value (excluding agricultural products) using
            // movement-based weighted average cost with purchase_price fallback.
            $rows = DB::table('inventory')
                ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
                ->join('products', 'product_variants.product_id', '=', 'products.id')
                ->leftJoin('product_categories', 'products.category_id', '=', 'product_categories.id')
                ->where(function ($query) {
                    $query->whereNull('product_categories.name')
                        ->orWhere('product_categories.name', '!=', 'Agricultural Products');
                })
                ->select([
                    'product_variants.id as product_variant_id',
                    'inventory.quantity_on_hand',
                    'product_variants.purchase_price',
                ])
                ->get();

            $averageCosts = $this->stockMovementService->getAverageCostsForVariants(
                $rows->pluck('product_variant_id')->all()
            );

            $inventoryValue = (float) $rows->sum(function ($row) use ($averageCosts) {
                $averageCost = (float) ($averageCosts->get((int) $row->product_variant_id) ?? 0);
                if ($averageCost <= 0) {
                    $averageCost = (float) ($row->purchase_price ?? 0);
                }

                if ($averageCost <= 0) {
                    return 0;
                }

                return (float) $row->quantity_on_hand * $averageCost;
            });

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
