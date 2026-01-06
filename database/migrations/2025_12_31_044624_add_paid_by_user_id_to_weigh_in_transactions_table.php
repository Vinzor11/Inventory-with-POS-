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
        Schema::table('weigh_in_transactions', function (Blueprint $table) {
            $table->foreignId('paid_by_user_id')->nullable()->after('status')->constrained('users')->onDelete('restrict');
            $table->timestamp('paid_at')->nullable()->after('paid_by_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('weigh_in_transactions', function (Blueprint $table) {
            $table->dropForeign(['paid_by_user_id']);
            $table->dropColumn(['paid_by_user_id', 'paid_at']);
        });
    }
};
