<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Phase 3.5: Add payment_status to sales table
     * Tracks payment status: unpaid, partial, or paid
     * 
     * Business Rules:
     * - Automatically computed based on sum of payments
     * - Updated after every payment insert
     * - unpaid: sum(payments) = 0
     * - partial: 0 < sum(payments) < sale.total
     * - paid: sum(payments) = sale.total
     */
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->enum('payment_status', ['unpaid', 'partial', 'paid'])->default('unpaid')->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn('payment_status');
        });
    }
};
