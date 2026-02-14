<?php

namespace Database\Seeders;

use App\Models\ProductCategory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Inventory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProductSeeder extends Seeder
{

    /**
     * Run the database seeds.
     * Seeds all hardware products for Joshua Trading
     */
    public function run(): void
    {
        // Delete existing non-agricultural products
        $this->cleanExistingProducts();

        // Create categories
        $hardwareCategory = ProductCategory::firstOrCreate(
            ['name' => 'Hardware'],
            ['description' => 'Building materials and hardware supplies', 'is_active' => true]
        );

        $plumbingCategory = ProductCategory::firstOrCreate(
            ['name' => 'Plumbing'],
            ['description' => 'PVC pipes and plumbing supplies', 'is_active' => true]
        );

        $constructionCategory = ProductCategory::firstOrCreate(
            ['name' => 'Construction Materials'],
            ['description' => 'Sand, gravel, cement and construction supplies', 'is_active' => true]
        );

        $woodCategory = ProductCategory::firstOrCreate(
            ['name' => 'Wood & Lumber'],
            ['description' => 'Plywood, coco lumber and wood products', 'is_active' => true]
        );

        $roofingCategory = ProductCategory::firstOrCreate(
            ['name' => 'Roofing'],
            ['description' => 'Yero, roofing sheets and accessories', 'is_active' => true]
        );

        $toolsCategory = ProductCategory::firstOrCreate(
            ['name' => 'Tools'],
            ['description' => 'Hand tools and equipment', 'is_active' => true]
        );

        // ==========================================
        // NAILS (Hardware Category)
        // ==========================================
        $cwn = Product::create([
            'sku' => 'CWN',
            'category_id' => $hardwareCategory->id,
            'name' => 'Common Wire Nail (CWN)',
            'brand' => null,
            'base_unit' => 'kl',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($cwn->id, [
            'size' => '1"',
            'description' => 'CWN 1 inch',
            'unit_price' => 100.00,
        ]);

        $this->createVariantWithInventory($cwn->id, [
            'size' => '1½"',
            'description' => 'CWN 1½ inch',
            'unit_price' => 90.00,
        ]);

        $this->createVariantWithInventory($cwn->id, [
            'size' => '2"',
            'description' => 'CWN 2 inch',
            'unit_price' => 80.00,
        ]);

        $this->createVariantWithInventory($cwn->id, [
            'size' => '2½"',
            'description' => 'CWN 2½ inch',
            'unit_price' => 80.00,
        ]);

        $this->createVariantWithInventory($cwn->id, [
            'size' => '3"',
            'description' => 'CWN 3 inch',
            'unit_price' => 80.00,
        ]);

        $this->createVariantWithInventory($cwn->id, [
            'size' => '4"',
            'description' => 'CWN 4 inch',
            'unit_price' => 80.00,
        ]);

        // Umbrella Nail
        $umbrellaNail = Product::create([
            'sku' => 'UMB-NAIL',
            'category_id' => $hardwareCategory->id,
            'name' => 'Umbrella Nail',
            'brand' => null,
            'base_unit' => 'kl',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($umbrellaNail->id, [
            'description' => 'Umbrella Nail',
            'unit_price' => 120.00,
        ]);

        // Tie Wire
        $tieWire = Product::create([
            'sku' => 'TIE-WIRE',
            'category_id' => $hardwareCategory->id,
            'name' => 'Tie Wire',
            'brand' => null,
            'base_unit' => 'kl',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($tieWire->id, [
            'size' => '#18',
            'description' => 'Tie Wire #18',
            'unit_price' => 150.00,
        ]);

        // ==========================================
        // TOOLS (Tools Category)
        // ==========================================
        $pala = Product::create([
            'sku' => 'PALA',
            'category_id' => $toolsCategory->id,
            'name' => 'Pala (Shovel)',
            'brand' => null,
            'base_unit' => 'pc',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($pala->id, [
            'description' => 'Pala (Shovel)',
            'unit_price' => 400.00,
        ]);

        // Vulcaseal
        $vulcaseal = Product::create([
            'sku' => 'VULCASEAL',
            'category_id' => $hardwareCategory->id,
            'name' => 'Vulcaseal',
            'brand' => null,
            'base_unit' => 'pc',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($vulcaseal->id, [
            'description' => 'Vulcaseal',
            'unit_price' => 85.00,
        ]);

        // ==========================================
        // YERO / ROOFING (Roofing Category)
        // ==========================================
        $yero = Product::create([
            'sku' => 'YERO',
            'category_id' => $roofingCategory->id,
            'name' => 'Yero (GI Sheet)',
            'brand' => null,
            'base_unit' => 'pc',
            'track_stock' => true,
            'is_active' => true,
        ]);

        // Plain Yero
        $this->createVariantWithInventory($yero->id, [
            'size' => '8ft',
            'thickness' => '0.30mm',
            'description' => 'Yero 8ft .30 thickness',
            'unit_price' => 400.00,
        ]);

        $this->createVariantWithInventory($yero->id, [
            'size' => '8ft',
            'thickness' => '0.40mm',
            'description' => 'Yero 8ft .40 thickness',
            'unit_price' => 450.00,
        ]);

        $this->createVariantWithInventory($yero->id, [
            'size' => '10ft',
            'thickness' => '0.30mm',
            'description' => 'Yero 10ft .30 thickness',
            'unit_price' => 500.00,
        ]);

        $this->createVariantWithInventory($yero->id, [
            'size' => '10ft',
            'thickness' => '0.40mm',
            'description' => 'Yero 10ft .40 thickness',
            'unit_price' => 550.00,
        ]);

        $this->createVariantWithInventory($yero->id, [
            'size' => '12ft',
            'thickness' => '0.30mm',
            'description' => 'Yero 12ft .30 thickness',
            'unit_price' => 580.00,
        ]);

        $this->createVariantWithInventory($yero->id, [
            'size' => '12ft',
            'thickness' => '0.40mm',
            'description' => 'Yero 12ft .40 thickness',
            'unit_price' => 830.00,
        ]);

        // Colored Yero
        $yeroColored = Product::create([
            'sku' => 'YERO-COLOR',
            'category_id' => $roofingCategory->id,
            'name' => 'Yero w/ Color',
            'brand' => null,
            'base_unit' => 'pc',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($yeroColored->id, [
            'size' => '8ft',
            'thickness' => '0.30mm',
            'description' => 'Yero 8ft w/ color .30',
            'unit_price' => 450.00,
        ]);

        $this->createVariantWithInventory($yeroColored->id, [
            'size' => '10ft',
            'description' => 'Yero 10ft w/ color',
            'unit_price' => 500.00,
        ]);

        $this->createVariantWithInventory($yeroColored->id, [
            'size' => '12ft',
            'description' => 'Yero 12ft w/ color',
            'unit_price' => 650.00,
        ]);

        // Plain Sheet
        $plainSheet = Product::create([
            'sku' => 'PLAIN-SHEET',
            'category_id' => $roofingCategory->id,
            'name' => 'Plain Sheet',
            'brand' => null,
            'base_unit' => 'pc',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($plainSheet->id, [
            'description' => 'Plain Sheet',
            'unit_price' => 350.00,
        ]);

        $this->createVariantWithInventory($plainSheet->id, [
            'thickness' => '0.30mm',
            'description' => 'Plain Sheet .30',
            'unit_price' => 475.00,
        ]);

        // ==========================================
        // STEEL BAR (Construction Category)
        // ==========================================
        $steelBar = Product::create([
            'sku' => 'STEEL-BAR',
            'category_id' => $constructionCategory->id,
            'name' => 'Steel Bar',
            'brand' => null,
            'base_unit' => 'pc',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($steelBar->id, [
            'diameter' => '9mm',
            'description' => 'Steel Bar 9mm',
            'unit_price' => 120.00,
        ]);

        $this->createVariantWithInventory($steelBar->id, [
            'diameter' => '10mm',
            'description' => 'Steel Bar 10mm',
            'unit_price' => 170.00,
        ]);

        $this->createVariantWithInventory($steelBar->id, [
            'diameter' => '12mm',
            'description' => 'Steel Bar 12mm',
            'unit_price' => 240.00,
        ]);

        // ==========================================
        // PLYWOOD (Wood Category)
        // ==========================================
        $marinePlywood = Product::create([
            'sku' => 'MARINE-PLY',
            'category_id' => $woodCategory->id,
            'name' => 'Marine Plywood',
            'brand' => null,
            'base_unit' => 'pc',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($marinePlywood->id, [
            'thickness' => '1/4"',
            'description' => 'Marine Plywood ¼',
            'unit_price' => 480.00,
        ]);

        $this->createVariantWithInventory($marinePlywood->id, [
            'thickness' => '3/4"',
            'description' => 'Marine Plywood ¾',
            'unit_price' => 1500.00,
        ]);

        $ordPlywood = Product::create([
            'sku' => 'ORD-PLY',
            'category_id' => $woodCategory->id,
            'name' => 'Ordinary Plywood',
            'brand' => null,
            'base_unit' => 'pc',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($ordPlywood->id, [
            'thickness' => '1/4"',
            'description' => 'Ordinary Plywood ¼',
            'unit_price' => 460.00,
        ]);

        $this->createVariantWithInventory($ordPlywood->id, [
            'thickness' => '1/2"',
            'description' => 'Ordinary Plywood ½',
            'unit_price' => 900.00,
        ]);

        // ==========================================
        // COCO LUMBER (Wood Category)
        // ==========================================
        $cocoLumber = Product::create([
            'sku' => 'COCO-LUMBER',
            'category_id' => $woodCategory->id,
            'name' => 'Coco Lumber',
            'brand' => null,
            'base_unit' => 'pc',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($cocoLumber->id, [
            'size' => '2x2x12',
            'description' => 'Coco Lumber 2x2x12',
            'unit_price' => 100.00,
        ]);

        $this->createVariantWithInventory($cocoLumber->id, [
            'size' => '2x3x12',
            'description' => 'Coco Lumber 2x3x12',
            'unit_price' => 120.00,
        ]);

        $this->createVariantWithInventory($cocoLumber->id, [
            'size' => '2x4x12',
            'description' => 'Coco Lumber 2x4x12',
            'unit_price' => 200.00,
        ]);

        // ==========================================
        // CEMENT (Construction Category)
        // ==========================================
        $cement = Product::create([
            'sku' => 'CEMENT',
            'category_id' => $constructionCategory->id,
            'name' => 'Cement',
            'brand' => 'Apo',
            'base_unit' => 'bag',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($cement->id, [
            'description' => 'Apo Cement Red',
            'unit_price' => 280.00,
        ]);

        $this->createVariantWithInventory($cement->id, [
            'description' => 'Apo Cement Blue',
            'unit_price' => 300.00,
        ]);

        // ==========================================
        // SAND & GRAVEL (Construction Category)
        // ==========================================
        $sand = Product::create([
            'sku' => 'SAND',
            'category_id' => $constructionCategory->id,
            'name' => 'Sand',
            'brand' => null,
            'base_unit' => 'cu.m',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($sand->id, [
            'size' => '1 cu.m',
            'description' => 'Sand per cubic meter',
            'unit_price' => 1200.00,
        ]);

        $gravel = Product::create([
            'sku' => 'GRAVEL',
            'category_id' => $constructionCategory->id,
            'name' => 'Gravel',
            'brand' => null,
            'base_unit' => 'cu.m',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($gravel->id, [
            'size' => '1 cu.m',
            'description' => 'Gravel per cubic meter',
            'unit_price' => 1500.00,
        ]);

        $grava = Product::create([
            'sku' => 'GRAVA',
            'category_id' => $constructionCategory->id,
            'name' => 'Grava (Fine Gravel)',
            'brand' => null,
            'base_unit' => 'cu.m',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($grava->id, [
            'size' => '1 cu.m',
            'description' => 'Grava per cubic meter',
            'unit_price' => 1300.00,
        ]);

        // ==========================================
        // PVC PIPES (Plumbing Category)
        // ==========================================
        $pvcPipe = Product::create([
            'sku' => 'PVC-PIPE',
            'category_id' => $plumbingCategory->id,
            'name' => 'PVC Pipe',
            'brand' => null,
            'base_unit' => 'pc',
            'track_stock' => true,
            'is_active' => true,
        ]);

        $this->createVariantWithInventory($pvcPipe->id, [
            'size' => '#2',
            'description' => 'PVC Pipe #2',
            'unit_price' => 160.00,
        ]);

        $this->createVariantWithInventory($pvcPipe->id, [
            'size' => '#3',
            'description' => 'PVC Pipe #3',
            'unit_price' => 350.00,
        ]);

        $this->createVariantWithInventory($pvcPipe->id, [
            'size' => '#4',
            'description' => 'PVC Pipe #4',
            'unit_price' => 400.00,
        ]);

        $this->outputInfo('Product seeder completed - ' . Product::count() . ' products created');
    }

    /**
     * Create a product variant with inventory initialized to 0
     */
    private function createVariantWithInventory(int $productId, array $data): ProductVariant
    {
        $variant = ProductVariant::create(array_merge(['product_id' => $productId], $data));
        
        Inventory::create([
            'product_variant_id' => $variant->id,
            'quantity_on_hand' => 0,
        ]);

        return $variant;
    }

    /**
     * Clean existing non-agricultural products
     */
    private function cleanExistingProducts(): void
    {
        // Get agricultural category ID to exclude
        $agriculturalCategory = ProductCategory::where('name', 'Agricultural Products')->first();
        $excludeCategoryId = $agriculturalCategory?->id;

        // Get product IDs to delete (non-agricultural)
        $productIdsToDelete = Product::when($excludeCategoryId, function ($query) use ($excludeCategoryId) {
            return $query->where('category_id', '!=', $excludeCategoryId);
        })->pluck('id');

        if ($productIdsToDelete->isEmpty()) {
            return;
        }

        // Get variant IDs to delete
        $variantIdsToDelete = ProductVariant::whereIn('product_id', $productIdsToDelete)->pluck('id');

        // Delete in order: refund_items -> sale_items -> delivery_items -> inventory -> variants -> products
        if ($variantIdsToDelete->isNotEmpty()) {
            // Get sale item IDs for these variants
            $saleItemIds = DB::table('sale_items')->whereIn('product_variant_id', $variantIdsToDelete)->pluck('id');
            
            // Delete refund items first (foreign key to sale_items)
            if ($saleItemIds->isNotEmpty()) {
                DB::table('refund_items')->whereIn('sale_item_id', $saleItemIds)->delete();
            }
            
            // Delete sale items
            DB::table('sale_items')->whereIn('product_variant_id', $variantIdsToDelete)->delete();
            
            // Delete delivery items (if any)
            DB::table('delivery_items')->whereIn('product_variant_id', $variantIdsToDelete)->delete();
            
            // Delete inventory movements
            DB::table('inventory_movements')->whereIn('product_variant_id', $variantIdsToDelete)->delete();
            
            // Delete inventory records
            Inventory::whereIn('product_variant_id', $variantIdsToDelete)->delete();
            
            // Delete variants
            ProductVariant::whereIn('id', $variantIdsToDelete)->delete();
        }

        // Delete products
        Product::whereIn('id', $productIdsToDelete)->delete();

        // Delete unused categories (except Agricultural Products)
        ProductCategory::whereDoesntHave('products')
            ->where('name', '!=', 'Agricultural Products')
            ->delete();

        $this->outputInfo('Cleaned existing non-agricultural products');
    }

    private function outputInfo(string $message): void
    {
        if ($this->command) {
            $this->command->info($message);

            return;
        }

        logger()->info($message);
    }
}
