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
     * Update sales table status enums to new format:
     * 
     * sale_status: COMPLETED | PARTIAL | VOIDED | REFUNDED | PARTIALLY_REFUNDED
     * payment_status: FULLY_PAID | PARTIALLY_PAID | PARTIALLY_REFUNDED | REFUNDED
     * delivery_status: PENDING | PARTIAL | DELIVERED | RETURNED | CANCELED
     * 
     * Business Rules:
     * - sale_status represents transaction lifecycle
     * - payment_status tracks payments and refunds independently
     * - delivery_status is computed based on delivered quantities
     */
    public function up(): void
    {
        $isSqlite = DB::getDriverName() === 'sqlite';

        // Convert to VARCHAR temporarily to avoid case-sensitivity issues with ENUM
        // Step 1: Convert status to VARCHAR
        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN status VARCHAR(20) DEFAULT 'paid'");
        }
        
        // Step 2: Map old values to new values
        DB::statement("UPDATE sales SET status = CASE 
            WHEN status = 'draft' THEN 'PARTIAL'
            WHEN status = 'paid' THEN 'COMPLETED'
            WHEN status = 'void' THEN 'VOIDED'
            WHEN status = 'refunded' THEN 'REFUNDED'
            ELSE status
        END");

        // Step 3: Convert back to ENUM with new values
        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN status ENUM('COMPLETED', 'PARTIAL', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED') DEFAULT 'COMPLETED'");
        }
        
        // Step 4: Convert payment_status to VARCHAR
        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status VARCHAR(20) DEFAULT 'unpaid'");
        }
        
        // Step 5: Map payment_status old values to new values
        DB::statement("UPDATE sales SET payment_status = CASE 
            WHEN payment_status = 'unpaid' THEN 'PARTIALLY_PAID'
            WHEN payment_status = 'partial' THEN 'PARTIALLY_PAID'
            WHEN payment_status = 'paid' THEN 'FULLY_PAID'
            WHEN payment_status = 'partially_refunded' THEN 'PARTIALLY_REFUNDED'
            WHEN payment_status = 'refunded' THEN 'REFUNDED'
            ELSE payment_status
        END");

        // Step 6: Convert back to ENUM with new values
        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status ENUM('FULLY_PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') DEFAULT 'PARTIALLY_PAID'");
        }
        
        // Step 7: Update delivery_status if column exists
        if (Schema::hasColumn('sales', 'delivery_status')) {
            // Convert to VARCHAR
            if (!$isSqlite) {
                DB::statement("ALTER TABLE sales MODIFY COLUMN delivery_status VARCHAR(20)");
            }
            
            // Map old values to new values
            DB::statement("UPDATE sales SET delivery_status = CASE 
                WHEN delivery_status = 'pending' THEN 'PENDING'
                WHEN delivery_status = 'partial' THEN 'PARTIAL'
                WHEN delivery_status = 'delivered' THEN 'DELIVERED'
                WHEN delivery_status = 'returned' THEN 'RETURNED'
                WHEN delivery_status = 'canceled' THEN 'CANCELED'
                ELSE delivery_status
            END");

            // Convert back to ENUM with new values
            if (!$isSqlite) {
                DB::statement("ALTER TABLE sales MODIFY COLUMN delivery_status ENUM('PENDING', 'PARTIAL', 'DELIVERED', 'RETURNED', 'CANCELED')");
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $isSqlite = DB::getDriverName() === 'sqlite';

        // Revert to old format
        DB::statement("UPDATE sales SET status = CASE 
            WHEN status = 'COMPLETED' THEN 'paid'
            WHEN status = 'PARTIAL' THEN 'draft'
            WHEN status = 'VOIDED' THEN 'void'
            WHEN status = 'REFUNDED' THEN 'refunded'
            WHEN status = 'PARTIALLY_REFUNDED' THEN 'paid'
            ELSE status
        END");

        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN status ENUM('draft', 'paid', 'void', 'refunded') DEFAULT 'draft'");
        }
        
        DB::statement("UPDATE sales SET payment_status = CASE 
            WHEN payment_status = 'FULLY_PAID' THEN 'paid'
            WHEN payment_status = 'PARTIALLY_PAID' THEN 'partial'
            WHEN payment_status = 'PARTIALLY_REFUNDED' THEN 'partially_refunded'
            WHEN payment_status = 'REFUNDED' THEN 'refunded'
            ELSE payment_status
        END");

        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status ENUM('unpaid', 'partial', 'paid', 'partially_refunded', 'refunded') DEFAULT 'unpaid'");
        }
        
        if (Schema::hasColumn('sales', 'delivery_status')) {
            DB::statement("UPDATE sales SET delivery_status = CASE 
                WHEN delivery_status = 'PENDING' THEN 'pending'
                WHEN delivery_status = 'PARTIAL' THEN 'partial'
                WHEN delivery_status = 'DELIVERED' THEN 'delivered'
                WHEN delivery_status = 'RETURNED' THEN 'returned'
                WHEN delivery_status = 'CANCELED' THEN 'canceled'
                ELSE delivery_status
            END");

            if (!$isSqlite) {
                DB::statement("ALTER TABLE sales MODIFY COLUMN delivery_status ENUM('pending', 'partial', 'delivered', 'returned', 'canceled')");
            }
        }
    }
};
