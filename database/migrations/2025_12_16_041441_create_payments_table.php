<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Phase 3.5: Create payments table
     * Tracks all payments received for sales
     * Supports partial payments, full payments, and refunds (negative amounts)
     * 
     * Business Rules:
     * - Payments are additive records (never edited or deleted)
     * - Refunds are recorded as negative payments
     * - Total payments cannot exceed sale.total
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->onDelete('cascade');
            $table->decimal('amount', 10, 2); // Can be negative for refunds
            $table->enum('payment_method', ['cash', 'gcash', 'cheque', 'credit'])->default('cash');
            $table->foreignId('received_by_user_id')->constrained('users')->onDelete('restrict');
            $table->timestamp('received_at')->useCurrent();
            $table->text('notes')->nullable();
            $table->timestamps();

            // Index for faster queries
            $table->index('sale_id');
            $table->index('received_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
