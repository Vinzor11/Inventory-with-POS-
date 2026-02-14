<?php

namespace Database\Seeders;

use App\Models\ProductCategory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Inventory;
use Illuminate\Database\Seeder;

class AgriculturalProductsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * Creates Agricultural Products category and product variants for copra/coconut/bagol
     * These products are excluded from POS but track inventory via weigh-ins
     */
    public function run(): void
    {
        // Create Agricultural Products category
        $agriculturalCategory = ProductCategory::firstOrCreate(
            ['name' => 'Agricultural Products'],
            [
                'description' => 'Agricultural products (copra, coconut, bagol) - excluded from POS',
                'is_active' => true,
            ]
        );

        // Create Cooked Copra Product
        $cookedCopraProduct = Product::firstOrCreate(
            ['sku' => 'COOKED-COPRA'],
            [
                'category_id' => $agriculturalCategory->id,
                'name' => 'Cooked Copra',
                'brand' => null,
                'base_unit' => 'kg',
                'track_stock' => true,
                'is_active' => true,
            ]
        );

        // Create Uncooked Copra Product
        $uncookedCopraProduct = Product::firstOrCreate(
            ['sku' => 'UNCOOKED-COPRA'],
            [
                'category_id' => $agriculturalCategory->id,
                'name' => 'Uncooked Copra',
                'brand' => null,
                'base_unit' => 'kg',
                'track_stock' => true,
                'is_active' => true,
            ]
        );

        // Create Coconut Product
        $coconutProduct = Product::firstOrCreate(
            ['sku' => 'COCONUT'],
            [
                'category_id' => $agriculturalCategory->id,
                'name' => 'Coconut',
                'brand' => null,
                'base_unit' => 'pcs',
                'track_stock' => true,
                'is_active' => true,
            ]
        );

        // Create Bagol Product
        $bagolImagePath = null;
        if (file_exists(public_path('bagol.jpg'))) {
            $bagolImagePath = '/bagol.jpg';
        } elseif (file_exists(public_path('bagol.jpeg'))) {
            $bagolImagePath = '/bagol.jpeg';
        } elseif (file_exists(public_path('bagol.png'))) {
            $bagolImagePath = '/bagol.png';
        } elseif (file_exists(storage_path('app/public/products/bagol.jpg'))) {
            $bagolImagePath = 'products/bagol.jpg';
        }

        $bagolProduct = Product::firstOrCreate(
            ['sku' => 'BAGOL'],
            [
                'category_id' => $agriculturalCategory->id,
                'name' => 'Bagol',
                'brand' => null,
                'base_unit' => 'kg',
                'track_stock' => true,
                'is_active' => true,
                'image' => $bagolImagePath,
            ]
        );
        if ($bagolImagePath && $bagolProduct->image !== $bagolImagePath) {
            $bagolProduct->update(['image' => $bagolImagePath]);
        }

        // Create Product Variants (one variant per product for simplicity)
        $cookedCopraVariant = ProductVariant::firstOrCreate(
            [
                'product_id' => $cookedCopraProduct->id,
                'description' => 'Cooked Copra',
            ],
            [
                'unit_price' => 0, // Will be updated from weigh-in prices
                'purchase_price' => null,
            ]
        );

        $uncookedCopraVariant = ProductVariant::firstOrCreate(
            [
                'product_id' => $uncookedCopraProduct->id,
                'description' => 'Uncooked Copra',
            ],
            [
                'unit_price' => 0, // Will be updated from weigh-in prices
                'purchase_price' => null,
            ]
        );

        $coconutVariant = ProductVariant::firstOrCreate(
            [
                'product_id' => $coconutProduct->id,
                'description' => 'Coconut',
            ],
            [
                'unit_price' => 0, // Will be updated from weigh-in prices
                'purchase_price' => null,
            ]
        );

        $bagolVariant = ProductVariant::firstOrCreate(
            [
                'product_id' => $bagolProduct->id,
                'description' => 'Bagol',
            ],
            [
                'unit_price' => 0, // Will be updated from weigh-in prices
                'purchase_price' => null,
            ]
        );

        // Initialize inventory for variants (start at 0)
        Inventory::firstOrCreate(
            ['product_variant_id' => $cookedCopraVariant->id],
            ['quantity_on_hand' => 0]
        );

        Inventory::firstOrCreate(
            ['product_variant_id' => $uncookedCopraVariant->id],
            ['quantity_on_hand' => 0]
        );

        Inventory::firstOrCreate(
            ['product_variant_id' => $coconutVariant->id],
            ['quantity_on_hand' => 0]
        );

        Inventory::firstOrCreate(
            ['product_variant_id' => $bagolVariant->id],
            ['quantity_on_hand' => 0]
        );
    }
}

