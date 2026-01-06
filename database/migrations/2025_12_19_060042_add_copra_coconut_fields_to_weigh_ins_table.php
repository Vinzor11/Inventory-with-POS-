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
        Schema::table('weigh_ins', function (Blueprint $table) {
            $table->enum('type', ['copra', 'coconut'])->after('id');
            $table->integer('count')->nullable()->after('weight_kg'); // For coconuts
            $table->decimal('unit_price', 10, 2)->after('count'); // Price per kg (copra) or per piece (coconut)
            $table->decimal('total_amount', 10, 2)->after('unit_price'); // Auto-calculated
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('weigh_ins', function (Blueprint $table) {
            $table->dropColumn(['type', 'count', 'unit_price', 'total_amount']);
        });
    }
};
