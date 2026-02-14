<?php

namespace App\Services;

use App\Models\ProductVariant;
use App\Models\ProductionLine;
use App\Models\ProductionRun;
use App\Models\Sale;
use App\Models\SaleItem;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CookedCopraSaleService
{
    public function __construct(
        protected StockMovementService $stockMovementService
    ) {
    }

    public function getStockSummary(): array
    {
        $variant = $this->findCookedCopraVariant();

        $stock = $this->stockMovementService->getCurrentStock($variant);
        $averageCost = $this->stockMovementService->getAverageCost($variant);

        return [
            'variant_id' => (int) $variant->id,
            'product_id' => (int) $variant->product_id,
            'name' => $variant->product->name,
            'description' => $variant->description,
            'unit' => $variant->getOfficialStockUnit(),
            'stock' => round($stock, 4),
            'unit_price' => (float) ($variant->unit_price ?? 0),
            'average_cost' => round($averageCost, 4),
        ];
    }

    public function createSale(array $payload, int $createdByUserId): Sale
    {
        return DB::transaction(function () use ($payload, $createdByUserId) {
            $variant = $this->findCookedCopraVariant();
            $variant = $this->stockMovementService->getLockedVariant((int) $variant->id);

            $quantity = round((float) $payload['quantity'], 4);
            if ($quantity <= 0) {
                throw new RuntimeException('Quantity must be greater than zero.');
            }

            $currentStock = $this->stockMovementService->getCurrentStock($variant);
            if ($currentStock + 0.000001 < $quantity) {
                throw new RuntimeException(sprintf(
                    'Insufficient cooked copra stock. Available: %s kg, Needed: %s kg',
                    number_format($currentStock, 4),
                    number_format($quantity, 4)
                ));
            }

            $unitPrice = round((float) ($payload['unit_price'] ?? $variant->unit_price ?? 0), 4);
            if ($unitPrice <= 0) {
                throw new RuntimeException('Selling price must be greater than zero.');
            }

            $unitCost = $this->stockMovementService->getAverageCost($variant);
            $totalCost = round($quantity * $unitCost, 4);
            $lineTotal = round($quantity * $unitPrice, 2);
            $profit = round($lineTotal - $totalCost, 4);

            $saleDate = Carbon::parse($payload['sale_date'] ?? now())->toDateString();

            $sale = Sale::query()->create([
                'sale_number' => Sale::generateSaleNumber(),
                'sale_date' => $saleDate,
                'customer_name' => $payload['customer_name'] ?? null,
                'status' => 'OPEN',
                'payment_status' => 'UNPAID',
                'is_for_delivery' => false,
                'subtotal' => $lineTotal,
                'total' => $lineTotal,
                'notes' => $payload['notes'] ?? 'Cooked copra sale',
                'cashier_user_id' => $createdByUserId,
            ]);

            SaleItem::query()->create([
                'sale_id' => $sale->id,
                'product_variant_id' => $variant->id,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'line_total' => $lineTotal,
                'unit_cost' => $unitCost > 0 ? $unitCost : null,
                'total_cost' => $totalCost > 0 ? $totalCost : null,
                'profit' => $profit,
            ]);

            $this->stockMovementService->applySignedStockChange($variant, -$quantity);
            $this->stockMovementService->recordStockMovement(
                (int) $variant->product_id,
                'sale_out',
                -$quantity,
                $variant->getOfficialStockUnit(),
                $unitCost > 0 ? $unitCost : null,
                $totalCost > 0 ? $totalCost : null,
                'Sale',
                $sale->id,
                'Cooked copra sold. Sale #' . $sale->sale_number,
                $variant->id,
                $createdByUserId,
                'sale'
            );

            $sale->computeSaleStatus();

            return $sale->load([
                'cashier:id,name',
                'items:id,sale_id,product_variant_id,quantity,unit_price,line_total,unit_cost,total_cost,profit',
                'items.productVariant:id,product_id,description',
                'items.productVariant.product:id,name',
            ]);
        });
    }

    public function createProductionStockOutRun(array $payload, int $createdByUserId): array
    {
        return DB::transaction(function () use ($payload, $createdByUserId) {
            $variant = $this->findCookedCopraVariant();
            $variant = $this->stockMovementService->getLockedVariant((int) $variant->id);

            $quantity = round((float) $payload['quantity'], 4);
            if ($quantity <= 0) {
                throw new RuntimeException('Quantity must be greater than zero.');
            }

            $currentStock = $this->stockMovementService->getCurrentStock($variant);
            if ($currentStock + 0.000001 < $quantity) {
                throw new RuntimeException(sprintf(
                    'Insufficient cooked copra stock. Available: %s kg, Needed: %s kg',
                    number_format($currentStock, 4),
                    number_format($quantity, 4)
                ));
            }

            $unitPrice = round((float) ($payload['unit_price'] ?? $variant->unit_price ?? 0), 4);
            if ($unitPrice <= 0) {
                throw new RuntimeException('Selling price must be greater than zero.');
            }

            $unitCost = $this->stockMovementService->getAverageCost($variant);
            $totalCost = round($quantity * $unitCost, 4);
            $totalRevenue = round($quantity * $unitPrice, 4);
            $grossProfit = round($totalRevenue - $totalCost, 4);
            $productionDate = Carbon::parse($payload['sale_date'] ?? now())->toDateString();
            $batchCode = $this->generateStockOutBatchCode($productionDate);

            $notes = trim((string) ($payload['notes'] ?? ''));
            $customerName = trim((string) ($payload['customer_name'] ?? ''));
            $metaNotes = [
                'Cooked copra stock-out sale',
                'Unit Price: ' . number_format($unitPrice, 4),
                'Revenue: ' . number_format($totalRevenue, 4),
                'COGS: ' . number_format($totalCost, 4),
                'Gross Profit: ' . number_format($grossProfit, 4),
            ];
            if ($customerName !== '') {
                $metaNotes[] = 'Customer: ' . $customerName;
            }
            if ($notes !== '') {
                $metaNotes[] = $notes;
            }

            $run = ProductionRun::query()->create([
                'batch_code' => $batchCode,
                'run_type' => 'cooked_sale_out',
                'production_date' => $productionDate,
                'notes' => implode(PHP_EOL, $metaNotes),
                'operator' => null,
                'supplier_source' => $customerName !== '' ? $customerName : null,
                'drying_method' => null,
                'input_qty' => $quantity,
                'output_qty' => $quantity,
                'yield_value' => null,
                'yield_percent' => null,
                'shrinkage_qty' => null,
                'shrinkage_percent' => null,
                'total_input_cost' => $totalCost,
                'output_unit_cost' => $unitCost,
                'created_by_user_id' => $createdByUserId,
            ]);

            ProductionLine::query()->create([
                'production_run_id' => $run->id,
                'product_id' => $variant->product_id,
                'product_variant_id' => $variant->id,
                'direction' => 'out',
                'qty' => $quantity,
                'unit' => $variant->getOfficialStockUnit(),
                'unit_cost' => $unitCost > 0 ? $unitCost : null,
                'total_cost' => $totalCost > 0 ? $totalCost : null,
                'weigh_in_id' => null,
            ]);

            $this->stockMovementService->applySignedStockChange($variant, -$quantity);
            $this->stockMovementService->recordStockMovement(
                (int) $variant->product_id,
                'sale_out',
                -$quantity,
                $variant->getOfficialStockUnit(),
                $unitCost > 0 ? $unitCost : null,
                $totalCost > 0 ? $totalCost : null,
                'Production',
                $run->id,
                'Cooked copra sold. Batch #' . $batchCode,
                $variant->id,
                $createdByUserId,
                'sale'
            );

            return [
                'production_run_id' => (int) $run->id,
                'batch_code' => $batchCode,
                'quantity' => $quantity,
                'unit' => $variant->getOfficialStockUnit(),
                'unit_price' => $unitPrice,
                'unit_cost' => $unitCost,
                'total_revenue' => $totalRevenue,
                'total_cost' => $totalCost,
                'gross_profit' => $grossProfit,
                'production_date' => $productionDate,
            ];
        });
    }

    private function findCookedCopraVariant(): ProductVariant
    {
        $variant = ProductVariant::query()
            ->with(['product', 'inventory'])
            ->whereHas('product', function ($query) {
                $query->where('sku', 'COOKED-COPRA')->orWhere('name', 'Cooked Copra');
            })
            ->orderBy('id')
            ->first();

        if (!$variant) {
            throw new RuntimeException('Cooked Copra product variant not found.');
        }

        return $variant;
    }

    private function generateStockOutBatchCode(string $date): string
    {
        $datePart = Carbon::parse($date)->format('Ymd');
        $prefix = 'CSAL-' . $datePart . '-';

        $count = ProductionRun::query()
            ->where('batch_code', 'like', $prefix . '%')
            ->count();

        return $prefix . str_pad((string) ($count + 1), 3, '0', STR_PAD_LEFT);
    }
}
