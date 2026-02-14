<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $defaultBranchId = (int) config('pos_bootstrap.store.id', 1);

        Schema::table('inventory_movements', function (Blueprint $table) use ($defaultBranchId): void {
            if (!Schema::hasColumn('inventory_movements', 'branch_id')) {
                $table->unsignedBigInteger('branch_id')->default($defaultBranchId)->after('id');
            }

            if (!Schema::hasColumn('inventory_movements', 'client_request_id')) {
                $table->uuid('client_request_id')->nullable()->after('branch_id');
            }
        });

        Schema::table('inventory_movements', function (Blueprint $table): void {
            $table->unique(['branch_id', 'client_request_id'], 'inventory_mov_branch_client_request_unique');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table): void {
            try {
                $table->dropUnique('inventory_mov_branch_client_request_unique');
            } catch (\Throwable) {
                // Ignore if index does not exist.
            }

            if (Schema::hasColumn('inventory_movements', 'client_request_id')) {
                $table->dropColumn('client_request_id');
            }

            if (Schema::hasColumn('inventory_movements', 'branch_id')) {
                $table->dropColumn('branch_id');
            }
        });
    }
};
