<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProductionRunRequest;
use App\Models\ProductVariant;
use App\Models\ProductionRun;
use App\Models\WeighIn;
use App\Services\ProductionService;
use App\Services\StockMovementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProductionRunController extends Controller
{
    public function __construct(
        protected ProductionService $productionService,
        protected StockMovementService $stockMovementService
    ) {
    }

    public function createCoconutToUncooked(Request $request): Response
    {
        return $this->renderCreatePage('coconut_to_uncooked');
    }

    public function createUncookedToCooked(Request $request): Response
    {
        return $this->renderCreatePage('uncooked_to_cooked');
    }

    public function createCoconutToCooked(Request $request): Response
    {
        return $this->renderCreatePage('coconut_to_cooked');
    }

    public function store(StoreProductionRunRequest $request): RedirectResponse
    {
        $this->authorize('can_produce');

        try {
            $run = $this->productionService->createRun(
                $request->validated(),
                (int) $request->user()->id
            );
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return redirect()
                ->back()
                ->withInput()
                ->withErrors([
                    'production' => $e->getMessage(),
                ]);
        }

        $redirectRoute = match ($run->run_type) {
            'coconut_to_uncooked' => 'inventory.production.coconut-to-uncooked',
            'uncooked_to_cooked' => 'inventory.production.uncooked-to-cooked',
            'coconut_to_cooked' => 'inventory.production.coconut-to-cooked',
            default => 'inventory.production.coconut-to-uncooked',
        };

        return redirect()
            ->route($redirectRoute)
            ->with('success', 'Production run saved. Batch: ' . $run->batch_code);
    }

    private function renderCreatePage(string $runType): Response
    {
        $this->authorize('can_produce');

        [$inputVariant, $outputVariant] = $this->resolveVariants($runType);
        $outputWeighInType = $runType === 'coconut_to_uncooked' ? 'uncooked_copra' : 'cooked_copra';

        $latestWeighIns = WeighIn::query()
            ->where('type', $outputWeighInType)
            ->whereNotNull('weight_kg')
            ->orderByDesc('weighed_at')
            ->limit(10)
            ->get([
                'id',
                'ref_num',
                'weight_kg',
                'weighed_at',
                'notes',
            ]);

        $recentRuns = ProductionRun::query()
            ->where('run_type', $runType)
            ->with([
                'createdBy:id,name',
                'lines' => function ($query) {
                    $query->select('id', 'production_run_id', 'direction', 'qty', 'unit', 'unit_cost');
                },
            ])
            ->orderByDesc('production_date')
            ->limit(10)
            ->get();

        return Inertia::render('inventory/production-run', [
            'runType' => $runType,
            'inputVariant' => [
                'id' => $inputVariant->id,
                'product_id' => $inputVariant->product_id,
                'product_name' => $inputVariant->product->name,
                'description' => $inputVariant->description,
                'unit' => $inputVariant->getOfficialStockUnit(),
                'current_stock' => (float) ($inputVariant->inventory?->quantity_on_hand ?? 0),
                'average_cost' => $this->stockMovementService->getAverageCost($inputVariant),
            ],
            'outputVariant' => [
                'id' => $outputVariant->id,
                'product_id' => $outputVariant->product_id,
                'product_name' => $outputVariant->product->name,
                'description' => $outputVariant->description,
                'unit' => $outputVariant->getOfficialStockUnit(),
                'current_stock' => (float) ($outputVariant->inventory?->quantity_on_hand ?? 0),
                'average_cost' => $this->stockMovementService->getAverageCost($outputVariant),
            ],
            'latestWeighIns' => $latestWeighIns,
            'recentRuns' => $recentRuns,
            'defaults' => [
                'production_date' => now()->toDateString(),
            ],
            'thresholds' => [
                'warn_kg_per_pc' => (float) config('production.warn_kg_per_pc', 0.40),
                'max_kg_per_pc' => (float) config('production.max_kg_per_pc', 0.60),
            ],
        ]);
    }

    private function resolveVariants(string $runType): array
    {
        $coconut = $this->findVariantBySkuOrName('COCONUT', 'Coconut');
        $uncooked = $this->findVariantBySkuOrName('UNCOOKED-COPRA', 'Uncooked Copra');
        $cooked = $this->findVariantBySkuOrName('COOKED-COPRA', 'Cooked Copra');

        return match ($runType) {
            'coconut_to_uncooked' => [$coconut, $uncooked],
            'uncooked_to_cooked' => [$uncooked, $cooked],
            'coconut_to_cooked' => [$coconut, $cooked],
            default => abort(404),
        };
    }

    private function findVariantBySkuOrName(string $sku, string $name): ProductVariant
    {
        return ProductVariant::query()
            ->with(['product', 'inventory'])
            ->whereHas('product', function ($query) use ($sku, $name) {
                $query->where('sku', $sku)->orWhere('name', $name);
            })
            ->firstOrFail();
    }
}
