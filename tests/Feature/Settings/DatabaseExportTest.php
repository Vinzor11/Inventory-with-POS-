<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DatabaseExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_settings_page_requires_authentication(): void
    {
        $this->get(route('settings.database.edit'))
            ->assertRedirect(route('login'));
    }

    public function test_non_admin_users_cannot_access_database_export_features(): void
    {
        $staffUser = User::factory()->create([
            'role' => 'staff',
        ]);

        $this->actingAs($staffUser)
            ->get(route('settings.database.edit'))
            ->assertForbidden();

        $this->actingAs($staffUser)
            ->get(route('settings.database.export'))
            ->assertForbidden();
    }

    public function test_admin_user_can_export_database_as_sql_dump(): void
    {
        $adminUser = User::factory()->create([
            'role' => 'admin',
            'name' => 'Backup Admin',
            'email' => 'backup-admin@example.com',
        ]);

        $response = $this->actingAs($adminUser)
            ->get(route('settings.database.export'));

        $response
            ->assertOk()
            ->assertHeader('content-type', 'application/sql; charset=UTF-8')
            ->assertHeader('content-disposition');

        $content = $response->streamedContent();

        $this->assertStringContainsString('-- HIMS SQL Dump', $content);
        $this->assertStringContainsString('CREATE TABLE', $content);
        $this->assertStringContainsString('INSERT INTO', $content);
        $this->assertStringContainsString('backup-admin@example.com', $content);
    }
}
