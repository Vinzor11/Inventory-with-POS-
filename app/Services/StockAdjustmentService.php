<?php

namespace App\Services;

use App\Models\InventoryMovement;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class StockAdjustmentService
{
    public function __construct(
        protected StockMovementService $stockMovementService
    ) {
    }

    public function adjustStock(array $payload, int $createdByUserId): InventoryMovement
    {
        return DB::transaction(function () use ($payload, $createdByUserId) {
            $variant = $this->stockMovementService->getLockedVariant((int) $payload['product_variant_id']);
            $currentStock = $this->stockMovementService->getCurrentStock($variant);

            $signedDifference = $this->resolveSignedDifference($payload, $currentStock);
            if (abs($signedDifference) < 0.000001) {
                throw new RuntimeException('Actual quantity matches current stock. No adjustment was recorded.');
            }

            $targetStock = round($currentStock + $signedDifference, 4);
            if ($targetStock < -0.000001) {
                throw new RuntimeException('Adjustment would result in negative stock.');
            }

            $unit = $variant->getOfficialStockUnit();
            $avgCost = $this->stockMovementService->getAverageCost($variant);
            $totalCost = $avgCost > 0 ? round(abs($signedDifference) * $avgCost, 4) : null;

            $this->stockMovementService->applySignedStockChange($variant, $signedDifference);

            $noteLines = [
                'Reason: ' . ($payload['reason'] ?? 'correction'),
                'Current Stock: ' . number_format($currentStock, 4),
                'Target Stock: ' . number_format(max(0, $targetStock), 4),
            ];

            if (!empty($payload['notes'])) {
                $noteLines[] = trim((string) $payload['notes']);
            }

            return $this->stockMovementService->recordStockMovement(
                (int) $variant->product_id,
                'adjustment',
                $signedDifference,
                $unit,
                $avgCost > 0 ? $avgCost : null,
                $totalCost,
                'Adjustment',
                null,
                implode(PHP_EOL, $noteLines),
                $variant->id,
                $createdByUserId,
                $payload['reason'] ?? 'correction'
            );
        });
    }

    private function resolveSignedDifference(array $payload, float $currentStock): float
    {
        if (array_key_exists('actual_quantity', $payload) && $payload['actual_quantity'] !== null && $payload['actual_quantity'] !== '') {
            $actualQty = round((float) $payload['actual_quantity'], 4);

            return round($actualQty - $currentStock, 4);
        }

        if (array_key_exists('quantity', $payload)) {
            // Backward compatibility with old delta-based adjustment UI.
            return round((float) $payload['quantity'], 4);
        }

        throw new RuntimeException('Adjustment quantity is required.');
    }
}
