<?php

namespace App\Services;

use App\Models\PurchaseReceipt;
use Illuminate\Support\Facades\DB;

class PurchaseService
{
    public function __construct(
        protected StockMovementService $stockMovementService
    ) {
    }

    public function receiveStock(array $payload, int $createdByUserId): PurchaseReceipt
    {
        return DB::transaction(function () use ($payload, $createdByUserId) {
            $variant = $this->stockMovementService->getLockedVariant((int) $payload['product_variant_id']);

            $quantity = round((float) $payload['quantity'], 4);
            $unitCost = round((float) $payload['unit_cost'], 4);
            $totalCost = round($quantity * $unitCost, 4);
            $unit = $variant->getOfficialStockUnit();
            $currentStock = $this->stockMovementService->getCurrentStock($variant);

            $receipt = PurchaseReceipt::create([
                'reference_code' => $this->generateReferenceCode(),
                'product_variant_id' => $variant->id,
                'quantity' => $quantity,
                'unit' => $unit,
                'unit_cost' => $unitCost,
                'total_cost' => $totalCost,
                'received_at' => $payload['received_at'] ?? now(),
                'notes' => $payload['notes'] ?? null,
                'created_by_user_id' => $createdByUserId,
            ]);

            $this->stockMovementService->applySignedStockChange($variant, $quantity);
            $this->stockMovementService->applyIncomingWeightedAverageCost(
                $variant,
                $quantity,
                $totalCost,
                $currentStock
            );

            $this->stockMovementService->recordStockMovement(
                (int) $variant->product_id,
                'purchase_in',
                $quantity,
                $unit,
                $unitCost,
                $totalCost,
                'Purchase',
                $receipt->id,
                $payload['notes'] ?? null,
                $variant->id,
                $createdByUserId,
                'purchase'
            );

            return $receipt;
        });
    }

    private function generateReferenceCode(): string
    {
        $date = now()->format('Ymd');
        $prefix = 'PRCH-' . $date . '-';

        $countToday = PurchaseReceipt::query()
            ->where('reference_code', 'like', $prefix . '%')
            ->count();

        return $prefix . str_pad((string) ($countToday + 1), 3, '0', STR_PAD_LEFT);
    }
}
