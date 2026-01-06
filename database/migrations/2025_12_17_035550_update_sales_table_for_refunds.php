<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Phase 6: Update sales table to support refund statuses
     * 
     * Business Rules:
     * - status: draft, paid, void, refunded
     * - payment_status: unpaid, partial, paid, partially_refunded, refunded
     * - delivery_status: pending, partial, delivered, returned, canceled
     */
    public function up(): void
    {
        // Update status enum to include 'refunded'
        DB::statement("ALTER TABLE sales MODIFY COLUMN status ENUM('draft', 'paid', 'void', 'refunded') DEFAULT 'draft'");
        
        // Update payment_status enum to include refund statuses
        DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status ENUM('unpaid', 'partial', 'paid', 'partially_refunded', 'refunded') DEFAULT 'unpaid'");
        
        // Update delivery_status enum to include return/cancel statuses
        Schema::table('sales', function (Blueprint $table) {
            // Check if column exists before modifying
            if (Schema::hasColumn('sales', 'delivery_status')) {
                DB::statement("ALTER TABLE sales MODIFY COLUMN delivery_status ENUM('pending', 'partial', 'delivered', 'returned', 'canceled')");
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert status enum
        DB::statement("ALTER TABLE sales MODIFY COLUMN status ENUM('draft', 'paid', 'void') DEFAULT 'draft'");
        
        // Revert payment_status enum
        DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status ENUM('unpaid', 'partial', 'paid') DEFAULT 'unpaid'");
        
        // Revert delivery_status enum
        if (Schema::hasColumn('sales', 'delivery_status')) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN delivery_status ENUM('pending', 'partial', 'delivered')");
        }
    }
};
