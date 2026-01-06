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
            $table->string('delivery_name')->nullable()->after('is_for_delivery');
            $table->text('delivery_address')->nullable()->after('delivery_name');
            $table->string('delivery_contact')->nullable()->after('delivery_address');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['delivery_name', 'delivery_address', 'delivery_contact']);
        });
    }
};
