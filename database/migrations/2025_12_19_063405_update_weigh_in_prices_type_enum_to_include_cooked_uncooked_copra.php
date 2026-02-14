<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // SQLite stores enum-like fields as text, so value updates are sufficient.
            DB::table('weigh_in_prices')
                ->where('type', 'copra')
                ->update(['type' => 'cooked_copra']);

            return;
        } else {
            // For MySQL/MariaDB
            // Step 1: Temporarily add new values to enum
            DB::statement("ALTER TABLE weigh_in_prices MODIFY COLUMN type ENUM('copra', 'cooked_copra', 'uncooked_copra', 'coconut') NOT NULL");
            
            // Step 2: Update existing 'copra' price to 'cooked_copra'
            DB::table('weigh_in_prices')
                ->where('type', 'copra')
                ->update(['type' => 'cooked_copra']);
            
            // Step 3: Remove 'copra' from enum
            DB::statement("ALTER TABLE weigh_in_prices MODIFY COLUMN type ENUM('cooked_copra', 'uncooked_copra', 'coconut') NOT NULL");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Update cooked_copra and uncooked_copra back to copra
        DB::table('weigh_in_prices')
            ->whereIn('type', ['cooked_copra', 'uncooked_copra'])
            ->update(['type' => 'copra']);
            
        if (DB::getDriverName() === 'sqlite') {
            return;
        } else {
            DB::statement("ALTER TABLE weigh_in_prices MODIFY COLUMN type ENUM('copra', 'coconut') NOT NULL");
        }
    }
};
