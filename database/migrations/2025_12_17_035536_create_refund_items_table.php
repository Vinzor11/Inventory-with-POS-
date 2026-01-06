<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Phase 6: Create refund_items table
     * Tracks individual items being refunded
     * 
     * Business Rules:
     * - Links refund to specific sale items
     * - Quantity refunded cannot exceed quantity sold
     * - Inventory is restored only for returned items
     */
    public function up(): void
    {
        Schema::create('refund_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('refund_id')->constrained('refunds')->onDelete('cascade');
            $table->foreignId('sale_item_id')->constrained('sale_items')->onDelete('restrict');
            $table->foreignId('product_variant_id')->constrained('product_variants')->onDelete('restrict');
            $table->decimal('quantity', 10, 2);
            $table->decimal('amount', 10, 2); // Refund amount for this item
            $table->boolean('restore_inventory')->default(true); // Whether to restore inventory
            $table->timestamps();
            
            // Indexes for faster queries
            $table->index('refund_id');
            $table->index('sale_item_id');
            $table->index('product_variant_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('refund_items');
    }
};
