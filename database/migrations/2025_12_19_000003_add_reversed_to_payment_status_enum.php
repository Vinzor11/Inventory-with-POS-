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
     * Adds REVERSED to payment_status enum in sales table
     * REVERSED: Payment was reversed due to sale void
     */
    public function up(): void
    {
        // MySQL doesn't support modifying enum directly, so we need to use raw SQL
        DB::statement("ALTER TABLE `sales` MODIFY COLUMN `payment_status` ENUM('UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REVERSED') NOT NULL DEFAULT 'UNPAID'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove REVERSED from enum
        DB::statement("ALTER TABLE `sales` MODIFY COLUMN `payment_status` ENUM('UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') NOT NULL DEFAULT 'UNPAID'");
    }
};

