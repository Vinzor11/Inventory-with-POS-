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
        Schema::create('weigh_ins', function (Blueprint $table) {
            $table->id();
            $table->decimal('weight_kg', 10, 2);
            $table->foreignId('weighed_by_user_id')->constrained('users')->onDelete('restrict');
            $table->timestamp('weighed_at');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('weigh_ins');
    }
};
