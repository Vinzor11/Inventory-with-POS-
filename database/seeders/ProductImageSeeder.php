<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

class ProductImageSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * 
     * Copies product images from "J Trading" folder to storage/app/public/products/
     * and updates products table with image paths based on SKU matching.
     */
    public function run(): void
    {
        // Mapping of image filenames to product SKUs
        $imageMapping = [
            // Hardware products
            'CWN.JPEG' => 'CWN',
            'umbrella-nails.png' => 'UMB-NAIL',
            'tie wire.jpg' => 'TIE-WIRE',
            'shovel.webp' => 'PALA',
            'vulcaseal.webp' => 'VULCASEAL',
            'yero.webp' => 'YERO',
            'yero with color.jpg' => 'YERO-COLOR',
            'plain sheet.jpeg' => 'PLAIN-SHEET',
            'plan sheet.webp' => 'PLAIN-SHEET', // Alternative filename
            'steel bar.jpg' => 'STEEL-BAR',
            'marine plywood.jpg' => 'MARINE-PLY',
            'ordinary plywood.webp' => 'ORD-PLY',
            'cocolumber.jpg' => 'COCO-LUMBER',
            'Apo.jpg' => 'CEMENT',
            'sand.jpeg' => 'SAND',
            'gravel.jpg' => 'GRAVEL',
            'grava.jpg' => 'GRAVA',
            'pvp pipe.jpg' => 'PVC-PIPE',
            // Agricultural products
            'copra cooked.jpg' => 'COOKED-COPRA',
            'copra uncooked.jpg' => 'UNCOOKED-COPRA',
            'coconut.jpg' => 'COCONUT',
        ];

        $sourceFolder = base_path('J Trading');
        $targetFolder = storage_path('app/public/products');
        $publicStorageLink = public_path('storage');

        $this->command->info("ProductImageSeeder starting...");
        $this->command->info("Source folder: {$sourceFolder}");
        $this->command->info("Target folder: {$targetFolder}");
        
        // Check if source folder exists
        if (!File::exists($sourceFolder)) {
            $this->command->error("✗ 'J Trading' folder not found at: {$sourceFolder}");
            $this->command->error("  Listing base_path contents:");
            $basePath = base_path();
            $dirs = File::directories($basePath);
            foreach ($dirs as $dir) {
                $this->command->info("  - " . basename($dir));
            }
            return;
        }
        
        $this->command->info("✓ Source folder exists");

        // Ensure storage/app/public directory exists
        $publicStoragePath = storage_path('app/public');
        if (!File::exists($publicStoragePath)) {
            File::makeDirectory($publicStoragePath, 0755, true);
        }

        // Create target directory if it doesn't exist
        if (!File::exists($targetFolder)) {
            File::makeDirectory($targetFolder, 0755, true);
        }

        // Ensure storage symlink exists (for public access to images)
        if (!File::exists($publicStorageLink) && !is_link($publicStorageLink)) {
            try {
                // Try to create symlink (may fail on Windows, that's okay)
                if (PHP_OS_FAMILY !== 'Windows') {
                    symlink(storage_path('app/public'), $publicStorageLink);
                }
            } catch (\Exception $e) {
                // Symlink creation failed, but continue anyway
                // The storage:link command in deploy script will handle this
            }
        }

        $processed = 0;
        $skipped = 0;
        $errors = 0;

        // Process each image mapping
        foreach ($imageMapping as $imageFile => $productSku) {
            $sourcePath = $sourceFolder . DIRECTORY_SEPARATOR . $imageFile;
            
            // Check if source file exists
            if (!File::exists($sourcePath)) {
                $this->command->warn("⚠ Image file not found: {$imageFile} (SKU: {$productSku})");
                $skipped++;
                continue;
            }

            // Find product by SKU
            $product = Product::where('sku', $productSku)->first();
            
            if (!$product) {
                $this->command->warn("⚠ Product not found with SKU: {$productSku} (Image: {$imageFile})");
                $skipped++;
                continue;
            }

            // Get file extension
            $extension = pathinfo($imageFile, PATHINFO_EXTENSION);
            
            // Create a clean filename based on SKU
            $targetFilename = strtolower($productSku) . '.' . strtolower($extension);
            $targetPath = $targetFolder . DIRECTORY_SEPARATOR . $targetFilename;
            $imagePath = 'products/' . $targetFilename;

            // Copy file to storage (always copy since Railway filesystem is ephemeral)
            try {
                // Copy the file (overwrite if exists)
                if (!File::copy($sourcePath, $targetPath)) {
                    throw new \Exception("Failed to copy file from {$sourcePath} to {$targetPath}");
                }
                
                // Verify the file was copied successfully
                if (!File::exists($targetPath)) {
                    throw new \Exception("Target file was not created at {$targetPath}");
                }
                
                // Update product with image path only if it's different
                if ($product->image !== $imagePath) {
                    $product->update(['image' => $imagePath]);
                }
                
                $this->command->info("✓ Image copied for {$product->name} (SKU: {$productSku})");
                $processed++;
                    
            } catch (\Exception $e) {
                $this->command->error("✗ Failed to process image {$imageFile} for product {$productSku}: " . $e->getMessage());
                \Log::error("ProductImageSeeder error for {$productSku}: " . $e->getMessage(), [
                    'source' => $sourcePath,
                    'target' => $targetPath,
                    'sku' => $productSku,
                ]);
                $errors++;
            }
        }

        // Summary
        $this->command->newLine();
        $this->command->info("Product Image Seeder Summary:");
        $this->command->info("  ✓ Processed: {$processed}");
        $this->command->warn("  ⚠ Skipped: {$skipped}");
        if ($errors > 0) {
            $this->command->error("  ✗ Errors: {$errors}");
        }
        
        // Clear cache to ensure images are visible immediately
        if ($processed > 0) {
            $this->command->info("  Clearing application cache...");
            \Artisan::call('cache:clear');
            $this->command->info("  ✓ Cache cleared");
        }
    }
}

