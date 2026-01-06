<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Creates sale_adjustments table for audit trail
     * Records immutable history of sale adjustments when items are canceled
     */
    public function up(): void
    {
        Schema::create('sale_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->onDelete('cascade');
            $table->foreignId('sale_item_id')->constrained('sale_items')->onDelete('cascade');
            $table->decimal('amount_removed', 10, 2); // Amount removed from sale total
            $table->text('reason')->nullable(); // Reason for adjustment
            $table->foreignId('processed_by_user_id')->constrained('users')->onDelete('restrict');
            $table->timestamps();
            
            // Index for faster queries
            $table->index('sale_id');
            $table->index('sale_item_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sale_adjustments');
    }
};
