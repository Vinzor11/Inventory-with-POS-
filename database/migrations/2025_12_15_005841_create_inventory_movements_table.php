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
        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained('product_variants')->onDelete('cascade');
            $table->decimal('quantity', 10, 2);
            $table->enum('type', ['IN', 'OUT']);
            $table->string('reason'); // purchase, sale, adjustment, initial_stock
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->decimal('unit_cost', 10, 2);
            $table->foreignId('recorded_by_user_id')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_movements');
    }
};
