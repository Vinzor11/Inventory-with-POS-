<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds delivered_quantity and item_status to sale_items table
     * - delivered_quantity: tracks how much of this item has been delivered
     * - item_status: tracks the status of the item (ACTIVE, CANCELED)
     */
    public function up(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->decimal('delivered_quantity', 10, 2)->default(0)->after('quantity');
            $table->enum('item_status', ['ACTIVE', 'CANCELED'])->default('ACTIVE')->after('delivered_quantity');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropColumn(['delivered_quantity', 'item_status']);
        });
    }
};
