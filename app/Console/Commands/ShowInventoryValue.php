<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ShowInventoryValue extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inventory:show-value';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Shows how the inventory value is calculated';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('=== Inventory Value Calculation Breakdown ===');
        $this->newLine();

        // Get agricultural category ID
        $agriculturalCategoryId = DB::table('product_categories')
            ->where('name', 'Agricultural Products')
            ->value('id');

        // Calculate inventory value (excluding agricultural products, using purchase_price)
        $query = DB::table('inventory')
            ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->whereNotNull('product_variants.purchase_price')
            ->where('product_variants.purchase_price', '>', 0);
        
        // Explicitly exclude agricultural products
        if ($agriculturalCategoryId) {
            $query->where('products.category_id', '!=', $agriculturalCategoryId);
        }
        
        // Get detailed breakdown
        $items = $query
            ->selectRaw('
                products.name as product_name,
                products.sku,
                product_variants.description as variant_description,
                product_variants.purchase_price,
                inventory.quantity_on_hand,
                (inventory.quantity_on_hand * product_variants.purchase_price) as line_value
            ')
            ->orderBy('products.name')
            ->orderBy('product_variants.description')
            ->get();

        $this->table(
            ['Product', 'Variant', 'Qty', 'Purchase Price', 'Line Value'],
            $items->map(function ($item) {
                return [
                    $item->product_name . ($item->sku ? " ({$item->sku})" : ''),
                    $item->variant_description,
                    number_format($item->quantity_on_hand, 2),
                    '₱' . number_format($item->purchase_price, 2),
                    '₱' . number_format($item->line_value, 2),
                ];
            })->toArray()
        );

        $totalValue = $items->sum('line_value');
        
        $this->newLine();
        $this->info("Total Inventory Value: ₱" . number_format($totalValue, 2));
        $this->newLine();
        
        $this->info('Calculation Formula:');
        $this->line('  SUM(quantity_on_hand × purchase_price)');
        $this->newLine();
        
        $this->info('Filters Applied:');
        $this->line('  ✓ purchase_price is NOT NULL');
        $this->line('  ✓ purchase_price > 0');
        if ($agriculturalCategoryId) {
            $this->line('  ✓ Excludes "Agricultural Products" category');
        } else {
            $this->line('  ⚠ Agricultural Products category not found');
        }
        
        return 0;
    }
}

