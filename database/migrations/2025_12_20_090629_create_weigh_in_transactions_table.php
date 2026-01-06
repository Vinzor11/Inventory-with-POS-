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
        Schema::create('weigh_in_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('ref_num')->unique();
            $table->foreignId('weighed_by_user_id')->constrained('users')->onDelete('restrict');
            $table->timestamp('weighed_at');
            $table->decimal('total_amount', 10, 2)->default(0);
            $table->enum('status', ['unpaid', 'paid'])->default('unpaid');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('weigh_in_transactions');
    }
};
