<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Database\Seeders\ProductSeeder;
use Database\Seeders\AgriculturalProductsSeeder;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Ensures product categories, products, and variants are seeded.
     * This migration runs the seeders if products don't exist yet.
     */
    public function up(): void
    {
        // Check if products table exists
        if (!Schema::hasTable('products')) {
            return; // Table doesn't exist yet, migrations will handle it
        }

        // Check if any products exist (excluding agricultural products)
        $agriculturalCategoryId = DB::table('product_categories')
            ->where('name', 'Agricultural Products')
            ->value('id');
        
        $hasProducts = DB::table('products')
            ->when($agriculturalCategoryId, function ($query) use ($agriculturalCategoryId) {
                return $query->where('category_id', '!=', $agriculturalCategoryId);
            })
            ->exists();

        // If no products exist, run the ProductSeeder
        if (!$hasProducts) {
            try {
                $productSeeder = new ProductSeeder();
                $productSeeder->run();
            } catch (\Exception $e) {
                \Log::warning("ProductSeeder failed: " . $e->getMessage());
                // Re-throw in production to fail fast
                if (config('app.env') === 'production') {
                    throw $e;
                }
            }
        }

        // Check if Agricultural Products category exists
        $hasAgriculturalCategory = DB::table('product_categories')
            ->where('name', 'Agricultural Products')
            ->exists();

        // If agricultural category doesn't exist, run AgriculturalProductsSeeder
        if (!$hasAgriculturalCategory) {
            try {
                $agriculturalSeeder = new AgriculturalProductsSeeder();
                $agriculturalSeeder->run();
            } catch (\Exception $e) {
                \Log::warning("AgriculturalProductsSeeder failed: " . $e->getMessage());
                // Re-throw in production to fail fast
                if (config('app.env') === 'production') {
                    throw $e;
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     * 
     * Note: This does not delete seeded data, as seeders should be idempotent.
     */
    public function down(): void
    {
        // Seeders are idempotent, so no need to reverse
        // The data will remain in the database
    }
};
