<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Skip if table already exists
        if (Schema::hasTable('product_variants')) {
            return;
        }

        // Ensure products table exists first
        if (!Schema::hasTable('products')) {
            throw new \Exception('products table must exist before creating product_variants table. Please run the products migration first.');
        }

        // For SQLite, ensure foreign keys are enabled before creating table
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON');
        }

        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('size')->nullable();
            $table->string('thickness')->nullable();
            $table->string('diameter')->nullable();
            $table->string('description');
            $table->decimal('unit_price', 10, 2);
            $table->timestamps();

            // Add foreign key constraint separately for better error handling
            $table->foreign('product_id')
                  ->references('id')
                  ->on('products')
                  ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_variants');
    }
};
