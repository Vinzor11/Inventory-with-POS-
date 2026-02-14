<?php

namespace App\Services;

use App\Models\ProductVariant;
use App\Models\InventoryMovement;
use Illuminate\Support\Facades\DB;
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

        return DB::transaction(function () use ($variant, $weighIn, $quantity, $recordedByUserId) {
            /** @var \App\Services\StockMovementService $stockMovementService */
            $stockMovementService = app(\App\Services\StockMovementService::class);

            $lockedVariant = $stockMovementService->getLockedVariant($variant->id);
            $currentStock = $stockMovementService->getCurrentStock($lockedVariant);
            $unitCost = (float) ($weighIn->unit_price ?? 0);
            $totalCost = round($quantity * $unitCost, 4);
            $unit = $lockedVariant->getOfficialStockUnit();

            $stockMovementService->applySignedStockChange($lockedVariant, $quantity);
            $stockMovementService->applyIncomingWeightedAverageCost(
                $lockedVariant,
                $quantity,
                $totalCost,
                $currentStock
            );

            $movement = $stockMovementService->recordStockMovement(
                (int) $lockedVariant->product_id,
                'purchase_in',
                $quantity,
                $unit,
                $unitCost > 0 ? $unitCost : null,
                $totalCost > 0 ? $totalCost : null,
                'WeighIn',
                $weighIn->id,
                "Weigh-in: {$weighIn->ref_num}",
                $lockedVariant->id,
                $recordedByUserId,
                'weigh_in'
            );

            if (!$lockedVariant->unit_price || (float) $lockedVariant->unit_price == 0.0) {
                $lockedVariant->update(['unit_price' => $unitCost]);
            }

            Log::info("Inventory movement created for weigh-in", [
                'weigh_in_id' => $weighIn->id,
                'variant_id' => $lockedVariant->id,
                'quantity' => $quantity,
                'new_stock' => $currentStock + $quantity,
            ]);

            return $movement;
        });
    }
}

