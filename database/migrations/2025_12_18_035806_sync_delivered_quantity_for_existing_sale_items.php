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
     * Syncs delivered_quantity for existing sale_items based on delivery_items
     * This ensures existing sales have accurate delivered_quantity values
     */
    public function up(): void
    {
        // Update delivered_quantity for each sale_item based on delivery_items
        // We need to sum all delivery_items quantities for each product_variant_id per sale
        DB::statement("
            UPDATE sale_items si
            INNER JOIN (
                SELECT 
                    si2.id as sale_item_id,
                    COALESCE(SUM(di.quantity), 0) as total_delivered
                FROM sale_items si2
                INNER JOIN sales s ON si2.sale_id = s.id
                LEFT JOIN deliveries d ON d.sale_id = s.id
                LEFT JOIN delivery_items di ON di.delivery_id = d.id 
                    AND di.product_variant_id = si2.product_variant_id
                GROUP BY si2.id
            ) AS delivered_totals ON si.id = delivered_totals.sale_item_id
            SET si.delivered_quantity = delivered_totals.total_delivered
        ");
    }

    /**
     * Reverse the migrations.
     * 
     * Reset delivered_quantity to 0 (cannot fully reverse, but can reset)
     */
    public function down(): void
    {
        DB::table('sale_items')->update(['delivered_quantity' => 0]);
    }
};
