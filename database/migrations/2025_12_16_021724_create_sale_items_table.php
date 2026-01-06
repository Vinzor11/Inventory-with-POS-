<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Phase 3: Create sale_items table
     * Stores individual line items for each sale
     * Links to product_variants to track what was sold
     */
    public function up(): void
    {
        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->onDelete('cascade');
            $table->foreignId('product_variant_id')->constrained('product_variants')->onDelete('restrict');
            $table->decimal('quantity', 10, 2); // Can sell fractional quantities (e.g., 0.5 kg)
            $table->decimal('unit_price', 10, 2); // Price at time of sale (copied from variant)
            $table->decimal('line_total', 10, 2); // quantity * unit_price
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sale_items');
    }
};

