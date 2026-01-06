<?php

namespace App\Services;

use App\Models\ProductVariant;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use Illuminate\Support\Facades\Log;

class WeighInInventoryService
{
    /**
     * Map weigh-in type to product variant
     * Returns the ProductVariant ID for the given weigh-in type
     * 
     * @param string $weighInType 'cooked_copra', 'uncooked_copra', or 'coconut'
     * @return ProductVariant|null
     */
    public static function getProductVariantForType(string $weighInType): ?ProductVariant
    {
        $productNames = [
            'cooked_copra' => 'Cooked Copra',
            'uncooked_copra' => 'Uncooked Copra',
            'coconut' => 'Coconut',
        ];

        if (!isset($productNames[$weighInType])) {
            Log::warning("Unknown weigh-in type: {$weighInType}");
            return null;
        }

        $productName = $productNames[$weighInType];

        // Find the product variant by product name and description
        $variant = ProductVariant::whereHas('product', function ($query) use ($productName) {
            $query->where('name', $productName)
                  ->whereHas('category', function ($q) {
                      $q->where('name', 'Agricultural Products');
                  });
        })
        ->where('description', $productName)
        ->first();

        if (!$variant) {
            Log::error("Product variant not found for weigh-in type: {$weighInType}. Please run AgriculturalProductsSeeder.");
        }

        return $variant;
    }

    /**
     * Create inventory movement for a weigh-in (stock IN)
     * 
     * @param \App\Models\WeighIn $weighIn
     * @param int $recordedByUserId
     * @return InventoryMovement|null
     */
    public static function createInventoryMovementFromWeighIn(\App\Models\WeighIn $weighIn, int $recordedByUserId): ?InventoryMovement
    {
        $variant = self::getProductVariantForType($weighIn->type);
        
        if (!$variant) {
            Log::error("Cannot create inventory movement: Product variant not found for weigh-in type: {$weighIn->type}");
            return null;
        }

        // Determine quantity based on type
        $quantity = $weighIn->type === 'coconut' 
            ? ($weighIn->count ?? 0)
            : ($weighIn->weight_kg ?? 0);

        if ($quantity <= 0) {
            Log::warning("Weigh-in has zero quantity, skipping inventory movement", [
                'weigh_in_id' => $weighIn->id,
                'type' => $weighIn->type,
            ]);
            return null;
        }

        // Create inventory movement (IN)
        $movement = InventoryMovement::create([
            'product_variant_id' => $variant->id,
            'quantity' => $quantity,
            'type' => 'IN',
            'reason' => 'weigh_in',
            'reference_id' => $weighIn->id,
            'unit_cost' => $weighIn->unit_price, // Purchase price from weigh-in
            'notes' => "Weigh-in: {$weighIn->ref_num}",
            'recorded_by_user_id' => $recordedByUserId,
        ]);

        // Update inventory quantity
        // Load inventory relationship or get from database
        $variant->load('inventory');
        $currentStock = $variant->inventory?->quantity_on_hand ?? 0;
        $newStock = $currentStock + $quantity;

        Inventory::updateOrCreate(
            ['product_variant_id' => $variant->id],
            ['quantity_on_hand' => $newStock]
        );

        // Update variant's purchase price if not set or if this is a better price
        if (!$variant->purchase_price || $weighIn->unit_price > 0) {
            $variant->update(['purchase_price' => $weighIn->unit_price]);
        }

        // Update variant's unit price (selling price) if not set
        if (!$variant->unit_price || $variant->unit_price == 0) {
            $variant->update(['unit_price' => $weighIn->unit_price]);
        }

        Log::info("Inventory movement created for weigh-in", [
            'weigh_in_id' => $weighIn->id,
            'variant_id' => $variant->id,
            'quantity' => $quantity,
            'new_stock' => $newStock,
        ]);

        return $movement;
    }
}

