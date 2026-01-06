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
     * Adds PARTIAL_ADJUSTED to item_status enum
     * This status is used when an item is partially canceled (some delivered, some canceled)
     */
    public function up(): void
    {
        // MySQL requires using raw SQL to modify ENUM values
        DB::statement("ALTER TABLE sale_items MODIFY COLUMN item_status ENUM('ACTIVE', 'CANCELED', 'PARTIAL_ADJUSTED') DEFAULT 'ACTIVE'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove PARTIAL_ADJUSTED from enum (convert existing PARTIAL_ADJUSTED to ACTIVE first)
        DB::statement("UPDATE sale_items SET item_status = 'ACTIVE' WHERE item_status = 'PARTIAL_ADJUSTED'");
        DB::statement("ALTER TABLE sale_items MODIFY COLUMN item_status ENUM('ACTIVE', 'CANCELED') DEFAULT 'ACTIVE'");
    }
};
