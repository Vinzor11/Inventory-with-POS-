<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Add indexes to improve report query performance
     */
    public function up(): void
    {
        try {
            Schema::table('sales', function (Blueprint $table) {
                // Index for date filtering
                $table->index('created_at', 'sales_created_at_index');
                // Index for status filtering
                $table->index('status', 'sales_status_index');
                // Index for cashier filtering
                $table->index('cashier_user_id', 'sales_cashier_user_id_index');
                // Composite index for common queries
                $table->index(['status', 'created_at'], 'sales_status_created_at_index');
            });
        } catch (\Exception $e) {
            // Index may already exist, continue
        }

        try {
            Schema::table('payments', function (Blueprint $table) {
                // Index for date filtering
                $table->index('received_at', 'payments_received_at_index');
                // Index for sale relationship
                $table->index('sale_id', 'payments_sale_id_index');
            });
        } catch (\Exception $e) {
            // Index may already exist, continue
        }

        try {
            Schema::table('refunds', function (Blueprint $table) {
                // Index for date filtering
                $table->index('created_at', 'refunds_created_at_index');
                // Index for sale relationship
                $table->index('sale_id', 'refunds_sale_id_index');
            });
        } catch (\Exception $e) {
            // Index may already exist, continue
        }

        try {
            Schema::table('deliveries', function (Blueprint $table) {
                // Index for date filtering
                $table->index('delivered_at', 'deliveries_delivered_at_index');
                // Index for status filtering
                $table->index('status', 'deliveries_status_index');
                // Index for sale relationship
                $table->index('sale_id', 'deliveries_sale_id_index');
            });
        } catch (\Exception $e) {
            // Index may already exist, continue
        }

        try {
            Schema::table('inventory_movements', function (Blueprint $table) {
                // Index for date filtering
                $table->index('created_at', 'inventory_movements_created_at_index');
                // Index for type filtering
                $table->index('type', 'inventory_movements_type_index');
                // Index for variant relationship
                $table->index('product_variant_id', 'inventory_movements_product_variant_id_index');
            });
        } catch (\Exception $e) {
            // Index may already exist, continue
        }

        try {
            Schema::table('sale_adjustments', function (Blueprint $table) {
                // Index for date filtering
                $table->index('created_at', 'sale_adjustments_created_at_index');
                // Index for sale relationship
                $table->index('sale_id', 'sale_adjustments_sale_id_index');
            });
        } catch (\Exception $e) {
            // Index may already exist, continue
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex('sales_created_at_index');
            $table->dropIndex('sales_status_index');
            $table->dropIndex('sales_cashier_user_id_index');
            $table->dropIndex('sales_status_created_at_index');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('payments_received_at_index');
            $table->dropIndex('payments_sale_id_index');
        });

        Schema::table('refunds', function (Blueprint $table) {
            $table->dropIndex('refunds_created_at_index');
            $table->dropIndex('refunds_sale_id_index');
        });

        Schema::table('deliveries', function (Blueprint $table) {
            $table->dropIndex('deliveries_delivered_at_index');
            $table->dropIndex('deliveries_status_index');
            $table->dropIndex('deliveries_sale_id_index');
        });

        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropIndex('inventory_movements_created_at_index');
            $table->dropIndex('inventory_movements_type_index');
            $table->dropIndex('inventory_movements_product_variant_id_index');
        });

        Schema::table('sale_adjustments', function (Blueprint $table) {
            $table->dropIndex('sale_adjustments_created_at_index');
            $table->dropIndex('sale_adjustments_sale_id_index');
        });
    }

};

