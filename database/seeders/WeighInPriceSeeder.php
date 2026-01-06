<?php

namespace Database\Seeders;

use App\Models\WeighInPrice;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class WeighInPriceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create default prices (you can set these to 0 or any default value)
        WeighInPrice::updateOrCreate(
            ['type' => 'cooked_copra'],
            ['price' => 0.00]
        );

        WeighInPrice::updateOrCreate(
            ['type' => 'uncooked_copra'],
            ['price' => 0.00]
        );

        WeighInPrice::updateOrCreate(
            ['type' => 'coconut'],
            ['price' => 0.00]
        );
    }
}
