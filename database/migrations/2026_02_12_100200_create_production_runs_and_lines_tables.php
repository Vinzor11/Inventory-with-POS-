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
        Schema::create('production_runs', function (Blueprint $table) {
            $table->id();
            $table->string('batch_code')->unique();
            $table->string('run_type', 50);
            $table->date('production_date');
            $table->text('notes')->nullable();
            $table->string('operator')->nullable();
            $table->string('supplier_source')->nullable();
            $table->string('drying_method')->nullable();

            $table->decimal('input_qty', 14, 4);
            $table->decimal('output_qty', 14, 4);
            $table->decimal('yield_value', 14, 6)->nullable();
            $table->decimal('yield_percent', 14, 4)->nullable();
            $table->decimal('shrinkage_qty', 14, 4)->nullable();
            $table->decimal('shrinkage_percent', 14, 4)->nullable();
            $table->decimal('total_input_cost', 14, 4);
            $table->decimal('output_unit_cost', 14, 4);

            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['run_type', 'production_date'], 'production_runs_type_date_idx');
        });

        Schema::create('production_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_run_id')->constrained('production_runs')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignId('product_variant_id')->constrained('product_variants')->restrictOnDelete();
            $table->string('direction', 10); // in / out
            $table->decimal('qty', 14, 4);
            $table->string('unit', 20);
            $table->decimal('unit_cost', 14, 4)->nullable();
            $table->decimal('total_cost', 14, 4)->nullable();
            $table->foreignId('weigh_in_id')->nullable()->constrained('weigh_ins')->nullOnDelete();
            $table->timestamps();

            $table->index(['product_id', 'created_at'], 'production_lines_product_created_idx');
            $table->index(['direction', 'created_at'], 'production_lines_direction_created_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('production_lines');
        Schema::dropIfExists('production_runs');
    }
};
