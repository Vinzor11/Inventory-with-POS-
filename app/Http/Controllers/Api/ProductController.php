<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    /**
     * Display a listing of products
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
            'search' => ['nullable', 'string', 'max:80'],
            'category_id' => ['nullable', 'integer'],
            'active_only' => ['nullable', 'boolean'],
            'compact' => ['nullable', 'boolean'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 30);
        $search = $validated['search'] ?? null;
        $categoryId = $validated['category_id'] ?? null;
        $activeOnly = (bool) ($validated['active_only'] ?? false);
        $compact = (bool) ($validated['compact'] ?? false);

        if ($compact) {
            $query = ProductVariant::query()
                ->join('products', 'products.id', '=', 'product_variants.product_id')
                ->leftJoin('product_categories', 'product_categories.id', '=', 'products.category_id')
                ->leftJoin('inventory', 'inventory.product_variant_id', '=', 'product_variants.id')
                ->select([
                    'product_variants.id',
                    'products.sku',
                    'product_variants.description',
                    'product_variants.unit_price',
                    'products.id as product_id',
                    'products.name as product_name',
                    'products.image',
                    'products.base_unit',
                    'products.is_active',
                    'products.category_id',
                    'product_categories.name as category_name',
                    'inventory.quantity_on_hand',
                    'product_variants.updated_at',
                ])
                ->orderBy('products.name')
                ->orderBy('product_variants.id');

            if ($search) {
                $query->where(function ($q) use ($search): void {
                    $q->where('products.name', 'like', "%{$search}%")
                        ->orWhere('product_variants.description', 'like', "%{$search}%")
                        ->orWhere('products.sku', 'like', "%{$search}%");
                });
            }

            if ($categoryId) {
                $query->where('products.category_id', $categoryId);
            }

            if ($activeOnly) {
                $query->where('products.is_active', true);
            }

            $page = $query->simplePaginate($perPage)->appends($request->query());

            return response()->json([
                'success' => true,
                'data' => $page,
            ]);
        }

        $query = Product::with(['category', 'variants.inventory'])
            ->orderBy('name');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($categoryId) {
            $query->where('category_id', $categoryId);
        }

        if ($activeOnly) {
            $query->where('is_active', true);
        }

        $products = $query->paginate($perPage)->appends($request->query());

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }

    /**
     * Store a newly created product
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'category_id' => 'required|exists:product_categories,id',
            'base_unit' => 'required|string|max:50',
            'image_url' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
            'track_stock' => 'nullable|boolean',
        ]);

        $product = Product::create([
            'name' => $request->name,
            'description' => $request->description,
            'category_id' => $request->category_id,
            'base_unit' => $request->base_unit,
            'image_url' => $request->image_url,
            'is_active' => $request->boolean('is_active', true),
            'track_stock' => $request->boolean('track_stock', true),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Product created successfully',
            'data' => $product->load('category'),
        ], 201);
    }

    /**
     * Display the specified product
     */
    public function show(Product $product): JsonResponse
    {
        $product->load(['category', 'variants.inventory']);

        return response()->json([
            'success' => true,
            'data' => $product,
        ]);
    }

    /**
     * Update the specified product
     */
    public function update(Request $request, Product $product): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'category_id' => 'required|exists:product_categories,id',
            'base_unit' => 'required|string|max:50',
            'image_url' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
            'track_stock' => 'nullable|boolean',
        ]);

        $product->update([
            'name' => $request->name,
            'description' => $request->description,
            'category_id' => $request->category_id,
            'base_unit' => $request->base_unit,
            'image_url' => $request->image_url,
            'is_active' => $request->boolean('is_active', $product->is_active),
            'track_stock' => $request->boolean('track_stock', $product->track_stock),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Product updated successfully',
            'data' => $product->load('category'),
        ]);
    }

    /**
     * Remove the specified product
     */
    public function destroy(Request $request, Product $product): JsonResponse
    {
        $this->authorizeAdmin($request);

        if ($product->variants()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete product with existing variants',
            ], 422);
        }

        $product->delete();

        return response()->json([
            'success' => true,
            'message' => 'Product deleted successfully',
        ]);
    }

    /**
     * Get product variants
     */
    public function getVariants(Product $product): JsonResponse
    {
        $variants = $product->variants()->with('inventory')->get();

        return response()->json([
            'success' => true,
            'data' => $variants,
        ]);
    }

    /**
     * Store a new variant for a product
     */
    public function storeVariant(Request $request, Product $product): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'sku' => 'nullable|string|max:100|unique:product_variants,sku',
            'description' => 'required|string|max:255',
            'unit_price' => 'required|numeric|min:0',
            'cost_price' => 'nullable|numeric|min:0',
        ]);

        $variant = $product->variants()->create([
            'sku' => $request->sku,
            'description' => $request->description,
            'unit_price' => $request->unit_price,
            'cost_price' => $request->cost_price,
        ]);

        // Create inventory record
        Inventory::create([
            'product_variant_id' => $variant->id,
            'quantity_on_hand' => 0,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Variant created successfully',
            'data' => $variant->load('inventory'),
        ], 201);
    }

    /**
     * Update a variant
     */
    public function updateVariant(Request $request, Product $product, ProductVariant $variant): JsonResponse
    {
        $this->authorizeAdmin($request);

        if ($variant->product_id !== $product->id) {
            return response()->json([
                'success' => false,
                'message' => 'Variant does not belong to this product',
            ], 422);
        }

        $request->validate([
            'sku' => 'nullable|string|max:100|unique:product_variants,sku,' . $variant->id,
            'description' => 'required|string|max:255',
            'unit_price' => 'required|numeric|min:0',
            'cost_price' => 'nullable|numeric|min:0',
        ]);

        $variant->update([
            'sku' => $request->sku,
            'description' => $request->description,
            'unit_price' => $request->unit_price,
            'cost_price' => $request->cost_price,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Variant updated successfully',
            'data' => $variant->load('inventory'),
        ]);
    }

    /**
     * Delete a variant
     */
    public function destroyVariant(Request $request, Product $product, ProductVariant $variant): JsonResponse
    {
        $this->authorizeAdmin($request);

        if ($variant->product_id !== $product->id) {
            return response()->json([
                'success' => false,
                'message' => 'Variant does not belong to this product',
            ], 422);
        }

        $variant->delete();

        return response()->json([
            'success' => true,
            'message' => 'Variant deleted successfully',
        ]);
    }

    /**
     * Toggle product stock tracking
     */
    public function toggleStock(Request $request, Product $product): JsonResponse
    {
        $this->authorizeAdmin($request);

        $product->update([
            'track_stock' => !$product->track_stock,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Stock tracking toggled successfully',
            'data' => $product,
        ]);
    }

    /**
     * Toggle product active status
     */
    public function toggleActive(Request $request, Product $product): JsonResponse
    {
        $this->authorizeAdmin($request);

        $product->update([
            'is_active' => !$product->is_active,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Product status toggled successfully',
            'data' => $product,
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

