<?php

namespace App\Http\Controllers;

use App\Models\ProductVariant;
use App\Models\ProductCategory;
use App\Models\Product;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Services\StockMovementService;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function __construct(
        protected StockMovementService $stockMovementService
    ) {
    }

    /**
     * Display inventory overview for all variants
     * Shows current stock levels across all products
     */
    public function index(Request $request): Response
    {
        $perPage = $request->integer('per_page', 20);
        $lowStockThreshold = $request->integer('low_stock_threshold', 5);

        // Show all product variants (including inactive products and those without inventory)
        $inventory = ProductVariant::query()
            ->with(['product.category', 'inventory', 'inventoryMovements' => function ($query) {
                $query->latest()->limit(5); // Recent movements
            }])
            ->when($request->search, function ($query, $search) {
                $query->whereHas('product', function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('brand', 'like', "%{$search}%")
                      ->orWhere('sku', 'like', "%{$search}%");
                });
            })
            ->when($request->category_id, function ($query, $categoryId) {
                $query->whereHas('product', function ($q) use ($categoryId) {
                    $q->where('category_id', $categoryId);
                });
            })
            ->when($request->has('low_stock'), function ($query) {
                $query->whereHas('inventory', function ($inventoryQuery) {
                    $inventoryQuery->where('quantity_on_hand', '<=', 5); // Configurable threshold
                });
            })
            ->orderBy('products.name')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->select('product_variants.*') // Select only product_variants columns to avoid conflicts
            ->paginate($perPage)
            ->withQueryString();

        $categories = ProductCategory::active()->orderBy('name')->get();

        // Dashboard metrics
        $totalVariants = ProductVariant::count();
        
        // Get agricultural category ID
        $agriculturalCategoryId = ProductCategory::where('name', 'Agricultural Products')
            ->where('is_active', true)
            ->value('id');
        
        // Separate stock totals
        $hardwareStock = Inventory::query()
            ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->when($agriculturalCategoryId, function ($query) use ($agriculturalCategoryId) {
                $query->where('products.category_id', '!=', $agriculturalCategoryId);
            })
            ->sum('inventory.quantity_on_hand') ?? 0;
        
        $agriculturalStock = Inventory::query()
            ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->when($agriculturalCategoryId, function ($query) use ($agriculturalCategoryId) {
                $query->where('products.category_id', '=', $agriculturalCategoryId);
            })
            ->sum('inventory.quantity_on_hand') ?? 0;
        
        $totalStock = $hardwareStock + $agriculturalStock;
        
        // Calculate inventory value (excluding agricultural products) using
        // movement-based weighted average cost with purchase_price fallback.
        $rows = DB::table('inventory')
            ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->when($agriculturalCategoryId, function ($query) use ($agriculturalCategoryId) {
                $query->where('products.category_id', '!=', $agriculturalCategoryId);
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
        
        $lowStockItems = ProductVariant::query()
            ->with(['product.category', 'inventory'])
            ->whereHas('inventory', function ($query) use ($lowStockThreshold) {
                $query->where('quantity_on_hand', '<=', $lowStockThreshold);
            })
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->select('product_variants.*')
            ->orderBy('products.name')
            ->limit(20)
            ->get();

        // Get products for modals (stock-in and adjustment)
        $products = \App\Models\Product::where('is_active', true)
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
        $adjustmentReasons = [
            'physical_count' => 'Physical Count',
            'damage' => 'Damage',
            'spoilage' => 'Spoilage',
            'correction' => 'Correction',
        ];

        return Inertia::render('inventory/index', [
            'inventory' => $inventory,
            'categories' => $categories,
            'filters' => $request->only(['search', 'category_id', 'low_stock', 'per_page']),
            'dashboard' => [
                'totalVariants' => $totalVariants,
                'totalStock' => $totalStock,
                'hardwareStock' => $hardwareStock,
                'agriculturalStock' => $agriculturalStock,
                'inventoryValue' => $inventoryValue,
                'lowStockItems' => $lowStockItems,
                'lowStockThreshold' => $lowStockThreshold,
            ],
            'products' => $products,
            'adjustmentReasons' => $adjustmentReasons,
        ]);
    }

    /**
     * Display detailed inventory movements for a specific variant
     * Shows complete audit trail for stock changes
     */
    public function show(ProductVariant $variant): Response
    {
        $variant->load([
            'product.category',
            'inventory',
            'inventoryMovements' => function ($query) {
                $query->with('recordedBy:id,name,email')
                      ->orderBy('created_at', 'desc');
            }
        ]);

        return Inertia::render('inventory/show', [
            'variant' => $variant,
        ]);
    }

    /**
     * Adjust inventory stock level
     * Creates inventory movement record and updates stock
     */
    public function adjust(Request $request, ProductVariant $variant): RedirectResponse
    {
        $request->validate([
            'quantity' => 'required|numeric|min:0',
            'type' => 'required|in:IN,OUT',
            'reason' => 'required|string|max:255',
            'unit_cost' => 'required|numeric|min:0',
            'reference_id' => 'nullable|integer',
        ]);

        DB::transaction(function () use ($request, $variant) {
            $quantity = $request->quantity;
            $type = $request->type;

            // Calculate new stock level
            $currentStock = $variant->inventory->quantity_on_hand ?? 0;
            $newStock = $type === 'IN'
                ? $currentStock + $quantity
                : $currentStock - $quantity;

            // Prevent negative stock
            if ($newStock < 0) {
                throw new \Exception('Insufficient stock for this operation.');
            }

            // Update inventory
            $variant->inventory()->update([
                'quantity_on_hand' => $newStock,
            ]);

            // Record movement
            InventoryMovement::create([
                'product_variant_id' => $variant->id,
                'quantity' => $quantity,
                'type' => $type,
                'reason' => $request->reason,
                'reference_id' => $request->reference_id,
                'unit_cost' => $request->unit_cost,
                'recorded_by_user_id' => auth()->id(),
            ]);
        });

        return redirect()->back()
                        ->with('success', 'Inventory adjusted successfully.');
    }

    /**
     * Set initial stock for a variant
     * Special case for setting up initial inventory
     */
    public function setInitialStock(Request $request, ProductVariant $variant): RedirectResponse
    {
        $request->validate([
            'quantity' => 'required|numeric|min:0',
            'unit_cost' => 'required|numeric|min:0',
        ]);

        DB::transaction(function () use ($request, $variant) {
            // Set initial stock
            $variant->inventory()->update([
                'quantity_on_hand' => $request->quantity,
            ]);

            // Record initial movement
            InventoryMovement::create([
                'product_variant_id' => $variant->id,
                'quantity' => $request->quantity,
                'type' => 'IN',
                'reason' => 'initial_stock',
                'unit_cost' => $request->unit_cost,
                'recorded_by_user_id' => auth()->id(),
            ]);
        });

        return redirect()->back()
                        ->with('success', 'Initial stock set successfully.');
    }
}
