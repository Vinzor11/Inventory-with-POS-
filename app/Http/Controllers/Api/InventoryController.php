<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Services\StockMovementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    public function __construct(
        protected StockMovementService $stockMovementService
    ) {
    }

    /**
     * Display inventory listing
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $search = $request->input('search');
        $categoryId = $request->input('category_id');
        $lowStockOnly = $request->boolean('low_stock_only', false);

        $query = ProductVariant::with(['product.category', 'inventory'])
            ->whereHas('product', function ($q) {
                $q->where('track_stock', true);
            })
            ->orderBy('created_at', 'desc');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhereHas('product', function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%");
                    });
            });
        }

        if ($categoryId) {
            $query->whereHas('product', function ($q) use ($categoryId) {
                $q->where('category_id', $categoryId);
            });
        }

        if ($lowStockOnly) {
            $query->whereHas('inventory', function ($q) {
                $q->where('quantity_on_hand', '<=', 10);
            });
        }

        $variants = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $variants,
        ]);
    }

    /**
     * Get inventory dashboard data
     */
    public function dashboard(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $inventoryTable = (new Inventory())->getTable();
        $agriculturalCategoryId = ProductCategory::query()
            ->where('name', 'Agricultural Products')
            ->where('is_active', true)
            ->value('id');

        $inventoryJoinQuery = DB::table($inventoryTable)
            ->join('product_variants', "{$inventoryTable}.product_variant_id", '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id');

        $inventoryRows = (clone $inventoryJoinQuery)
            ->select([
                "{$inventoryTable}.quantity_on_hand",
                'product_variants.id as product_variant_id',
                'product_variants.purchase_price',
                'products.category_id',
            ])
            ->get();

        $averageCosts = $this->stockMovementService->getAverageCostsForVariants(
            $inventoryRows->pluck('product_variant_id')->all()
        );

        $resolveVariantCost = function ($row) use ($averageCosts): float {
            $averageCost = (float) ($averageCosts->get((int) $row->product_variant_id) ?? 0);
            if ($averageCost <= 0) {
                $averageCost = (float) ($row->purchase_price ?? 0);
            }

            return max(0, $averageCost);
        };

        $totalValue = (float) $inventoryRows->sum(function ($row) use ($resolveVariantCost) {
            return (float) $row->quantity_on_hand * $resolveVariantCost($row);
        });

        if ($agriculturalCategoryId) {
            $hardwareRows = $inventoryRows->filter(
                fn ($row) => (int) $row->category_id !== (int) $agriculturalCategoryId
            );
            $agriculturalRows = $inventoryRows->filter(
                fn ($row) => (int) $row->category_id === (int) $agriculturalCategoryId
            );

            $hardwareStock = (float) $hardwareRows->sum('quantity_on_hand');
            $agriculturalStock = (float) $agriculturalRows->sum('quantity_on_hand');

            $hardwareValue = (float) $hardwareRows->sum(function ($row) use ($resolveVariantCost) {
                return (float) $row->quantity_on_hand * $resolveVariantCost($row);
            });
            $agriculturalValue = (float) $agriculturalRows->sum(function ($row) use ($resolveVariantCost) {
                return (float) $row->quantity_on_hand * $resolveVariantCost($row);
            });
        } else {
            $hardwareStock = (float) $inventoryRows->sum('quantity_on_hand');
            $agriculturalStock = 0;
            $hardwareValue = $totalValue;
            $agriculturalValue = 0;
        }

        // Low stock items
        $lowStockCount = Inventory::where('quantity_on_hand', '<=', 10)->count();

        // Out of stock items
        $outOfStockCount = Inventory::where('quantity_on_hand', '<=', 0)->count();

        // Total items
        $totalItems = Inventory::count();

        // Recent movements
        $recentMovements = InventoryMovement::with(['productVariant.product', 'recordedBy'])
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        // Low stock items list
        $lowStockItems = ProductVariant::with(['product.category', 'inventory'])
            ->whereHas('inventory', function ($q) {
                $q->where('quantity_on_hand', '<=', 10);
            })
            ->limit(10)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'total_value' => $totalValue,
                'hardware_stock' => $hardwareStock,
                'agricultural_stock' => $agriculturalStock,
                'hardware_value' => $hardwareValue,
                'agricultural_value' => $agriculturalValue,
                'low_stock_count' => $lowStockCount,
                'out_of_stock_count' => $outOfStockCount,
                'total_items' => $totalItems,
                'recent_movements' => $recentMovements,
                'low_stock_items' => $lowStockItems,
            ],
        ]);
    }

    /**
     * Get inventory movements
     */
    public function movements(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $type = $request->input('type');
        $reason = $request->input('reason');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $query = InventoryMovement::with(['productVariant.product', 'recordedBy'])
            ->orderBy('created_at', 'desc');

        if ($type && in_array($type, ['IN', 'OUT'])) {
            $query->where('type', $type);
        }

        if ($reason) {
            $query->where('reason', $reason);
        }

        if ($dateFrom) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $movements = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $movements,
        ]);
    }

    /**
     * Show inventory for a variant
     */
    public function show(ProductVariant $variant): JsonResponse
    {
        $variant->load(['product.category', 'inventory']);

        $movements = InventoryMovement::where('product_variant_id', $variant->id)
            ->with('recordedBy')
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'variant' => $variant,
                'movements' => $movements,
            ],
        ]);
    }

    /**
     * Adjust inventory
     */
    public function adjust(Request $request, ProductVariant $variant): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'quantity' => 'required|integer',
            'type' => 'required|string|in:IN,OUT',
            'reason' => 'required|string|in:adjustment,damage,loss,found,correction',
            'notes' => 'nullable|string|max:500',
        ]);

        $currentStock = $variant->inventory->quantity_on_hand ?? 0;
        $adjustmentQty = $request->quantity;

        if ($request->type === 'OUT') {
            if ($adjustmentQty > $currentStock) {
                return response()->json([
                    'success' => false,
                    'message' => "Cannot remove {$adjustmentQty} items. Only {$currentStock} in stock.",
                ], 422);
            }
            $newStock = $currentStock - $adjustmentQty;
        } else {
            $newStock = $currentStock + $adjustmentQty;
        }

        DB::transaction(function () use ($variant, $request, $newStock) {
            InventoryMovement::create([
                'product_variant_id' => $variant->id,
                'quantity' => $request->quantity,
                'type' => $request->type,
                'reason' => $request->reason,
                'notes' => $request->notes,
                'recorded_by_user_id' => $request->user()->id,
            ]);

            Inventory::updateOrCreate(
                ['product_variant_id' => $variant->id],
                ['quantity_on_hand' => $newStock]
            );
        });

        return response()->json([
            'success' => true,
            'message' => 'Inventory adjusted successfully',
            'data' => $variant->fresh()->load(['product', 'inventory']),
        ]);
    }

    /**
     * Set initial stock
     */
    public function setInitialStock(Request $request, ProductVariant $variant): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'quantity' => 'required|integer|min:0',
            'notes' => 'nullable|string|max:500',
        ]);

        $currentStock = $variant->inventory->quantity_on_hand ?? 0;

        if ($currentStock > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Initial stock can only be set when current stock is 0',
            ], 422);
        }

        DB::transaction(function () use ($variant, $request) {
            InventoryMovement::create([
                'product_variant_id' => $variant->id,
                'quantity' => $request->quantity,
                'type' => 'IN',
                'reason' => 'initial',
                'notes' => $request->notes ?? 'Initial stock',
                'recorded_by_user_id' => $request->user()->id,
            ]);

            Inventory::updateOrCreate(
                ['product_variant_id' => $variant->id],
                ['quantity_on_hand' => $request->quantity]
            );
        });

        return response()->json([
            'success' => true,
            'message' => 'Initial stock set successfully',
            'data' => $variant->fresh()->load(['product', 'inventory']),
        ]);
    }

    /**
     * Stock in (bulk)
     */
    public function stockIn(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_variant_id' => 'required|exists:product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.price_apply_mode' => 'nullable|string|in:all,batch',
            'notes' => 'nullable|string|max:500',
        ]);

        DB::transaction(function () use ($request) {
            foreach ($request->items as $item) {
                $variant = ProductVariant::with('inventory')
                    ->lockForUpdate()
                    ->findOrFail($item['product_variant_id']);

                $currentStock = (float) ($variant->inventory->quantity_on_hand ?? 0);
                $quantity = (float) $item['quantity'];
                $unitCost = (float) $item['unit_cost'];
                $totalCost = round($quantity * $unitCost, 4);
                $hasUnitPrice = array_key_exists('unit_price', $item) && $item['unit_price'] !== null;
                $unitPrice = $hasUnitPrice ? (float) $item['unit_price'] : null;
                $priceApplyMode = strtolower($item['price_apply_mode'] ?? 'all');

                $this->stockMovementService->applySignedStockChange($variant, $quantity);
                $newAverageCost = $this->stockMovementService->applyIncomingWeightedAverageCost(
                    $variant,
                    $quantity,
                    $totalCost,
                    $currentStock
                );

                $this->stockMovementService->recordStockMovement(
                    (int) $variant->product_id,
                    'purchase_in',
                    $quantity,
                    $variant->getOfficialStockUnit(),
                    $unitCost,
                    $totalCost,
                    'Purchase',
                    null,
                    $request->notes,
                    $variant->id,
                    (int) $request->user()->id,
                    'purchase'
                );

                $variantUpdates = [
                    'purchase_price' => $newAverageCost > 0 ? $newAverageCost : $unitCost,
                ];

                if ($hasUnitPrice && $unitPrice !== null) {
                    if ($priceApplyMode === 'batch' && $currentStock > 0) {
                        $existingPendingPrice = $variant->pending_unit_price !== null ? (float) $variant->pending_unit_price : null;
                        $existingPendingQuantity = $variant->pending_price_quantity !== null ? (float) $variant->pending_price_quantity : 0.0;
                        $pendingQuantity = $quantity;

                        if ($existingPendingPrice !== null && abs($existingPendingPrice - $unitPrice) < 0.00001) {
                            $pendingQuantity += $existingPendingQuantity;
                        }

                        $variantUpdates['pending_unit_price'] = $unitPrice;
                        $variantUpdates['pending_price_quantity'] = $pendingQuantity;
                    } else {
                        $variantUpdates['unit_price'] = $unitPrice;
                        $variantUpdates['pending_unit_price'] = null;
                        $variantUpdates['pending_price_quantity'] = null;
                    }
                }

                $variant->update($variantUpdates);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Stock added successfully',
        ]);
    }

    /**
     * Authorize admin access
     */
    private function authorizeAdmin(Request $request): void
    {
        if (!$request->user()->isAdmin()) {
            abort(403, 'Only administrators can perform this action.');
        }
    }
}

