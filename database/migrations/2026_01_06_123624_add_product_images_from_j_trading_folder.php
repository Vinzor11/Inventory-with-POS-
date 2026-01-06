<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Copies product images from "J Trading" folder to storage/app/public/products/
     * and updates products table with image paths based on SKU matching.
     */
    public function up(): void
    {
        // Mapping of image filenames to product SKUs
        $imageMapping = [
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
        ];

        $sourceFolder = base_path('J Trading');
        $targetFolder = storage_path('app/public/products');

        // Create target directory if it doesn't exist
        if (!File::exists($targetFolder)) {
            File::makeDirectory($targetFolder, 0755, true);
        }

        // Process each image mapping
        foreach ($imageMapping as $imageFile => $productSku) {
            $sourcePath = $sourceFolder . DIRECTORY_SEPARATOR . $imageFile;
            
            // Check if source file exists
            if (!File::exists($sourcePath)) {
                continue;
            }

            // Get file extension
            $extension = pathinfo($imageFile, PATHINFO_EXTENSION);
            
            // Create a clean filename based on SKU
            $targetFilename = strtolower($productSku) . '.' . strtolower($extension);
            $targetPath = $targetFolder . DIRECTORY_SEPARATOR . $targetFilename;

            // Copy file to storage
            try {
                File::copy($sourcePath, $targetPath);
                
                // Update product with image path (relative to storage/app/public)
                $imagePath = 'products/' . $targetFilename;
                
                DB::table('products')
                    ->where('sku', $productSku)
                    ->update(['image' => $imagePath]);
                    
            } catch (\Exception $e) {
                // Log error but continue with other images
                \Log::warning("Failed to copy image {$imageFile} for product {$productSku}: " . $e->getMessage());
            }
        }
    }

    /**
     * Reverse the migrations.
     * 
     * Note: This does not delete the copied images, only removes image paths from products.
     * Images remain in storage for safety.
     */
    public function down(): void
    {
        // Remove image paths from products (but keep the files)
        $skus = [
            'CWN', 'UMB-NAIL', 'TIE-WIRE', 'PALA', 'VULCASEAL', 'YERO', 
            'YERO-COLOR', 'PLAIN-SHEET', 'STEEL-BAR', 'MARINE-PLY', 
            'ORD-PLY', 'COCO-LUMBER', 'CEMENT', 'SAND', 'GRAVEL', 'GRAVA', 'PVC-PIPE'
        ];
        
        DB::table('products')
            ->whereIn('sku', $skus)
            ->update(['image' => null]);
    }
};
