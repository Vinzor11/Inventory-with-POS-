<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('inventory_movements', 'product_id')) {
                $table->foreignId('product_id')
                    ->nullable()
                    ->after('product_variant_id')
                    ->constrained('products')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('inventory_movements', 'movement_type')) {
                $table->string('movement_type', 50)->nullable()->after('type');
            }

            if (!Schema::hasColumn('inventory_movements', 'qty')) {
                // Signed quantity. Positive = in, Negative = out.
                $table->decimal('qty', 14, 4)->nullable()->after('quantity');
            }

            if (!Schema::hasColumn('inventory_movements', 'unit')) {
                $table->string('unit', 20)->nullable()->after('qty');
            }

            if (!Schema::hasColumn('inventory_movements', 'total_cost')) {
                $table->decimal('total_cost', 14, 4)->nullable()->after('unit_cost');
            }

            if (!Schema::hasColumn('inventory_movements', 'reference_type')) {
                $table->string('reference_type', 50)->nullable()->after('reference_id');
            }
        });

        $variantMeta = DB::table('product_variants')
            ->join('products', 'products.id', '=', 'product_variants.product_id')
            ->select('product_variants.id as variant_id', 'products.id as product_id', 'products.base_unit')
            ->get()
            ->keyBy('variant_id');

        DB::table('inventory_movements')
            ->orderBy('id')
            ->chunkById(200, function ($movements) use ($variantMeta) {
                foreach ($movements as $movement) {
                    $meta = $variantMeta->get($movement->product_variant_id);

                    $mappedType = match ($movement->reason) {
                        'purchase', 'stock_in', 'weigh_in' => 'purchase_in',
                        'sale' => 'sale_out',
                        'production' => $movement->type === 'OUT' ? 'production_out' : 'production_in',
                        'initial_stock', 'damage', 'loss', 'recount', 'expired', 'returned', 'other', 'adjustment', 'correction' => 'adjustment',
                        default => $movement->type === 'OUT' ? 'adjustment' : 'purchase_in',
                    };

                    $quantity = (float) $movement->quantity;
                    $signedQty = strtoupper((string) $movement->type) === 'OUT'
                        ? -abs($quantity)
                        : abs($quantity);

                    $unitCost = $movement->unit_cost !== null ? (float) $movement->unit_cost : null;

                    DB::table('inventory_movements')
                        ->where('id', $movement->id)
                        ->update([
                            'product_id' => $meta?->product_id,
                            'movement_type' => $mappedType,
                            'qty' => $signedQty,
                            'unit' => $meta?->base_unit,
                            'total_cost' => $unitCost !== null ? abs($quantity) * $unitCost : null,
                            'reference_type' => 'Legacy',
                        ]);
                }
            });

        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->index(['product_id', 'created_at'], 'inventory_movements_product_created_idx');
            $table->index(['movement_type', 'created_at'], 'inventory_movements_type_created_idx');
            $table->index(['reference_type', 'reference_id'], 'inventory_movements_reference_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropIndex('inventory_movements_product_created_idx');
            $table->dropIndex('inventory_movements_type_created_idx');
            $table->dropIndex('inventory_movements_reference_idx');

            if (Schema::hasColumn('inventory_movements', 'product_id')) {
                $table->dropConstrainedForeignId('product_id');
            }

            $columnsToDrop = [];

            foreach (['movement_type', 'qty', 'unit', 'total_cost', 'reference_type'] as $column) {
                if (Schema::hasColumn('inventory_movements', $column)) {
                    $columnsToDrop[] = $column;
                }
            }

            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
