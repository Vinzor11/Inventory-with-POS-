<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds canceled_quantity to sale_adjustments table
     * Tracks how much quantity was canceled in this adjustment
     */
    public function up(): void
    {
        Schema::table('sale_adjustments', function (Blueprint $table) {
            $table->decimal('canceled_quantity', 10, 2)->default(0)->after('amount_removed');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sale_adjustments', function (Blueprint $table) {
            $table->dropColumn('canceled_quantity');
        });
    }
};
