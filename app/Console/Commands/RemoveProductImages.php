<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class RemoveProductImages extends Command
{
    protected $signature = 'products:remove-images';
    protected $description = 'Remove all product images from database and storage';

    public function handle(): int
    {
        $this->info('Removing product images...');

        $products = Product::whereNotNull('image')->get();
        
        if ($products->isEmpty()) {
            $this->info('No products with images found.');
            return Command::SUCCESS;
        }

        $bar = $this->output->createProgressBar($products->count());
        $bar->start();

        $removedCount = 0;

        foreach ($products as $product) {
            if ($product->image) {
                // Delete the image file from storage
                Storage::disk('public')->delete($product->image);
                
                // Remove image reference from database
                $product->update(['image' => null]);
                $removedCount++;
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("✓ Removed {$removedCount} product images successfully");

        return Command::SUCCESS;
    }
}

