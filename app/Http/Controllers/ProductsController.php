<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\UpdateProductRequest;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProductsController extends Controller
{
    /**
     * Display a listing of products with category filtering
     * Used in POS and inventory management
     */
    public function index(Request $request): Response
    {
        $perPage = $request->integer('per_page', 15);

        $products = Product::query()
            ->with(['category', 'variants.inventory'])
            ->when($request->search, function ($query, $search) {
                $query->where('name', 'like', "%{$search}%")
                      ->orWhere('brand', 'like', "%{$search}%")
                      ->orWhere('sku', 'like', "%{$search}%");
            })
            ->when($request->category_id, function ($query, $categoryId) {
                $query->where('category_id', $categoryId);
            })
            ->when($request->has('is_active'), function ($query) use ($request) {
                $query->where('is_active', $request->boolean('is_active'));
            })
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();

        $categories = ProductCategory::active()->orderBy('name')->get();

        return Inertia::render('products/index', [
            'products' => $products,
            'categories' => $categories,
            'filters' => $request->only(['search', 'category_id', 'is_active', 'per_page']),
        ]);
    }

    /**
     * Show the form for creating a new product
     */
    public function create(): Response
    {
        $categories = ProductCategory::active()->orderBy('name')->get();

        return Inertia::render('products/create', [
            'categories' => $categories,
        ]);
    }

    /**
     * Store a newly created product
     */
    public function store(StoreProductRequest $request): RedirectResponse
    {
        $data = $request->validated();

        // Handle image upload
        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('products', 'public');
        }

        Product::create($data);

        return redirect()->route('products.index')
                        ->with('success', 'Product created successfully.');
    }

    /**
     * Display the specified product with its variants and inventory
     * This is the detailed view where variants are managed
     */
    public function show(Product $product): Response
    {
        $product->load([
            'category',
            'variants.inventory',
            'variants.inventoryMovements' => function ($query) {
                $query->latest()->limit(10); // Show recent movements
            }
        ]);

        return Inertia::render('products/show', [
            'product' => $product,
        ]);
    }

    /**
     * Show the form for editing the specified product
     */
    public function edit(Product $product): Response
    {
        $categories = ProductCategory::active()->orderBy('name')->get();

        return Inertia::render('products/edit', [
            'product' => $product,
            'categories' => $categories,
        ]);
    }

    /**
     * Update the specified product
     */
    public function update(UpdateProductRequest $request, Product $product): RedirectResponse
    {
        $data = $request->validated();

        // Handle image removal
        if ($request->boolean('remove_image') && $product->image) {
            Storage::disk('public')->delete($product->image);
            $data['image'] = null;
        }

        // Handle new image upload
        if ($request->hasFile('image')) {
            // Delete old image if exists
            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }
            $data['image'] = $request->file('image')->store('products', 'public');
        }

        // Remove remove_image from data as it's not a database field
        unset($data['remove_image']);

        $product->update($data);

        return redirect()->route('products.index')
                        ->with('success', 'Product updated successfully.');
    }

    /**
     * Toggle stock tracking for the product
     */
    public function toggleStock(Product $product): RedirectResponse
    {
        $product->update([
            'track_stock' => !$product->track_stock,
        ]);

        $status = $product->track_stock ? 'enabled' : 'disabled';

        return redirect()->back()
                        ->with('success', "Stock tracking {$status} for this product.");
    }

    /**
     * Toggle active status of the product
     */
    public function toggleActive(Product $product): RedirectResponse
    {
        $product->update([
            'is_active' => !$product->is_active,
        ]);

        $status = $product->is_active ? 'activated' : 'deactivated';

        return redirect()->back()
                        ->with('success', "Product {$status} successfully.");
    }

    /**
     * Remove the specified product
     * Only allow if no variants exist
     */
    public function destroy(Product $product): RedirectResponse
    {
        if ($product->variants()->exists()) {
            return redirect()->back()
                            ->with('error', 'Cannot delete product with existing variants.');
        }

        $product->delete();

        return redirect()->route('products.index')
                        ->with('success', 'Product deleted successfully.');
    }
}
