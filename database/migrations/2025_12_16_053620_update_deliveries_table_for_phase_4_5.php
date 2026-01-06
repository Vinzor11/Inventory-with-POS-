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
     * Phase 4.5: Update deliveries table to support placeholder deliveries
     * - Allow NULL for delivered_by_user_id and delivered_at (for placeholders)
     * - Add 'partial' to status enum
     */
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            // Modify delivered_by_user_id to allow NULL
            $table->foreignId('delivered_by_user_id')->nullable()->change();
            
            // Modify delivered_at to allow NULL
            $table->timestamp('delivered_at')->nullable()->change();
        });

        // Update status enum to include 'partial'
        // Note: MySQL doesn't support modifying enum directly, so we need to use raw SQL
        DB::statement("ALTER TABLE deliveries MODIFY COLUMN status ENUM('pending', 'partial', 'delivered') DEFAULT 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert status enum
        DB::statement("ALTER TABLE deliveries MODIFY COLUMN status ENUM('pending', 'delivered') DEFAULT 'pending'");
        
        Schema::table('deliveries', function (Blueprint $table) {
            // Revert to NOT NULL (but this might fail if there are NULL values)
            $table->foreignId('delivered_by_user_id')->nullable(false)->change();
            $table->timestamp('delivered_at')->nullable(false)->change();
        });
    }
};
