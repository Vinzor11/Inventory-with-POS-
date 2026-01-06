<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Creates a default admin user with the following credentials:
     * Email: admin@example.com
     * Password: password
     * PIN: 1234
     * Role: admin
     */
    public function up(): void
    {
        // Check if admin user already exists
        $adminExists = DB::table('users')->where('email', 'amosjoseph@gmail.com')->exists();
        
        if (!$adminExists) {
            DB::table('users')->insert([
                'name' => 'Joseph Amos',
                'email' => 'amosjoseph@gmail.com',
                'password' => Hash::make('password'),
                'pin' => Hash::make('1234'),
                'role' => 'admin',
                'email_verified_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('users')->where('email', 'admin@example.com')->delete();
    }
};
