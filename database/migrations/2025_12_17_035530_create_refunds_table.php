<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Phase 6: Create refunds table
     * Tracks refund transactions for sales
     * 
     * Business Rules:
     * - Refunds are immutable once created
     * - Each refund must have a reason
     * - Refund amount cannot exceed sale total
     * - Only Admin/Manager can process refunds
     */
    public function up(): void
    {
        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->onDelete('restrict');
            $table->decimal('refund_amount', 10, 2);
            $table->text('reason')->nullable();
            $table->foreignId('processed_by_user_id')->constrained('users')->onDelete('restrict');
            $table->enum('type', ['full', 'partial'])->default('partial');
            $table->timestamps();
            
            // Index for faster queries
            $table->index('sale_id');
            $table->index('processed_by_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('refunds');
    }
};
