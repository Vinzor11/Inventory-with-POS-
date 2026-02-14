<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateWeighInPriceRequest;
use App\Models\Product;
use App\Models\WeighInPrice;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class WeighInPricesController extends Controller
{
    /**
     * Display the price management page
     */
    public function index(): Response
    {
        $storedPrices = WeighInPrice::query()
            ->get()
            ->mapWithKeys(function ($row) {
                return [$row->type => $row->price !== null ? (float) $row->price : 0.0];
            })
            ->toArray();

        $typeKeys = array_values(array_unique(array_merge(
            array_keys($storedPrices),
            $this->getAgriTypeKeys()
        )));
        $typeKeys = $this->sortTypeKeys($typeKeys);

        $prices = [];
        foreach ($typeKeys as $type) {
            $prices[$type] = $storedPrices[$type] ?? 0.0;
        }

        return Inertia::render('weigh-ins/prices', [
            'prices' => $prices,
        ]);
    }

    /**
     * Update the price for a specific type
     */
    public function update(UpdateWeighInPriceRequest $request, string $type): RedirectResponse
    {
        if (!$request->user()?->isAdmin()) {
            abort(403, 'Only administrators can update weigh-in prices.');
        }

        $normalizedType = strtolower(trim($type));
        $allowedTypes = array_unique(array_merge(
            WeighInPrice::query()->pluck('type')->all(),
            $this->getAgriTypeKeys(),
            ['cooked_copra', 'uncooked_copra', 'coconut', 'bagol']
        ));

        if (!in_array($normalizedType, $allowedTypes, true)) {
            return redirect()->route('weigh-ins.prices.index')
                ->withErrors(['price' => 'Invalid price type.']);
        }

        $validated = $request->validated();

        WeighInPrice::updateOrCreate(
            ['type' => $normalizedType],
            ['price' => $validated['price']]
        );

        return redirect()->route('weigh-ins.prices.index')
            ->with('success', ucfirst(str_replace('_', ' ', $normalizedType)) . ' price updated successfully.');
    }

    /**
     * @return array<int, string>
     */
    private function getAgriTypeKeys(): array
    {
        return Product::query()
            ->whereHas('category', function ($query) {
                $query->where('name', 'Agricultural Products');
            })
            ->get(['name', 'sku'])
            ->map(function (Product $product) {
                return $this->inferTypeKeyFromProduct($product);
            })
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function inferTypeKeyFromProduct(Product $product): ?string
    {
        $sku = trim((string) $product->sku);
        if ($sku !== '') {
            return strtolower(str_replace('-', '_', $sku));
        }

        $name = trim((string) $product->name);
        if ($name === '') {
            return null;
        }

        $normalized = strtolower(trim((string) preg_replace('/[^a-z0-9]+/i', '_', $name), '_'));
        return $normalized !== '' ? $normalized : null;
    }

    /**
     * @param array<int, string> $typeKeys
     * @return array<int, string>
     */
    private function sortTypeKeys(array $typeKeys): array
    {
        $knownOrder = ['cooked_copra', 'uncooked_copra', 'bagol', 'coconut'];

        usort($typeKeys, function (string $a, string $b) use ($knownOrder) {
            $aIndex = array_search($a, $knownOrder, true);
            $bIndex = array_search($b, $knownOrder, true);

            $aKnown = $aIndex !== false;
            $bKnown = $bIndex !== false;

            if ($aKnown && $bKnown) {
                return $aIndex <=> $bIndex;
            }

            if ($aKnown) {
                return -1;
            }

            if ($bKnown) {
                return 1;
            }

            return strcmp($a, $b);
        });

        return $typeKeys;
    }
}
