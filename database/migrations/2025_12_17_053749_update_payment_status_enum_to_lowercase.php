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
     * Convert payment_status enum from uppercase to lowercase values:
     * - FULLY_PAID -> paid
     * - PARTIALLY_PAID -> partial (or unpaid if no payment)
     * - PARTIALLY_REFUNDED -> partially_refunded
     * - REFUNDED -> refunded
     */
    public function up(): void
    {
        $isSqlite = DB::getDriverName() === 'sqlite';

        // Step 1: Convert payment_status to VARCHAR temporarily
        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status VARCHAR(20) DEFAULT 'unpaid'");
        }
        
        // Step 2: Map uppercase values to lowercase values
        // Note: PARTIALLY_PAID will be mapped to 'partial', but updatePaymentStatus() 
        // will correct it to 'unpaid' if there are no payments
        DB::statement("UPDATE sales SET payment_status = CASE 
            WHEN payment_status = 'FULLY_PAID' THEN 'paid'
            WHEN payment_status = 'PARTIALLY_PAID' THEN 'partial'
            WHEN payment_status = 'PARTIALLY_REFUNDED' THEN 'partially_refunded'
            WHEN payment_status = 'REFUNDED' THEN 'refunded'
            ELSE LOWER(payment_status)
        END");

        // Step 3: Convert back to ENUM with lowercase values
        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status ENUM('unpaid', 'partial', 'paid', 'partially_refunded', 'refunded') DEFAULT 'unpaid'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $isSqlite = DB::getDriverName() === 'sqlite';

        // Convert back to uppercase
        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status VARCHAR(20) DEFAULT 'PARTIALLY_PAID'");
        }
        
        DB::statement("UPDATE sales SET payment_status = CASE 
            WHEN payment_status = 'paid' THEN 'FULLY_PAID'
            WHEN payment_status = 'partial' THEN 'PARTIALLY_PAID'
            WHEN payment_status = 'unpaid' THEN 'PARTIALLY_PAID'
            WHEN payment_status = 'partially_refunded' THEN 'PARTIALLY_REFUNDED'
            WHEN payment_status = 'refunded' THEN 'REFUNDED'
            ELSE UPPER(payment_status)
        END");

        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status ENUM('FULLY_PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') DEFAULT 'PARTIALLY_PAID'");
        }
    }
};
