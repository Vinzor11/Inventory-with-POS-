<?php

namespace Tests\Feature;

use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class InventoryPhase2Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a test user
        $this->user = User::factory()->create([
            'email' => 'admin@example.com',
            'role' => 'admin',
        ]);
    }

    /** @test */
    public function inventory_movements_table_has_notes_column()
    {
        $this->assertTrue(
            \Schema::hasColumn('inventory_movements', 'notes'),
            'inventory_movements table should have notes column'
        );
    }

    /** @test */
    public function inventory_movements_table_has_nullable_unit_cost()
    {
        $this->assertTrue(
            \Schema::hasColumn('inventory_movements', 'unit_cost'),
            'inventory_movements table should have unit_cost column'
        );
    }

    /** @test */
    public function stock_in_requires_unit_cost()
    {
        $variant = $this->createVariantWithInventory(0);

        $this->actingAs($this->user);

        $response = $this->post('/inventory/stock-in', [
            'product_variant_id' => $variant->id,
            'quantity' => 10,
            // Missing unit_cost
        ]);

        $response->assertSessionHasErrors('unit_cost');
    }

    /** @test */
    public function stock_in_creates_movement_with_unit_cost()
    {
        $variant = $this->createVariantWithInventory(0);

        $this->actingAs($this->user);

        $response = $this->post('/inventory/stock-in', [
            'product_variant_id' => $variant->id,
            'quantity' => 10,
            'unit_cost' => 25.50,
            'notes' => 'Test stock-in',
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('inventory_movements', [
            'product_variant_id' => $variant->id,
            'quantity' => 10,
            'type' => 'IN',
            'unit_cost' => 25.50,
            'notes' => 'Test stock-in',
        ]);

        $this->assertDatabaseHas('inventory', [
            'product_variant_id' => $variant->id,
            'quantity_on_hand' => 10,
        ]);
    }

    /** @test */
    public function adjustment_requires_notes()
    {
        $variant = $this->createVariantWithInventory(10);

        $this->actingAs($this->user);

        $response = $this->post('/inventory/adjustment', [
            'product_variant_id' => $variant->id,
            'quantity' => -5,
            'reason' => 'damage',
            // Missing notes
        ]);

        $response->assertSessionHasErrors('notes');
    }

    /** @test */
    public function adjustment_creates_movement_with_null_unit_cost()
    {
        $variant = $this->createVariantWithInventory(10);

        $this->actingAs($this->user);

        $response = $this->post('/inventory/adjustment', [
            'product_variant_id' => $variant->id,
            'quantity' => -5,
            'reason' => 'damage',
            'notes' => 'Damaged items removed',
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $movement = InventoryMovement::query()
            ->where('product_variant_id', $variant->id)
            ->where('quantity', 5)
            ->where('type', 'OUT')
            ->whereNull('unit_cost')
            ->latest('id')
            ->first();

        $this->assertNotNull($movement);
        $this->assertTrue(Str::contains((string) $movement->notes, 'Damaged items removed'));

        $this->assertDatabaseHas('inventory', [
            'product_variant_id' => $variant->id,
            'quantity_on_hand' => 5,
        ]);
    }

    /** @test */
    public function inventory_dashboard_page_loads()
    {
        $this->actingAs($this->user);

        $response = $this->get('/inventory/dashboard');

        $response->assertStatus(200);
    }

    /** @test */
    public function stock_in_page_loads()
    {
        $this->actingAs($this->user);

        $response = $this->get('/inventory/stock-in');

        $response->assertStatus(200);
    }

    /** @test */
    public function adjustment_page_loads()
    {
        $this->actingAs($this->user);

        $response = $this->get('/inventory/adjustment');

        $response->assertStatus(200);
    }

    /** @test */
    public function movement_history_page_loads()
    {
        $this->actingAs($this->user);

        $response = $this->get('/inventory/movements');

        $response->assertStatus(200);
    }

    private function createVariantWithInventory(float $quantityOnHand): ProductVariant
    {
        $category = ProductCategory::query()->create([
            'name' => 'Test Category '.uniqid(),
            'description' => 'Test category',
            'is_active' => true,
        ]);

        $product = Product::query()->create([
            'category_id' => $category->id,
            'sku' => 'TEST-'.uniqid(),
            'name' => 'Test Product',
            'base_unit' => 'pc',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $variant = ProductVariant::query()->create([
            'product_id' => $product->id,
            'description' => 'Test Variant',
            'unit_price' => 100,
        ]);

        Inventory::query()->create([
            'product_variant_id' => $variant->id,
            'quantity_on_hand' => $quantityOnHand,
        ]);

        return $variant;
    }
}
