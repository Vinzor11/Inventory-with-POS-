<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserDeactivationApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        $dbConnection = $_ENV['DB_CONNECTION'] ?? getenv('DB_CONNECTION') ?: null;
        if ($dbConnection === 'sqlite') {
            $this->markTestSkipped(
                'UserDeactivationApiTest requires MySQL-compatible migrations (ENUM ALTER statements are not SQLite-compatible).',
            );
        }

        parent::setUp();
    }

    public function test_inactive_user_cannot_login_with_email_and_password(): void
    {
        $user = User::factory()->create([
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'phpunit',
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_inactive_user_cannot_login_with_pin(): void
    {
        User::factory()->create([
            'is_active' => false,
            'pin' => '1234',
        ]);

        $response = $this->postJson('/api/auth/login-pin', [
            'pin' => '1234',
            'device_name' => 'phpunit',
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors('pin');
    }

    public function test_inactive_user_pin_cannot_be_used_for_transaction_pin_verification(): void
    {
        $activeUser = User::factory()->create([
            'is_active' => true,
        ]);

        User::factory()->create([
            'is_active' => false,
            'pin' => '5678',
        ]);

        Sanctum::actingAs($activeUser);

        $response = $this->postJson('/api/pos/verify-pin', [
            'pin' => '5678',
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors('pin');
    }

    public function test_deactivated_user_token_is_blocked_from_protected_api_routes(): void
    {
        $user = User::factory()->create([
            'is_active' => true,
        ]);

        $token = $user->createToken('phpunit')->plainTextToken;
        $user->update(['is_active' => false]);

        $response = $this
            ->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/auth/user');

        $response
            ->assertStatus(403)
            ->assertJson([
                'message' => 'Your account has been deactivated. Contact an administrator.',
            ]);
    }
}
