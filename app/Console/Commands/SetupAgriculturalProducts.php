<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Database\Seeders\AgriculturalProductsSeeder;

class SetupAgriculturalProducts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'weigh-ins:setup-products';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Set up Agricultural Products category and product variants for copra/coconut inventory tracking';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Setting up Agricultural Products...');
        
        $seeder = new AgriculturalProductsSeeder();
        $seeder->run();
        
        $this->info('✓ Agricultural Products category created');
        $this->info('✓ Product variants created for:');
        $this->info('  - Cooked Copra');
        $this->info('  - Uncooked Copra');
        $this->info('  - Coconut');
        $this->info('');
        $this->info('These products are now ready for inventory tracking via weigh-ins.');
        $this->info('They will be excluded from POS but visible in Inventory Management.');
        
        return Command::SUCCESS;
    }
}

