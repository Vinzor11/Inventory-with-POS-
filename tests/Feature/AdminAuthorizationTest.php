<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $staff;

    protected function setUp(): void
    {
        $dbConnection = $_ENV['DB_CONNECTION'] ?? getenv('DB_CONNECTION') ?: null;
        if ($dbConnection === 'sqlite') {
            $this->markTestSkipped(
                'AdminAuthorizationTest requires MySQL-compatible migrations (ENUM ALTER statements are not SQLite-compatible).',
            );
        }

        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'pin' => '1111',
        ]);

        $this->staff = User::factory()->create([
            'role' => 'staff',
            'pin' => '2222',
        ]);
    }

    public function test_staff_cannot_access_users_management_routes(): void
    {
        $this->actingAs($this->staff);

        $this->get('/users')->assertForbidden();

        $this->post('/users', [
            'name' => 'Staff Created User',
            'email' => 'staff-created@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'pin' => '3333',
            'role' => 'admin',
        ])->assertForbidden();
    }

    public function test_admin_can_create_user_with_role(): void
    {
        $this->actingAs($this->admin);

        $response = $this->post('/users', [
            'name' => 'New Admin',
            'email' => 'new-admin@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'pin' => '4444',
            'role' => 'admin',
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('users', [
            'email' => 'new-admin@example.com',
            'role' => 'admin',
        ]);
    }

    public function test_admin_can_deactivate_a_user_account(): void
    {
        $targetUser = User::factory()->create([
            'role' => 'staff',
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->admin)->put("/users/{$targetUser->id}", [
            'name' => $targetUser->name,
            'email' => $targetUser->email,
            'role' => 'staff',
            'is_active' => false,
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('users', [
            'id' => $targetUser->id,
            'is_active' => false,
        ]);
    }

    public function test_staff_cannot_toggle_user_active_status(): void
    {
        $targetUser = User::factory()->create([
            'role' => 'staff',
            'is_active' => true,
        ]);

        $this->actingAs($this->staff)
            ->patch("/users/{$targetUser->id}/toggle-active", [
                'is_active' => false,
            ])
            ->assertForbidden();
    }

    public function test_admin_can_toggle_user_active_status(): void
    {
        $targetUser = User::factory()->create([
            'role' => 'staff',
            'is_active' => true,
        ]);

        $this->actingAs($this->admin)
            ->patch("/users/{$targetUser->id}/toggle-active", [
                'is_active' => false,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('users', [
            'id' => $targetUser->id,
            'is_active' => false,
        ]);

        $this->actingAs($this->admin)
            ->patch("/users/{$targetUser->id}/toggle-active", [
                'is_active' => true,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('users', [
            'id' => $targetUser->id,
            'is_active' => true,
        ]);
    }

    public function test_staff_cannot_void_sales(): void
    {
        $sale = $this->createSale(isForDelivery: false);

        $this->actingAs($this->staff)
            ->post("/sales/{$sale->id}/void", [
                'void_reason' => 'Not allowed for staff',
            ])
            ->assertForbidden();
    }

    public function test_staff_cannot_cancel_items_for_delivery_orders(): void
    {
        [$sale, $item] = $this->createDeliverySaleWithItem();

        $this->actingAs($this->staff)
            ->post("/sales/{$sale->id}/cancel-item", [
                'sale_item_id' => $item->id,
                'quantity_to_cancel' => 1,
                'reason' => 'Staff cancel attempt',
            ])
            ->assertForbidden();
    }

    public function test_admin_can_cancel_items_for_delivery_orders(): void
    {
        [$sale, $item] = $this->createDeliverySaleWithItem();

        $response = $this->actingAs($this->admin)
            ->post("/sales/{$sale->id}/cancel-item", [
                'sale_item_id' => $item->id,
                'quantity_to_cancel' => 1,
                'reason' => 'Admin cancel',
            ]);

        $response->assertRedirect(route('sales.show', $sale));

        $this->assertDatabaseHas('sale_items', [
            'id' => $item->id,
            'canceled_quantity' => 1.00,
        ]);
    }

    public function test_staff_cannot_access_refund_processing_page(): void
    {
        $sale = $this->createSale(isForDelivery: false);

        $this->actingAs($this->staff)
            ->get("/sales/{$sale->id}/refund")
            ->assertForbidden();
    }

    public function test_staff_cannot_update_weigh_in_prices(): void
    {
        $this->actingAs($this->staff)
            ->put('/weigh-ins/prices/coconut', [
                'price' => 25.50,
            ])
            ->assertForbidden();
    }

    public function test_staff_cannot_void_sales_via_api(): void
    {
        $sale = $this->createSale(isForDelivery: false);

        Sanctum::actingAs($this->staff);

        $this->postJson("/api/sales/{$sale->id}/void", [
            'reason' => 'Staff API void attempt',
        ])->assertForbidden();
    }

    public function test_staff_cannot_cancel_delivery_items_via_api(): void
    {
        [$sale, $item] = $this->createDeliverySaleWithItem();

        Sanctum::actingAs($this->staff);

        $this->postJson("/api/sales/{$sale->id}/cancel-item", [
            'sale_item_id' => $item->id,
            'quantity_to_cancel' => 1,
            'reason' => 'Staff API cancel attempt',
        ])->assertForbidden();
    }

    public function test_staff_cannot_process_refunds_via_api(): void
    {
        [$sale, $item] = $this->createDeliverySaleWithItem();

        Sanctum::actingAs($this->staff);

        $this->postJson("/api/sales/{$sale->id}/refund", [
            'items' => [
                [
                    'sale_item_id' => $item->id,
                    'quantity' => 1,
                ],
            ],
            'reason' => 'Staff API refund attempt',
            'refund_method' => 'cash',
        ])->assertForbidden();
    }

    public function test_staff_cannot_update_weigh_in_prices_via_api(): void
    {
        Sanctum::actingAs($this->staff);

        $this->putJson('/api/weigh-in-prices/coconut', [
            'price' => 25.50,
        ])->assertForbidden();
    }

    public function test_admin_can_update_weigh_in_prices(): void
    {
        $response = $this->actingAs($this->admin)
            ->put('/weigh-ins/prices/coconut', [
                'price' => 25.50,
            ]);

        $response->assertRedirect(route('weigh-ins.prices.index'));

        $this->assertDatabaseHas('weigh_in_prices', [
            'type' => 'coconut',
            'price' => 25.50,
        ]);
    }

    private function createDeliverySaleWithItem(): array
    {
        $variant = $this->createProductVariant();

        $sale = $this->createSale(isForDelivery: true);

        $item = SaleItem::create([
            'sale_id' => $sale->id,
            'product_variant_id' => $variant->id,
            'quantity' => 2,
            'unit_price' => 50.00,
            'line_total' => 100.00,
        ]);

        return [$sale, $item];
    }

    private function createSale(bool $isForDelivery): Sale
    {
        return Sale::create([
            'sale_number' => 'SALE-TEST-' . Str::upper(Str::random(8)),
            'status' => 'OPEN',
            'payment_status' => 'UNPAID',
            'is_for_delivery' => $isForDelivery,
            'delivery_status' => $isForDelivery ? 'PENDING' : null,
            'subtotal' => 100.00,
            'total' => 100.00,
            'cashier_user_id' => $this->admin->id,
        ]);
    }

    private function createProductVariant(): ProductVariant
    {
        $category = ProductCategory::create([
            'name' => 'Test Category ' . Str::random(6),
            'is_active' => true,
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Test Product ' . Str::random(6),
            'sku' => 'SKU-' . Str::upper(Str::random(6)),
            'base_unit' => 'pcs',
            'track_stock' => true,
            'is_active' => true,
        ]);

        return ProductVariant::create([
            'product_id' => $product->id,
            'description' => 'Test Variant',
            'size' => 'M',
            'unit_price' => 50.00,
        ]);
    }
}
