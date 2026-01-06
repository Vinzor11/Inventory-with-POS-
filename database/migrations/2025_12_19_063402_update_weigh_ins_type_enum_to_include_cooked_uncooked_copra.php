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
        // First, update existing 'copra' records to 'cooked_copra' (assuming existing are cooked)
        // We need to do this before modifying the enum
        if (DB::getDriverName() === 'sqlite') {
            // For SQLite, we need to use a workaround since it doesn't support enum directly
            // Update existing records first
            DB::table('weigh_ins')
                ->where('type', 'copra')
                ->update(['type' => 'cooked_copra']);
            
            // Then recreate the column
            Schema::table('weigh_ins', function (Blueprint $table) {
                $table->dropColumn('type');
            });
            
            Schema::table('weigh_ins', function (Blueprint $table) {
                $table->enum('type', ['cooked_copra', 'uncooked_copra', 'coconut'])->after('id');
            });
        } else {
            // For MySQL/MariaDB, we need to temporarily allow the old value, update records, then change enum
            // Step 1: Temporarily add the new values to enum (MySQL allows this)
            DB::statement("ALTER TABLE weigh_ins MODIFY COLUMN type ENUM('copra', 'cooked_copra', 'uncooked_copra', 'coconut') NOT NULL");
            
            // Step 2: Update existing 'copra' records to 'cooked_copra'
            DB::table('weigh_ins')
                ->where('type', 'copra')
                ->update(['type' => 'cooked_copra']);
            
            // Step 3: Now remove 'copra' from enum
            DB::statement("ALTER TABLE weigh_ins MODIFY COLUMN type ENUM('cooked_copra', 'uncooked_copra', 'coconut') NOT NULL");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Update cooked_copra and uncooked_copra back to copra
        DB::table('weigh_ins')
            ->whereIn('type', ['cooked_copra', 'uncooked_copra'])
            ->update(['type' => 'copra']);
            
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('weigh_ins', function (Blueprint $table) {
                $table->dropColumn('type');
            });
            
            Schema::table('weigh_ins', function (Blueprint $table) {
                $table->enum('type', ['copra', 'coconut'])->after('id');
            });
        } else {
            DB::statement("ALTER TABLE weigh_ins MODIFY COLUMN type ENUM('copra', 'coconut') NOT NULL");
        }
    }
};
