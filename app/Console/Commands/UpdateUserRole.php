<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class UpdateUserRole extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:role {email} {role}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Update user role (admin or staff)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = $this->argument('email');
        $role = $this->argument('role');

        if (!in_array($role, ['admin', 'staff'])) {
            $this->error('Role must be either "admin" or "staff"');
            return Command::FAILURE;
        }

        $user = User::where('email', $email)->first();

        if (!$user) {
            $this->error("User with email '{$email}' not found.");
            return Command::FAILURE;
        }

        $user->role = $role;
        $user->save();

        $this->info("User '{$user->name}' ({$email}) role updated to '{$role}'");
        return Command::SUCCESS;
    }
}
