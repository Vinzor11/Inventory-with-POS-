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
        $driver = DB::getDriverName();
        
        Schema::table('deliveries', function (Blueprint $table) {
            // Modify delivered_by_user_id to allow NULL
            $table->foreignId('delivered_by_user_id')->nullable()->change();
            
            // Modify delivered_at to allow NULL
            $table->timestamp('delivered_at')->nullable()->change();
        });

        // Update status enum to include 'partial'
        if ($driver === 'sqlite') {
            // SQLite: Drop and recreate the column with new enum values
            Schema::table('deliveries', function (Blueprint $table) {
                $table->dropColumn('status');
            });
            
            Schema::table('deliveries', function (Blueprint $table) {
                $table->enum('status', ['pending', 'partial', 'delivered'])->default('pending')->after('delivered_at');
            });
        } else {
            // MySQL/MariaDB: Use MODIFY COLUMN
            DB::statement("ALTER TABLE deliveries MODIFY COLUMN status ENUM('pending', 'partial', 'delivered') DEFAULT 'pending'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();
        
        // Revert status enum - first update any 'partial' status to 'pending'
        DB::table('deliveries')
            ->where('status', 'partial')
            ->update(['status' => 'pending']);
        
        if ($driver === 'sqlite') {
            // SQLite: Drop and recreate the column with old enum values
            Schema::table('deliveries', function (Blueprint $table) {
                $table->dropColumn('status');
            });
            
            Schema::table('deliveries', function (Blueprint $table) {
                $table->enum('status', ['pending', 'delivered'])->default('pending')->after('delivered_at');
            });
        } else {
            // MySQL/MariaDB
            DB::statement("ALTER TABLE deliveries MODIFY COLUMN status ENUM('pending', 'delivered') DEFAULT 'pending'");
        }
        
        Schema::table('deliveries', function (Blueprint $table) {
            // Revert to NOT NULL (but this might fail if there are NULL values)
            $table->foreignId('delivered_by_user_id')->nullable(false)->change();
            $table->timestamp('delivered_at')->nullable(false)->change();
        });
    }
};
