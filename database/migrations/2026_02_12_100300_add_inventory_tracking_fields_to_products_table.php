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
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'official_stock_unit')) {
                $table->string('official_stock_unit', 20)->nullable()->after('base_unit');
            }

            if (!Schema::hasColumn('products', 'stock_qty')) {
                // Cached aggregate stock across variants. Source of truth remains movement log.
                $table->decimal('stock_qty', 14, 4)->default(0)->after('official_stock_unit');
            }

            if (!Schema::hasColumn('products', 'is_weighed')) {
                $table->boolean('is_weighed')->default(false)->after('stock_qty');
            }
        });

        DB::table('products')
            ->whereNull('official_stock_unit')
            ->update(['official_stock_unit' => DB::raw('base_unit')]);

        DB::table('products')
            ->where('official_stock_unit', 'kg')
            ->update(['is_weighed' => true]);

        $stockByProduct = DB::table('inventory')
            ->join('product_variants', 'product_variants.id', '=', 'inventory.product_variant_id')
            ->select('product_variants.product_id', DB::raw('SUM(inventory.quantity_on_hand) as total_stock'))
            ->groupBy('product_variants.product_id')
            ->get();

        foreach ($stockByProduct as $stock) {
            DB::table('products')
                ->where('id', $stock->product_id)
                ->update(['stock_qty' => $stock->total_stock]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $columns = [];
            foreach (['official_stock_unit', 'stock_qty', 'is_weighed'] as $column) {
                if (Schema::hasColumn('products', $column)) {
                    $columns[] = $column;
                }
            }

            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
