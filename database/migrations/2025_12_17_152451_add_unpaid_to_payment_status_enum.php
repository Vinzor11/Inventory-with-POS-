<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Add UNPAID to payment_status enum to distinguish between:
     * - UNPAID: totalPaid = 0 (no payment received)
     * - PARTIALLY_PAID: 0 < totalPaid < total (some payment received)
     */
    public function up(): void
    {
        // Step 1: Convert to VARCHAR temporarily to avoid case-sensitivity issues with ENUM
        DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status VARCHAR(20)");
        
        // Step 2: Update existing PARTIALLY_PAID records where totalPaid = 0 to UNPAID
        // We need to check payments to determine if totalPaid = 0
        DB::statement("
            UPDATE sales s
            LEFT JOIN (
                SELECT sale_id, SUM(amount) as total_paid
                FROM payments
                GROUP BY sale_id
            ) p ON s.id = p.sale_id
            SET s.payment_status = 'UNPAID'
            WHERE s.payment_status = 'PARTIALLY_PAID'
            AND (COALESCE(p.total_paid, 0) = 0 OR p.total_paid IS NULL)
        ");

        // Step 3: Convert back to ENUM with new values including UNPAID
        // Note: We need to ensure all existing values are valid before converting
        DB::statement("
            UPDATE sales 
            SET payment_status = CASE 
                WHEN payment_status NOT IN ('UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
                THEN 'UNPAID'
                ELSE payment_status
            END
        ");

        DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status ENUM('UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') DEFAULT 'UNPAID'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Convert to VARCHAR
        DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status VARCHAR(20)");
        
        // Map UNPAID back to PARTIALLY_PAID
        DB::statement("UPDATE sales SET payment_status = 'PARTIALLY_PAID' WHERE payment_status = 'UNPAID'");

        // Convert back to ENUM without UNPAID
        DB::statement("ALTER TABLE sales MODIFY COLUMN payment_status ENUM('FULLY_PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') DEFAULT 'PARTIALLY_PAID'");
    }
};
