<?php

namespace App\Console\Commands;

use App\Models\Sale;
use Illuminate\Console\Command;

class UpdatePaymentStatuses extends Command
{
    protected $signature = 'sales:update-payment-statuses';
    protected $description = 'Update all sales payment statuses to use new uppercase format';

    public function handle()
    {
        $this->info('Updating payment statuses...');
        
        $count = 0;
        Sale::chunk(100, function ($sales) use (&$count) {
            foreach ($sales as $sale) {
                $sale->updatePaymentStatus();
                $count++;
            }
        });

        $this->info("Updated {$count} sales.");
        return 0;
    }
}
