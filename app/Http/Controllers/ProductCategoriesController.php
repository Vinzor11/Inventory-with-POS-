<?php

namespace App\Http\Controllers;

use App\Models\ProductCategory;
use App\Http\Requests\StoreProductCategoryRequest;
use App\Http\Requests\UpdateProductCategoryRequest;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ProductCategoriesController extends Controller
{
    /**
     * Display a listing of product categories for admin management
     * Used only for grouping products and filtering in POS & inventory views
     */
    public function index(Request $request): Response
    {
        $perPage = $request->integer('per_page', 15);

        $categories = ProductCategory::query()
            ->withCount('products')
            ->when($request->search, function ($query, $search) {
                $query->where('name', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
            })
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();

        return Inertia::render('product-categories/index', [
            'categories' => $categories,
            'filters' => $request->only(['search', 'per_page']),
        ]);
    }

    /**
     * Show the form for creating a new product category
     */
    public function create(): Response
    {
        return Inertia::render('product-categories/create');
    }

    /**
     * Store a newly created product category
     */
    public function store(StoreProductCategoryRequest $request): RedirectResponse
    {
        ProductCategory::create($request->validated());

        return redirect()->route('product-categories.index')
                        ->with('success', 'Product category created successfully.');
    }

    /**
     * Display the specified product category
     */
    public function show(ProductCategory $productCategory): Response
    {
        return Inertia::render('product-categories/show', [
            'category' => $productCategory->load('products'),
        ]);
    }

    /**
     * Show the form for editing the specified product category
     */
    public function edit(ProductCategory $productCategory): Response
    {
        return Inertia::render('product-categories/edit', [
            'category' => $productCategory,
        ]);
    }

    /**
     * Update the specified product category
     */
    public function update(UpdateProductCategoryRequest $request, ProductCategory $productCategory): RedirectResponse
    {
        $productCategory->update($request->validated());

        return redirect()->route('product-categories.index')
                        ->with('success', 'Product category updated successfully.');
    }

    /**
     * Toggle active status of the product category
     * Used for activate/deactivate functionality without full delete
     */
    public function toggle(ProductCategory $productCategory): RedirectResponse
    {
        $productCategory->update([
            'is_active' => !$productCategory->is_active,
        ]);

        $status = $productCategory->is_active ? 'activated' : 'deactivated';

        return redirect()->back()
                        ->with('success', "Product category {$status} successfully.");
    }

    /**
     * Remove the specified product category
     * Only allow if no products are using this category
     */
    public function destroy(ProductCategory $productCategory): RedirectResponse
    {
        if ($productCategory->products()->exists()) {
            return redirect()->back()
                            ->with('error', 'Cannot delete category with existing products.');
        }

        $productCategory->delete();

        return redirect()->route('product-categories.index')
                        ->with('success', 'Product category deleted successfully.');
    }
}
