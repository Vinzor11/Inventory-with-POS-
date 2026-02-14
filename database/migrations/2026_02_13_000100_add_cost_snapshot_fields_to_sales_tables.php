<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (!Schema::hasColumn('sales', 'sale_date')) {
                $table->date('sale_date')->nullable()->after('sale_number');
            }

            if (!Schema::hasColumn('sales', 'customer_name')) {
                $table->string('customer_name')->nullable()->after('sale_date');
            }
        });

        Schema::table('sale_items', function (Blueprint $table) {
            if (!Schema::hasColumn('sale_items', 'unit_cost')) {
                $table->decimal('unit_cost', 14, 4)->nullable()->after('line_total');
            }

            if (!Schema::hasColumn('sale_items', 'total_cost')) {
                $table->decimal('total_cost', 14, 4)->nullable()->after('unit_cost');
            }

            if (!Schema::hasColumn('sale_items', 'profit')) {
                $table->decimal('profit', 14, 4)->nullable()->after('total_cost');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $columns = [];

            foreach (['unit_cost', 'total_cost', 'profit'] as $column) {
                if (Schema::hasColumn('sale_items', $column)) {
                    $columns[] = $column;
                }
            }

            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });

        Schema::table('sales', function (Blueprint $table) {
            $columns = [];

            foreach (['sale_date', 'customer_name'] as $column) {
                if (Schema::hasColumn('sales', $column)) {
                    $columns[] = $column;
                }
            }

            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};

