<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // SQLite treats enum columns as TEXT, so no schema update is required.
            return;
        }

        DB::statement(
            "ALTER TABLE weigh_ins MODIFY COLUMN type ENUM('cooked_copra', 'uncooked_copra', 'coconut', 'bagol') NOT NULL"
        );
        DB::statement(
            "ALTER TABLE weigh_in_prices MODIFY COLUMN type ENUM('cooked_copra', 'uncooked_copra', 'coconut', 'bagol') NOT NULL"
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('weigh_ins')
            ->where('type', 'bagol')
            ->update(['type' => 'uncooked_copra']);

        DB::table('weigh_in_prices')
            ->where('type', 'bagol')
            ->update(['type' => 'uncooked_copra']);

        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement(
            "ALTER TABLE weigh_ins MODIFY COLUMN type ENUM('cooked_copra', 'uncooked_copra', 'coconut') NOT NULL"
        );
        DB::statement(
            "ALTER TABLE weigh_in_prices MODIFY COLUMN type ENUM('cooked_copra', 'uncooked_copra', 'coconut') NOT NULL"
        );
    }
};

