<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\WeighInPrice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WeighInPriceController extends Controller
{
    /**
     * Get all weigh-in prices
     */
    public function index(): JsonResponse
    {
        $prices = WeighInPrice::all()->keyBy('type');

        return response()->json([
            'success' => true,
            'data' => $prices,
        ]);
    }

    /**
     * Get landing metadata used by mobile weigh-ins flow:
     * - prices per weigh type
     * - agricultural products (for card images)
     */
    public function landing(): JsonResponse
    {
        $prices = WeighInPrice::all()->keyBy('type');

        $agriProducts = Product::whereHas('category', function ($query) {
            $query->where('name', 'Agricultural Products');
        })->get(['id', 'name', 'sku', 'image']);

        $productsByType = [];
        foreach ($agriProducts as $product) {
            $typeKey = $this->inferTypeKeyFromProduct($product);
            if ($typeKey && !array_key_exists($typeKey, $productsByType)) {
                $productsByType[$typeKey] = $product;
            }
        }

        $typeKeys = array_values(array_unique(array_merge(
            $prices->keys()->all(),
            array_keys($productsByType)
        )));
        $typeKeys = $this->sortTypeKeys($typeKeys);

        $pricesPayload = [];
        $products = [];
        foreach ($typeKeys as $type) {
            $priceRow = $prices->get($type);
            $pricesPayload[$type] = $priceRow ? [
                'id' => $priceRow->id,
                'type' => $priceRow->type,
                'price' => $priceRow->price !== null ? (float) $priceRow->price : 0.0,
            ] : [
                'id' => null,
                'type' => $type,
                'price' => 0.0,
            ];

            $product = $productsByType[$type] ?? null;
            $products[$type] = $product ? [
                'id' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
                'image' => $this->resolveImageForType($type, $product->image),
            ] : null;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'prices' => $pricesPayload,
                'products' => $products,
            ],
        ]);
    }

    /**
     * Update a weigh-in price
     */
    public function update(Request $request, string $type): JsonResponse
    {
        $this->authorizeAdmin($request);

        $normalizedType = strtolower(trim($type));
        $allowedTypes = array_unique(array_merge(
            WeighInPrice::query()->pluck('type')->all(),
            $this->getAgriTypeKeys(),
            ['cooked_copra', 'uncooked_copra', 'coconut', 'bagol']
        ));

        if (!in_array($normalizedType, $allowedTypes, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid price type',
            ], 422);
        }

        $request->validate([
            'price' => 'required|numeric|min:0',
        ]);

        $price = WeighInPrice::updateOrCreate(
            ['type' => $normalizedType],
            ['price' => $request->price]
        );

        return response()->json([
            'success' => true,
            'message' => 'Price updated successfully',
            'data' => $price,
        ]);
    }

    /**
     * Authorize admin access
     */
    private function authorizeAdmin(Request $request): void
    {
        if (!$request->user()->isAdmin()) {
            abort(403, 'Only administrators can perform this action.');
        }
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

    private function resolveImageForType(string $type, ?string $image): ?string
    {
        if ($type === 'bagol') {
            foreach (['/bagol.jpg', '/bagol.jpeg', '/bagol.png'] as $candidate) {
                if (file_exists(public_path(ltrim($candidate, '/')))) {
                    return $candidate;
                }
            }
        }

        return $image;
    }
}

