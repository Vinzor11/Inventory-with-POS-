<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Skip if table already exists
        if (Schema::hasTable('products')) {
            return;
        }

        // Ensure product_categories table exists first
        if (!Schema::hasTable('product_categories')) {
            throw new \Exception('product_categories table must exist before creating products table. Please run the product_categories migration first.');
        }

        // For SQLite, ensure foreign keys are enabled before creating table
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON');
        }

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('category_id');
            $table->string('name');
            $table->string('brand')->nullable();
            $table->string('sku')->nullable()->unique();
            $table->string('base_unit'); // pcs, bag, sheet, kg, length
            $table->boolean('track_stock')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Add foreign key constraint separately for better error handling
            $table->foreign('category_id')
                  ->references('id')
                  ->on('product_categories')
                  ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
