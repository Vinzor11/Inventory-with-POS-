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
        $isSqlite = DB::getDriverName() === 'sqlite';

        // Convert to VARCHAR temporarily to avoid case-sensitivity issues with ENUM
        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN status VARCHAR(20)");
        }

        // Convert back to ENUM with new values including OPEN
        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN status ENUM('OPEN', 'COMPLETED', 'PARTIAL', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED') DEFAULT 'COMPLETED'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $isSqlite = DB::getDriverName() === 'sqlite';

        // Convert to VARCHAR
        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN status VARCHAR(20)");
        }
        
        // Map OPEN back to COMPLETED (or PARTIAL if needed)
        DB::statement("UPDATE sales SET status = 'COMPLETED' WHERE status = 'OPEN'");

        // Convert back to ENUM without OPEN
        if (!$isSqlite) {
            DB::statement("ALTER TABLE sales MODIFY COLUMN status ENUM('COMPLETED', 'PARTIAL', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED') DEFAULT 'COMPLETED'");
        }
    }
};
