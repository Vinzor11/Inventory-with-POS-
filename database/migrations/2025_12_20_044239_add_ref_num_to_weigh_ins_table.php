<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Check if column exists, if not add it
        if (!Schema::hasColumn('weigh_ins', 'ref_num')) {
            Schema::table('weigh_ins', function (Blueprint $table) {
                $table->string('ref_num')->nullable()->after('id');
            });
        }

        // Drop unique constraint if it exists (in case of previous failed migration)
        try {
            Schema::table('weigh_ins', function (Blueprint $table) {
                $table->dropUnique(['ref_num']);
            });
        } catch (\Exception $e) {
            // Constraint doesn't exist, continue
        }

        // Generate ref_num for existing records (including empty strings)
        $weighIns = \App\Models\WeighIn::where(function($query) {
            $query->whereNull('ref_num')->orWhere('ref_num', '');
        })->get();
        
        foreach ($weighIns as $weighIn) {
            $weighIn->ref_num = \App\Models\WeighIn::generateRefNum();
            $weighIn->save();
        }

        // Now make it unique and not nullable
        Schema::table('weigh_ins', function (Blueprint $table) {
            $table->string('ref_num')->unique()->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('weigh_ins', function (Blueprint $table) {
            $table->dropColumn('ref_num');
        });
    }
};
