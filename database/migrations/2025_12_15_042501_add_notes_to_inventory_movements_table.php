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
     * Phase 2: Add notes field and make unit_cost nullable
     * Rules:
     * - unit_cost is REQUIRED when type = 'IN'
     * - unit_cost MUST be NULL when type = 'OUT'
     * - notes is optional for all movements
     */
    public function up(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            // Make unit_cost nullable (enforced at application level)
            $table->decimal('unit_cost', 10, 2)->nullable()->change();
            
            // Add notes field for additional context
            $table->text('notes')->nullable()->after('reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->decimal('unit_cost', 10, 2)->nullable(false)->change();
            $table->dropColumn('notes');
        });
    }
};