<?php

namespace Database\Seeders;

use App\Models\ProductVariant;
use App\Models\ProductionRun;
use App\Models\PurchaseReceipt;
use App\Models\User;
use App\Services\CookedCopraSaleService;
use App\Services\ProductionService;
use App\Services\PurchaseService;
use App\Services\StockAdjustmentService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Log;

class ProductionWorkflowSeeder extends Seeder
{
    public function run(): void
    {
        if (PurchaseReceipt::query()->exists() || ProductionRun::query()->exists()) {
            return;
        }

        $actorId = User::query()->value('id');
        if (!$actorId) {
            return;
        }

        $coconutVariant = $this->findVariant('COCONUT', 'Coconut');
        $uncookedVariant = $this->findVariant('UNCOOKED-COPRA', 'Uncooked Copra');
        $cookedVariant = $this->findVariant('COOKED-COPRA', 'Cooked Copra');

        if (!$coconutVariant || !$uncookedVariant || !$cookedVariant) {
            return;
        }

        /** @var PurchaseService $purchaseService */
        $purchaseService = app(PurchaseService::class);
        /** @var ProductionService $productionService */
        $productionService = app(ProductionService::class);
        /** @var StockAdjustmentService $stockAdjustmentService */
        $stockAdjustmentService = app(StockAdjustmentService::class);
        /** @var CookedCopraSaleService $cookedCopraSaleService */
        $cookedCopraSaleService = app(CookedCopraSaleService::class);

        try {
            $purchaseService->receiveStock([
                'product_variant_id' => $coconutVariant->id,
                'quantity' => 250,
                'unit_cost' => 12.50,
                'received_at' => now()->subDays(2)->toDateTimeString(),
                'notes' => 'Seeded receiving sample for coconut stock.',
            ], $actorId);

            $productionService->createRun([
                'run_type' => 'coconut_to_uncooked',
                'input_variant_id' => $coconutVariant->id,
                'output_variant_id' => $uncookedVariant->id,
                'input_qty' => 180,
                'output_weight_kg' => 68.50,
                'record_weigh_in' => true,
                'production_date' => now()->subDay()->toDateString(),
                'operator' => 'Seed Operator A',
                'supplier_source' => 'Local farms',
                'drying_method' => 'Sun dry',
                'notes' => 'Seeded coconut to uncooked production sample.',
            ], $actorId);

            $productionService->createRun([
                'run_type' => 'uncooked_to_cooked',
                'input_variant_id' => $uncookedVariant->id,
                'output_variant_id' => $cookedVariant->id,
                'input_qty' => 50,
                'output_weight_kg' => 41.20,
                'record_weigh_in' => true,
                'production_date' => now()->toDateString(),
                'operator' => 'Seed Operator B',
                'drying_method' => 'Kiln dry',
                'notes' => 'Seeded uncooked to cooked production sample.',
            ], $actorId);

            $productionService->createRun([
                'run_type' => 'coconut_to_cooked',
                'input_variant_id' => $coconutVariant->id,
                'output_variant_id' => $cookedVariant->id,
                'input_qty' => 20,
                'output_weight_kg' => 8.60,
                'production_date' => now()->toDateString(),
                'operator' => 'Seed Operator C',
                'drying_method' => 'Direct kiln',
                'notes' => 'Seeded direct coconut to cooked production sample.',
            ], $actorId);

            $cookedCopraSaleService->createSale([
                'quantity' => 5,
                'unit_price' => 55,
                'sale_date' => now()->toDateString(),
                'customer_name' => 'Seed Customer',
                'notes' => 'Seeded cooked copra sale sample.',
            ], $actorId);

            $stockAdjustmentService->adjustStock([
                'product_variant_id' => $cookedVariant->id,
                'actual_quantity' => 40,
                'reason' => 'physical_count',
                'notes' => 'Seeded physical count correction sample.',
            ], $actorId);
        } catch (\Throwable $e) {
            Log::warning('ProductionWorkflowSeeder skipped due to error: ' . $e->getMessage());
        }
    }

    private function findVariant(string $sku, string $name): ?ProductVariant
    {
        return ProductVariant::query()
            ->whereHas('product', function ($query) use ($sku, $name) {
                $query->where('sku', $sku)->orWhere('name', $name);
            })
            ->orderBy('id')
            ->first();
    }
}
