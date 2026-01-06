<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Models\ProductCategory;

class DebugInventoryValue extends Command
{
    protected $signature = 'inventory:debug-value';
    protected $description = 'Debug inventory value calculation';

    public function handle()
    {
        $agriculturalCategoryId = ProductCategory::where('name', 'Agricultural Products')
            ->where('is_active', true)
            ->value('id');

        $this->info('Agricultural Category ID: ' . ($agriculturalCategoryId ?? 'NOT FOUND'));
        $this->newLine();

        // Test the dashboard query (InventoryDashboardController)
        $this->info('=== Testing InventoryDashboardController Query ===');
        $query1 = DB::table('inventory')
            ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->join('product_categories', 'products.category_id', '=', 'product_categories.id')
            ->whereNotNull('product_variants.purchase_price')
            ->where('product_variants.purchase_price', '>', 0)
            ->where('product_categories.name', '!=', 'Agricultural Products');
        
        $this->info('SQL: ' . $query1->toSql());
        $this->info('Bindings: ' . json_encode($query1->getBindings()));
        
        $items1 = $query1
            ->selectRaw('products.name, products.category_id, product_variants.purchase_price, inventory.quantity_on_hand, (inventory.quantity_on_hand * product_variants.purchase_price) as value')
            ->get();

        $this->info('Items included:');
        $this->table(
            ['Product', 'Category ID', 'Qty', 'Purchase Price', 'Value'],
            $items1->map(function ($item) use ($agriculturalCategoryId) {
                $isAgricultural = $item->category_id == $agriculturalCategoryId;
                return [
                    $item->name . ($isAgricultural ? ' ⚠ AGRICULTURAL' : ''),
                    $item->category_id . ($isAgricultural ? ' (AGRI)' : ''),
                    number_format($item->quantity_on_hand, 2),
                    '₱' . number_format($item->purchase_price, 2),
                    '₱' . number_format($item->value, 2),
                ];
            })->toArray()
        );

        $total1 = $query1->sum(DB::raw('inventory.quantity_on_hand * product_variants.purchase_price')) ?? 0;
        $this->info('Total (Dashboard): ₱' . number_format($total1, 2));
        $this->newLine();

        // Test InventoryController query
        $this->info('=== Testing InventoryController Query ===');
        $query2 = DB::table('inventory')
            ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->join('product_categories', 'products.category_id', '=', 'product_categories.id')
            ->whereNotNull('product_variants.purchase_price')
            ->where('product_variants.purchase_price', '>', 0)
            ->where('product_categories.name', '!=', 'Agricultural Products');
        
        $total2 = $query2->sum(DB::raw('inventory.quantity_on_hand * product_variants.purchase_price')) ?? 0;
        $this->info('Total (Index): ₱' . number_format($total2, 2));
        $this->newLine();

        // Test Dashboard Service (InventoryMovementReportQueryService)
        $this->info('=== Testing Dashboard Service (InventoryMovementReportQueryService) ===');
        $dashboardService = new \App\Services\InventoryMovementReportQueryService();
        $dashboardValue = $dashboardService->getInventoryValue();
        $this->info('Total (Dashboard Service): ₱' . number_format($dashboardValue, 2));
        $this->newLine();

        // Check agricultural products directly
        if ($agriculturalCategoryId) {
            $this->info('=== Agricultural Products (should be excluded) ===');
            $agriProducts = DB::table('products')
                ->where('category_id', $agriculturalCategoryId)
                ->join('product_variants', 'products.id', '=', 'product_variants.product_id')
                ->join('inventory', 'product_variants.id', '=', 'inventory.product_variant_id')
                ->whereNotNull('product_variants.purchase_price')
                ->where('product_variants.purchase_price', '>', 0)
                ->selectRaw('products.name, product_variants.purchase_price, inventory.quantity_on_hand, (inventory.quantity_on_hand * product_variants.purchase_price) as value')
                ->get();

            foreach ($agriProducts as $p) {
                $this->line("  {$p->name}: Qty={$p->quantity_on_hand}, Purchase Price={$p->purchase_price}, Value={$p->value}");
            }
            
            $agriTotal = $agriProducts->sum('value');
            $this->info('Agricultural Products Total: ₱' . number_format($agriTotal, 2));
            $this->newLine();
            $this->info('If this total is included, the filter is not working!');
        }

        return 0;
    }
}

