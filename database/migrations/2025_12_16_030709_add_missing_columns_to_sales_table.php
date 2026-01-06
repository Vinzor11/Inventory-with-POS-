<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Add missing columns to sales table that were added in the updated migration
     */
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            // Check if columns don't exist before adding them
            if (!Schema::hasColumn('sales', 'status')) {
                $table->enum('status', ['draft', 'paid', 'void'])->default('draft')->after('sale_number');
            }
            if (!Schema::hasColumn('sales', 'subtotal')) {
                $table->decimal('subtotal', 10, 2)->default(0)->after('status');
            }
            if (!Schema::hasColumn('sales', 'total')) {
                $table->decimal('total', 10, 2)->default(0)->after('subtotal');
            }
            if (!Schema::hasColumn('sales', 'notes')) {
                $table->text('notes')->nullable()->after('total');
            }
            if (!Schema::hasColumn('sales', 'cashier_user_id')) {
                $table->foreignId('cashier_user_id')->constrained('users')->onDelete('restrict')->after('notes');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (Schema::hasColumn('sales', 'cashier_user_id')) {
                $table->dropForeign(['cashier_user_id']);
                $table->dropColumn('cashier_user_id');
            }
            if (Schema::hasColumn('sales', 'notes')) {
                $table->dropColumn('notes');
            }
            if (Schema::hasColumn('sales', 'total')) {
                $table->dropColumn('total');
            }
            if (Schema::hasColumn('sales', 'subtotal')) {
                $table->dropColumn('subtotal');
            }
            if (Schema::hasColumn('sales', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};
