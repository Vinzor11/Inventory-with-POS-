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
            $table->foreignId('weigh_in_transaction_id')
                  ->nullable()
                  ->after('id')
                  ->constrained('weigh_in_transactions')
                  ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('weigh_ins', function (Blueprint $table) {
            $table->dropForeign(['weigh_in_transaction_id']);
            $table->dropColumn('weigh_in_transaction_id');
        });
    }
};
