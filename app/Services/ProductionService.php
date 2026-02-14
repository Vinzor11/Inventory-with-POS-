<?php

namespace App\Services;

use App\Models\ProductVariant;
use App\Models\ProductionLine;
use App\Models\ProductionRun;
use App\Models\WeighIn;
use App\Models\WeighInPrice;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ProductionService
{
    public function __construct(
        protected StockMovementService $stockMovementService
    ) {
    }

    public function createRun(array $payload, int $createdByUserId): ProductionRun
    {
        return DB::transaction(function () use ($payload, $createdByUserId) {
            $runType = (string) $payload['run_type'];
            [$inputVariant, $outputVariant] = $this->resolveVariants($runType, $payload);

            $inputVariant = $this->stockMovementService->getLockedVariant($inputVariant->id);
            $outputVariant = $this->stockMovementService->getLockedVariant($outputVariant->id);

            $inputQty = round((float) $payload['input_qty'], 4);
            if ($inputQty <= 0) {
                throw new RuntimeException('Input quantity must be greater than zero.');
            }

            $outputQty = $this->resolveOutputQuantity($runType, $payload);
            if ($outputQty <= 0) {
                throw new RuntimeException('Output quantity must be greater than zero.');
            }

            if ($runType === 'uncooked_to_cooked' && $outputQty > $inputQty) {
                throw new RuntimeException('Cooked output cannot be greater than uncooked input.');
            }

            $availableInput = $this->stockMovementService->getCurrentStock($inputVariant);
            if ($availableInput + 0.000001 < $inputQty) {
                throw new RuntimeException(sprintf(
                    'Insufficient stock for %s. Available: %s, Needed: %s',
                    $inputVariant->description,
                    number_format($availableInput, 4),
                    number_format($inputQty, 4)
                ));
            }

            $inputUnit = $inputVariant->getOfficialStockUnit();
            $outputUnit = $outputVariant->getOfficialStockUnit();
            $isPieceToKgRun = $this->isPieceToKgConversion($inputUnit, $outputUnit);

            if ($isPieceToKgRun) {
                $kgPerPc = round($outputQty / $inputQty, 6);
                $maxKgPerPc = (float) config('production.max_kg_per_pc', 0.60);

                if ($kgPerPc > $maxKgPerPc) {
                    throw ValidationException::withMessages([
                        'output_weight_kg' => 'Output weight exceeds realistic biological limits.',
                    ]);
                }
            }

            $inputAverageCost = $this->stockMovementService->getAverageCost($inputVariant);
            $consumedTotalCost = round($inputQty * $inputAverageCost, 4);
            $outputUnitCost = round($consumedTotalCost / $outputQty, 4);
            $outputStockBefore = $this->stockMovementService->getCurrentStock($outputVariant);

            $productionDate = Carbon::parse($payload['production_date'] ?? now())->toDateString();

            $yieldValue = round($outputQty / $inputQty, 6);
            $yieldPercent = $isPieceToKgRun ? null : round($yieldValue * 100, 4);

            $shrinkageQty = null;
            $shrinkagePercent = null;
            if ($runType === 'uncooked_to_cooked') {
                $shrinkageQty = round($inputQty - $outputQty, 4);
                $shrinkagePercent = $inputQty > 0
                    ? round(($shrinkageQty / $inputQty) * 100, 4)
                    : null;
            }

            $run = ProductionRun::create([
                'batch_code' => $this->generateBatchCode($productionDate),
                'run_type' => $runType,
                'production_date' => $productionDate,
                'notes' => $payload['notes'] ?? null,
                'operator' => $payload['operator'] ?? null,
                'supplier_source' => $payload['supplier_source'] ?? null,
                'drying_method' => $payload['drying_method'] ?? null,
                'input_qty' => $inputQty,
                'output_qty' => $outputQty,
                'yield_value' => $yieldValue,
                'yield_percent' => $yieldPercent,
                'shrinkage_qty' => $shrinkageQty,
                'shrinkage_percent' => $shrinkagePercent,
                'total_input_cost' => $consumedTotalCost,
                'output_unit_cost' => $outputUnitCost,
                'created_by_user_id' => $createdByUserId,
            ]);

            $weighInId = $this->resolveWeighInId(
                $runType,
                $payload,
                $outputQty,
                $productionDate,
                $createdByUserId,
                $run->batch_code
            );

            $this->stockMovementService->applySignedStockChange($inputVariant, -$inputQty);
            $this->stockMovementService->recordStockMovement(
                (int) $inputVariant->product_id,
                'production_out',
                -$inputQty,
                $inputUnit,
                $inputAverageCost > 0 ? $inputAverageCost : null,
                $consumedTotalCost,
                'Production',
                $run->id,
                'Consumed for batch ' . $run->batch_code,
                $inputVariant->id,
                $createdByUserId,
                'production'
            );

            $this->stockMovementService->applySignedStockChange($outputVariant, $outputQty);
            $this->stockMovementService->applyIncomingWeightedAverageCost(
                $outputVariant,
                $outputQty,
                $consumedTotalCost,
                $outputStockBefore
            );

            $this->stockMovementService->recordStockMovement(
                (int) $outputVariant->product_id,
                'production_in',
                $outputQty,
                $outputUnit,
                $outputUnitCost,
                $consumedTotalCost,
                'Production',
                $run->id,
                'Produced from batch ' . $run->batch_code,
                $outputVariant->id,
                $createdByUserId,
                'production'
            );

            ProductionLine::create([
                'production_run_id' => $run->id,
                'product_id' => $inputVariant->product_id,
                'product_variant_id' => $inputVariant->id,
                'direction' => 'out',
                'qty' => $inputQty,
                'unit' => $inputUnit,
                'unit_cost' => $inputAverageCost > 0 ? $inputAverageCost : null,
                'total_cost' => $consumedTotalCost,
                'weigh_in_id' => null,
            ]);

            ProductionLine::create([
                'production_run_id' => $run->id,
                'product_id' => $outputVariant->product_id,
                'product_variant_id' => $outputVariant->id,
                'direction' => 'in',
                'qty' => $outputQty,
                'unit' => $outputUnit,
                'unit_cost' => $outputUnitCost,
                'total_cost' => $consumedTotalCost,
                'weigh_in_id' => $weighInId,
            ]);

            return $run->load([
                'createdBy:id,name',
                'lines.product:id,name',
                'lines.productVariant:id,product_id,description',
                'lines.weighIn:id,ref_num,weight_kg,weighed_at',
            ]);
        });
    }

    /**
     * [inputVariant, outputVariant]
     */
    private function resolveVariants(string $runType, array $payload): array
    {
        if (!empty($payload['input_variant_id']) && !empty($payload['output_variant_id'])) {
            return [
                ProductVariant::query()->findOrFail((int) $payload['input_variant_id']),
                ProductVariant::query()->findOrFail((int) $payload['output_variant_id']),
            ];
        }

        $coconut = $this->findVariantBySkuOrName('COCONUT', 'Coconut');
        $uncooked = $this->findVariantBySkuOrName('UNCOOKED-COPRA', 'Uncooked Copra');
        $cooked = $this->findVariantBySkuOrName('COOKED-COPRA', 'Cooked Copra');

        return match ($runType) {
            'coconut_to_uncooked' => [$coconut, $uncooked],
            'uncooked_to_cooked' => [$uncooked, $cooked],
            'coconut_to_cooked' => [$coconut, $cooked],
            default => throw new RuntimeException('Unknown production run type.'),
        };
    }

    private function resolveOutputQuantity(string $runType, array $payload): float
    {
        if (!empty($payload['output_weigh_in_id'])) {
            $weighIn = WeighIn::query()->findOrFail((int) $payload['output_weigh_in_id']);
            $expectedType = $this->resolveOutputWeighType($runType);

            if ($weighIn->type !== $expectedType) {
                throw new RuntimeException('Selected weigh-in does not match the run output type.');
            }

            return round((float) ($weighIn->weight_kg ?? 0), 4);
        }

        return round((float) ($payload['output_weight_kg'] ?? 0), 4);
    }

    private function resolveWeighInId(
        string $runType,
        array $payload,
        float $outputQty,
        string $productionDate,
        int $createdByUserId,
        string $batchCode
    ): ?int {
        if (!empty($payload['output_weigh_in_id'])) {
            return (int) $payload['output_weigh_in_id'];
        }

        if (empty($payload['record_weigh_in'])) {
            return null;
        }

        $weighType = $this->resolveOutputWeighType($runType);
        $price = WeighInPrice::getPriceForType($weighType) ?? 0;

        $weighIn = WeighIn::create([
            'type' => $weighType,
            'weight_kg' => $outputQty,
            'count' => null,
            'unit_price' => $price,
            'weighed_by_user_id' => $createdByUserId,
            'weighed_at' => Carbon::parse($productionDate)->startOfDay(),
            'notes' => 'Recorded from production batch ' . $batchCode,
            'status' => 'paid',
        ]);

        return $weighIn->id;
    }

    private function findVariantBySkuOrName(string $sku, string $name): ProductVariant
    {
        $variant = ProductVariant::query()
            ->whereHas('product', function ($query) use ($sku, $name) {
                $query->where('sku', $sku)->orWhere('name', $name);
            })
            ->orderBy('id')
            ->first();

        if (!$variant) {
            throw new RuntimeException("Missing production variant: {$name}. Run AgriculturalProductsSeeder first.");
        }

        return $variant;
    }

    private function generateBatchCode(string $productionDate): string
    {
        $datePart = Carbon::parse($productionDate)->format('Ymd');
        $prefix = 'CPRA-' . $datePart . '-';

        $count = ProductionRun::query()
            ->where('batch_code', 'like', $prefix . '%')
            ->count();

        return $prefix . str_pad((string) ($count + 1), 3, '0', STR_PAD_LEFT);
    }

    private function isPieceToKgConversion(string $inputUnit, string $outputUnit): bool
    {
        return strtolower($inputUnit) === 'pcs' && strtolower($outputUnit) === 'kg';
    }

    private function resolveOutputWeighType(string $runType): string
    {
        return $runType === 'coconut_to_uncooked'
            ? 'uncooked_copra'
            : 'cooked_copra';
    }
}
