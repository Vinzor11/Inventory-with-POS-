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
     * Adds status field to payments table
     * Status values: ACTIVE, REVERSED
     * - ACTIVE: Normal payment
     * - REVERSED: Payment was reversed due to sale void
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->enum('status', ['ACTIVE', 'REVERSED'])->default('ACTIVE')->after('notes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};

