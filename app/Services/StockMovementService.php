<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Collection;
use RuntimeException;

class StockMovementService
{
    /**
     * Reusable movement logger for all stock changes.
     *
     * qty is signed:
     * - positive = stock in
     * - negative = stock out
     */
    public function recordStockMovement(
        int $productId,
        string $type,
        float $qty,
        string $unit,
        ?float $unitCost,
        ?float $totalCost,
        string $referenceType,
        int|string|null $referenceId,
        ?string $notes,
        ?int $productVariantId = null,
        ?int $createdBy = null,
        ?string $reason = null
    ): InventoryMovement {
        if (abs($qty) < 0.000001) {
            throw new RuntimeException('Movement quantity must not be zero.');
        }

        $product = Product::query()
            ->with('variants:id,product_id')
            ->findOrFail($productId);

        $variantId = $productVariantId ?? $product->variants->first()?->id;
        if (!$variantId) {
            throw new RuntimeException('No product variant found for movement recording.');
        }

        $resolvedCreatedBy = $createdBy ?? auth()->id();
        if (!$resolvedCreatedBy) {
            throw new RuntimeException('Unable to resolve movement actor (created_by).');
        }

        $signedQty = round($qty, 4);
        $absoluteQty = abs($signedQty);
        $direction = $signedQty > 0 ? 'IN' : 'OUT';
        $resolvedUnitCost = $unitCost !== null ? round($unitCost, 4) : null;
        $resolvedTotalCost = $totalCost !== null
            ? round(abs($totalCost), 4)
            : ($resolvedUnitCost !== null ? round($absoluteQty * $resolvedUnitCost, 4) : null);

        return InventoryMovement::create([
            'product_variant_id' => $variantId,
            'product_id' => $product->id,
            'quantity' => $absoluteQty,
            'qty' => $signedQty,
            'type' => $direction,
            'movement_type' => $type,
            'unit' => $unit,
            'reason' => $reason ?? $type,
            'reference_id' => $referenceId,
            'reference_type' => $referenceType,
            'unit_cost' => $resolvedUnitCost,
            'total_cost' => $resolvedTotalCost,
            'notes' => $notes,
            'recorded_by_user_id' => $resolvedCreatedBy,
        ]);
    }

    public function getLockedVariant(int $productVariantId): ProductVariant
    {
        return ProductVariant::query()
            ->with(['product', 'inventory'])
            ->whereKey($productVariantId)
            ->lockForUpdate()
            ->firstOrFail();
    }

    public function getCurrentStock(ProductVariant $variant): float
    {
        return (float) ($variant->inventory?->quantity_on_hand ?? 0);
    }

    public function getAverageCost(ProductVariant $variant): float
    {
        $purchasePrice = $variant->purchase_price !== null ? (float) $variant->purchase_price : null;
        if ($purchasePrice !== null && $purchasePrice > 0) {
            return $purchasePrice;
        }

        $movementAverage = (float) $this->getAverageCostsForVariants([$variant->id])->get($variant->id, 0);
        if ($movementAverage > 0) {
            return $movementAverage;
        }

        return 0;
    }

    /**
     * Bulk movement-based weighted average cost keyed by product_variant_id.
     *
     * @return Collection<int, float>
     */
    public function getAverageCostsForVariants(array $variantIds): Collection
    {
        $resolvedVariantIds = collect($variantIds)
            ->filter(fn ($id) => $id !== null)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        if (empty($resolvedVariantIds)) {
            return collect();
        }

        return InventoryMovement::query()
            ->whereIn('product_variant_id', $resolvedVariantIds)
            ->whereIn('movement_type', ['purchase_in', 'production_in'])
            ->where('qty', '>', 0)
            ->where(function ($query) {
                $query->whereNotNull('total_cost')->orWhereNotNull('unit_cost');
            })
            ->selectRaw('product_variant_id, SUM(qty) as qty_in, SUM(COALESCE(total_cost, qty * unit_cost)) as cost_in')
            ->groupBy('product_variant_id')
            ->get()
            ->mapWithKeys(function ($row) {
                $qtyIn = (float) ($row->qty_in ?? 0);
                $costIn = (float) ($row->cost_in ?? 0);
                $average = $qtyIn > 0 && $costIn > 0
                    ? round($costIn / $qtyIn, 4)
                    : 0.0;

                return [(int) $row->product_variant_id => $average];
            });
    }

    public function applySignedStockChange(ProductVariant $variant, float $signedQty): float
    {
        $currentStock = $this->getCurrentStock($variant);
        $nextStock = round($currentStock + $signedQty, 4);

        if ($nextStock < -0.000001) {
            throw new RuntimeException(sprintf(
                'Insufficient stock for %s. Current: %s, Requested: %s',
                $variant->description,
                number_format($currentStock, 4),
                number_format(abs($signedQty), 4)
            ));
        }

        Inventory::updateOrCreate(
            ['product_variant_id' => $variant->id],
            ['quantity_on_hand' => max(0, $nextStock)]
        );

        return max(0, $nextStock);
    }

    /**
     * Weighted-average update for IN movements.
     */
    public function applyIncomingWeightedAverageCost(
        ProductVariant $variant,
        float $incomingQty,
        float $incomingTotalCost,
        ?float $currentStock = null
    ): float {
        if ($incomingQty <= 0 || $incomingTotalCost < 0) {
            return $this->getAverageCost($variant);
        }

        $stockBefore = $currentStock ?? $this->getCurrentStock($variant);
        $avgBefore = $this->getAverageCost($variant);

        $existingValue = max(0, $stockBefore) * max(0, $avgBefore);
        $newQty = max(0, $stockBefore) + $incomingQty;

        $newAverage = $newQty > 0
            ? round(($existingValue + $incomingTotalCost) / $newQty, 4)
            : 0;

        $variant->update([
            'purchase_price' => $newAverage > 0 ? $newAverage : null,
        ]);

        return $newAverage;
    }
}
