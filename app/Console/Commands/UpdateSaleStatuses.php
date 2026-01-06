<?php

namespace App\Console\Commands;

use App\Models\Sale;
use Illuminate\Console\Command;

class UpdateSaleStatuses extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sales:update-statuses';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Update all sales statuses based on current payment, delivery, and refund statuses';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Updating sale statuses...');

        $sales = Sale::with(['payments', 'refunds', 'deliveries.items'])->get();
        $bar = $this->output->createProgressBar($sales->count());
        $bar->start();

        $updated = 0;
        foreach ($sales as $sale) {
            // Refresh sale to ensure we have latest data
            $sale->refresh();
            $sale->load(['payments', 'refunds', 'deliveries.items']);
            
            // Recompute sale status based on current state
            $sale->computeSaleStatus();
            $updated++;
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("Updated {$updated} sales.");

        return Command::SUCCESS;
    }
}

