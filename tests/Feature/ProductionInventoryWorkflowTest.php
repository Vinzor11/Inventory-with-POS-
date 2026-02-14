<?php

namespace Tests\Feature;

use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\CookedCopraSaleService;
use App\Services\ProductionService;
use App\Services\PurchaseService;
use App\Services\StockAdjustmentService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Tests\TestCase;

class ProductionInventoryWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private ProductVariant $coconutVariant;
    private ProductVariant $uncookedVariant;
    private ProductVariant $cookedVariant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $category = ProductCategory::query()->create([
            'name' => 'Agricultural Products',
            'description' => 'Test category',
            'is_active' => true,
        ]);

        $this->coconutVariant = $this->createVariant($category->id, 'COCONUT', 'Coconut', 'pcs', false);
        $this->uncookedVariant = $this->createVariant($category->id, 'UNCOOKED-COPRA', 'Uncooked Copra', 'kg', true);
        $this->cookedVariant = $this->createVariant($category->id, 'COOKED-COPRA', 'Cooked Copra', 'kg', true);
    }

    public function test_insufficient_stock_prevents_production_run(): void
    {
        Inventory::query()
            ->where('product_variant_id', $this->coconutVariant->id)
            ->update(['quantity_on_hand' => 5]);

        $this->coconutVariant->update(['purchase_price' => 10]);

        /** @var ProductionService $service */
        $service = app(ProductionService::class);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Insufficient stock');

        try {
            $service->createRun([
                'run_type' => 'coconut_to_uncooked',
                'input_variant_id' => $this->coconutVariant->id,
                'output_variant_id' => $this->uncookedVariant->id,
                'input_qty' => 10,
                'output_weight_kg' => 4,
                'production_date' => now()->toDateString(),
            ], $this->admin->id);
        } finally {
            $this->assertDatabaseHas('inventory', [
                'product_variant_id' => $this->coconutVariant->id,
                'quantity_on_hand' => 5,
            ]);

            $this->assertDatabaseCount('production_runs', 0);
        }
    }

    public function test_cost_transfer_uses_weighted_average_on_coconut_to_uncooked(): void
    {
        Inventory::query()
            ->where('product_variant_id', $this->coconutVariant->id)
            ->update(['quantity_on_hand' => 100]);

        $this->coconutVariant->update(['purchase_price' => 12]);

        /** @var ProductionService $service */
        $service = app(ProductionService::class);

        $run = $service->createRun([
            'run_type' => 'coconut_to_uncooked',
            'input_variant_id' => $this->coconutVariant->id,
            'output_variant_id' => $this->uncookedVariant->id,
            'input_qty' => 20,
            'output_weight_kg' => 8,
            'production_date' => now()->toDateString(),
            'notes' => 'Cost transfer test',
        ], $this->admin->id);

        $this->assertEquals('240.0000', (string) $run->total_input_cost);
        $this->assertEquals('30.0000', (string) $run->output_unit_cost);
        $this->assertNull($run->yield_percent);

        $this->assertDatabaseHas('inventory_movements', [
            'product_variant_id' => $this->coconutVariant->id,
            'movement_type' => 'production_out',
            'qty' => -20,
            'total_cost' => 240,
            'reference_type' => 'Production',
            'reference_id' => $run->id,
        ]);

        $this->assertDatabaseHas('inventory_movements', [
            'product_variant_id' => $this->uncookedVariant->id,
            'movement_type' => 'production_in',
            'qty' => 8,
            'unit_cost' => 30,
            'total_cost' => 240,
            'reference_type' => 'Production',
            'reference_id' => $run->id,
        ]);
    }

    public function test_purchase_production_and_adjustment_create_movement_logs(): void
    {
        /** @var PurchaseService $purchaseService */
        $purchaseService = app(PurchaseService::class);
        /** @var ProductionService $productionService */
        $productionService = app(ProductionService::class);
        /** @var StockAdjustmentService $stockAdjustmentService */
        $stockAdjustmentService = app(StockAdjustmentService::class);

        $purchaseService->receiveStock([
            'product_variant_id' => $this->coconutVariant->id,
            'quantity' => 50,
            'unit_cost' => 10,
            'received_at' => now()->toDateTimeString(),
            'notes' => 'Movement test purchase',
        ], $this->admin->id);

        $productionService->createRun([
            'run_type' => 'coconut_to_uncooked',
            'input_variant_id' => $this->coconutVariant->id,
            'output_variant_id' => $this->uncookedVariant->id,
            'input_qty' => 10,
            'output_weight_kg' => 4,
            'production_date' => now()->toDateString(),
            'notes' => 'Movement test run',
        ], $this->admin->id);

        $stockAdjustmentService->adjustStock([
            'product_variant_id' => $this->uncookedVariant->id,
            'actual_quantity' => 3.5,
            'reason' => 'physical_count',
            'notes' => 'Movement test adjustment',
        ], $this->admin->id);

        $this->assertTrue(InventoryMovement::query()->where('movement_type', 'purchase_in')->exists());
        $this->assertTrue(InventoryMovement::query()->where('movement_type', 'production_out')->exists());
        $this->assertTrue(InventoryMovement::query()->where('movement_type', 'production_in')->exists());
        $this->assertTrue(InventoryMovement::query()->where('movement_type', 'adjustment')->exists());
    }

    public function test_piece_to_kg_run_blocks_unrealistic_output_ratio(): void
    {
        config()->set('production.max_kg_per_pc', 0.60);

        Inventory::query()
            ->where('product_variant_id', $this->coconutVariant->id)
            ->update(['quantity_on_hand' => 100]);

        $this->coconutVariant->update(['purchase_price' => 10]);

        /** @var ProductionService $service */
        $service = app(ProductionService::class);

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('Output weight exceeds realistic biological limits.');

        try {
            $service->createRun([
                'run_type' => 'coconut_to_uncooked',
                'input_variant_id' => $this->coconutVariant->id,
                'output_variant_id' => $this->uncookedVariant->id,
                'input_qty' => 10,
                'output_weight_kg' => 8,
                'production_date' => now()->toDateString(),
            ], $this->admin->id);
        } finally {
            $this->assertDatabaseHas('inventory', [
                'product_variant_id' => $this->coconutVariant->id,
                'quantity_on_hand' => 100,
            ]);

            $this->assertDatabaseHas('inventory', [
                'product_variant_id' => $this->uncookedVariant->id,
                'quantity_on_hand' => 0,
            ]);

            $this->assertDatabaseCount('production_runs', 0);
            $this->assertSame(
                0,
                InventoryMovement::query()
                    ->whereIn('movement_type', ['production_out', 'production_in'])
                    ->count()
            );
        }
    }

    public function test_direct_coconut_to_cooked_run_blocks_unrealistic_output_ratio(): void
    {
        config()->set('production.max_kg_per_pc', 0.60);

        Inventory::query()
            ->where('product_variant_id', $this->coconutVariant->id)
            ->update(['quantity_on_hand' => 100]);

        $this->coconutVariant->update(['purchase_price' => 10]);

        /** @var ProductionService $service */
        $service = app(ProductionService::class);

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('Output weight exceeds realistic biological limits.');

        try {
            $service->createRun([
                'run_type' => 'coconut_to_cooked',
                'input_variant_id' => $this->coconutVariant->id,
                'output_variant_id' => $this->cookedVariant->id,
                'input_qty' => 10,
                'output_weight_kg' => 8,
                'production_date' => now()->toDateString(),
            ], $this->admin->id);
        } finally {
            $this->assertDatabaseHas('inventory', [
                'product_variant_id' => $this->coconutVariant->id,
                'quantity_on_hand' => 100,
            ]);

            $this->assertDatabaseHas('inventory', [
                'product_variant_id' => $this->cookedVariant->id,
                'quantity_on_hand' => 0,
            ]);

            $this->assertDatabaseCount('production_runs', 0);
        }
    }

    public function test_direct_coconut_to_cooked_transfers_cost_and_creates_movements(): void
    {
        Inventory::query()
            ->where('product_variant_id', $this->coconutVariant->id)
            ->update(['quantity_on_hand' => 100]);

        $this->coconutVariant->update(['purchase_price' => 15]);

        /** @var ProductionService $service */
        $service = app(ProductionService::class);

        $run = $service->createRun([
            'run_type' => 'coconut_to_cooked',
            'input_variant_id' => $this->coconutVariant->id,
            'output_variant_id' => $this->cookedVariant->id,
            'input_qty' => 20,
            'output_weight_kg' => 10,
            'production_date' => now()->toDateString(),
            'notes' => 'Direct run test',
        ], $this->admin->id);

        $this->assertEquals('300.0000', (string) $run->total_input_cost);
        $this->assertEquals('30.0000', (string) $run->output_unit_cost);
        $this->assertNull($run->yield_percent);

        $this->assertDatabaseHas('inventory_movements', [
            'product_variant_id' => $this->coconutVariant->id,
            'movement_type' => 'production_out',
            'qty' => -20,
            'total_cost' => 300,
            'reference_type' => 'Production',
            'reference_id' => $run->id,
        ]);

        $this->assertDatabaseHas('inventory_movements', [
            'product_variant_id' => $this->cookedVariant->id,
            'movement_type' => 'production_in',
            'qty' => 10,
            'unit_cost' => 30,
            'total_cost' => 300,
            'reference_type' => 'Production',
            'reference_id' => $run->id,
        ]);
    }

    public function test_cooked_sale_prevents_insufficient_stock(): void
    {
        Inventory::query()
            ->where('product_variant_id', $this->cookedVariant->id)
            ->update(['quantity_on_hand' => 2]);

        $this->cookedVariant->update([
            'unit_price' => 45,
            'purchase_price' => 30,
        ]);

        /** @var CookedCopraSaleService $service */
        $service = app(CookedCopraSaleService::class);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Insufficient cooked copra stock');

        try {
            $service->createSale([
                'quantity' => 5,
                'unit_price' => 45,
                'sale_date' => now()->toDateString(),
            ], $this->admin->id);
        } finally {
            $this->assertDatabaseCount('sales', 0);
            $this->assertDatabaseCount('sale_items', 0);
            $this->assertDatabaseMissing('inventory_movements', [
                'movement_type' => 'sale_out',
                'product_variant_id' => $this->cookedVariant->id,
            ]);
            $this->assertDatabaseHas('inventory', [
                'product_variant_id' => $this->cookedVariant->id,
                'quantity_on_hand' => 2,
            ]);
        }
    }

    public function test_cooked_sale_snapshots_cost_and_records_movement(): void
    {
        Inventory::query()
            ->where('product_variant_id', $this->cookedVariant->id)
            ->update(['quantity_on_hand' => 100]);

        $this->cookedVariant->update([
            'unit_price' => 45,
            'purchase_price' => 30,
        ]);

        /** @var CookedCopraSaleService $service */
        $service = app(CookedCopraSaleService::class);

        $sale = $service->createSale([
            'quantity' => 10,
            'unit_price' => 45,
            'sale_date' => now()->toDateString(),
            'customer_name' => 'Walk-in',
            'notes' => 'Cooked sale test',
        ], $this->admin->id);

        $this->assertDatabaseHas('sales', [
            'id' => $sale->id,
            'status' => 'OPEN',
            'payment_status' => 'UNPAID',
            'customer_name' => 'Walk-in',
            'total' => 450,
        ]);

        $this->assertDatabaseHas('sale_items', [
            'sale_id' => $sale->id,
            'product_variant_id' => $this->cookedVariant->id,
            'quantity' => 10,
            'unit_price' => 45,
            'line_total' => 450,
            'unit_cost' => 30,
            'total_cost' => 300,
            'profit' => 150,
        ]);

        $this->assertDatabaseHas('inventory_movements', [
            'product_variant_id' => $this->cookedVariant->id,
            'movement_type' => 'sale_out',
            'qty' => -10,
            'unit_cost' => 30,
            'total_cost' => 300,
            'reference_type' => 'Sale',
            'reference_id' => $sale->id,
        ]);

        $this->assertDatabaseHas('inventory', [
            'product_variant_id' => $this->cookedVariant->id,
            'quantity_on_hand' => 90,
        ]);
    }

    public function test_transaction_rolls_back_when_movement_insert_fails(): void
    {
        Inventory::query()
            ->where('product_variant_id', $this->coconutVariant->id)
            ->update(['quantity_on_hand' => 10]);

        /** @var StockAdjustmentService $stockAdjustmentService */
        $stockAdjustmentService = app(StockAdjustmentService::class);

        $this->expectException(QueryException::class);

        try {
            $stockAdjustmentService->adjustStock([
                'product_variant_id' => $this->coconutVariant->id,
                'actual_quantity' => 8,
                'reason' => 'correction',
                'notes' => 'Rollback test',
            ], 999999);
        } finally {
            $this->assertDatabaseHas('inventory', [
                'product_variant_id' => $this->coconutVariant->id,
                'quantity_on_hand' => 10,
            ]);

            $this->assertSame(
                0,
                InventoryMovement::query()
                    ->where('product_variant_id', $this->coconutVariant->id)
                    ->where('movement_type', 'adjustment')
                    ->count()
            );
        }
    }

    public function test_cooked_sale_rolls_back_when_sale_insert_fails(): void
    {
        Inventory::query()
            ->where('product_variant_id', $this->cookedVariant->id)
            ->update(['quantity_on_hand' => 25]);

        $this->cookedVariant->update([
            'unit_price' => 45,
            'purchase_price' => 30,
        ]);

        /** @var CookedCopraSaleService $service */
        $service = app(CookedCopraSaleService::class);

        $this->expectException(QueryException::class);

        try {
            $service->createSale([
                'quantity' => 5,
                'unit_price' => 45,
                'sale_date' => now()->toDateString(),
            ], 999999);
        } finally {
            $this->assertDatabaseCount('sales', 0);
            $this->assertDatabaseCount('sale_items', 0);
            $this->assertDatabaseMissing('inventory_movements', [
                'movement_type' => 'sale_out',
                'product_variant_id' => $this->cookedVariant->id,
            ]);
            $this->assertDatabaseHas('inventory', [
                'product_variant_id' => $this->cookedVariant->id,
                'quantity_on_hand' => 25,
            ]);
        }
    }

    private function createVariant(
        int $categoryId,
        string $sku,
        string $name,
        string $unit,
        bool $isWeighed
    ): ProductVariant {
        $product = Product::query()->create([
            'category_id' => $categoryId,
            'name' => $name,
            'sku' => $sku,
            'base_unit' => $unit,
            'official_stock_unit' => $unit,
            'is_weighed' => $isWeighed,
            'track_stock' => true,
            'is_active' => true,
        ]);

        $variant = ProductVariant::query()->create([
            'product_id' => $product->id,
            'description' => $name,
            'unit_price' => 0,
            'purchase_price' => 0,
        ]);

        Inventory::query()->create([
            'product_variant_id' => $variant->id,
            'quantity_on_hand' => 0,
        ]);

        return $variant;
    }
}
