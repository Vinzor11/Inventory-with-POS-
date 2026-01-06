<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Add OPEN to sale_status enum with the following rules:
     * - UNPAID + PENDING → OPEN
     * - PARTIALLY_PAID + PENDING → PARTIAL
     * - FULLY_PAID + PARTIAL → PARTIAL
     * - FULLY_PAID + DELIVERED → COMPLETED
     */
    public function up(): void
    {
        // Convert to VARCHAR temporarily to avoid case-sensitivity issues with ENUM
        DB::statement("ALTER TABLE sales MODIFY COLUMN status VARCHAR(20)");

        // Convert back to ENUM with new values including OPEN
        DB::statement("ALTER TABLE sales MODIFY COLUMN status ENUM('OPEN', 'COMPLETED', 'PARTIAL', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED') DEFAULT 'COMPLETED'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Convert to VARCHAR
        DB::statement("ALTER TABLE sales MODIFY COLUMN status VARCHAR(20)");
        
        // Map OPEN back to COMPLETED (or PARTIAL if needed)
        DB::statement("UPDATE sales SET status = 'COMPLETED' WHERE status = 'OPEN'");

        // Convert back to ENUM without OPEN
        DB::statement("ALTER TABLE sales MODIFY COLUMN status ENUM('COMPLETED', 'PARTIAL', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED') DEFAULT 'COMPLETED'");
    }
};
