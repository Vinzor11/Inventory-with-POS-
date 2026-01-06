<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds void audit trail fields to sales table
     * - voided_by_user_id: User who voided the sale
     * - voided_at: Timestamp when sale was voided
     * - void_reason: Reason for voiding (optional)
     */
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->foreignId('voided_by_user_id')->nullable()->after('cashier_user_id')->constrained('users')->onDelete('restrict');
            $table->timestamp('voided_at')->nullable()->after('voided_by_user_id');
            $table->text('void_reason')->nullable()->after('voided_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropForeign(['voided_by_user_id']);
            $table->dropColumn(['voided_by_user_id', 'voided_at', 'void_reason']);
        });
    }
};

