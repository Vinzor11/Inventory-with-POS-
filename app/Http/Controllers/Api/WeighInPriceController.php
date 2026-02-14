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

        $findBySku = function (string $sku) use ($agriProducts) {
            return $agriProducts->firstWhere('sku', $sku);
        };

        $findByName = function (array $keywords) use ($agriProducts) {
            return $agriProducts->first(function ($product) use ($keywords) {
                $name = strtolower($product->name ?? '');
                foreach ($keywords as $keyword) {
                    if (str_contains($name, strtolower($keyword))) {
                        return true;
                    }
                }
                return false;
            });
        };

        $cooked = $findBySku('COOKED-COPRA') ?? $findByName(['cooked copra']);
        $uncooked = $findBySku('UNCOOKED-COPRA') ?? $findByName(['uncooked copra']);
        $coconut = $findBySku('COCONUT') ?? $findByName(['coconut']);

        return response()->json([
            'success' => true,
            'data' => [
                'prices' => $prices,
                'products' => [
                    'cooked_copra' => $cooked ? [
                        'id' => $cooked->id,
                        'name' => $cooked->name,
                        'sku' => $cooked->sku,
                        'image' => $cooked->image,
                    ] : null,
                    'uncooked_copra' => $uncooked ? [
                        'id' => $uncooked->id,
                        'name' => $uncooked->name,
                        'sku' => $uncooked->sku,
                        'image' => $uncooked->image,
                    ] : null,
                    'coconut' => $coconut ? [
                        'id' => $coconut->id,
                        'name' => $coconut->name,
                        'sku' => $coconut->sku,
                        'image' => $coconut->image,
                    ] : null,
                ],
            ],
        ]);
    }

    /**
     * Update a weigh-in price
     */
    public function update(Request $request, string $type): JsonResponse
    {
        $this->authorizeAdmin($request);

        if (!in_array($type, ['cooked_copra', 'uncooked_copra', 'coconut'])) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid price type',
            ], 422);
        }

        $request->validate([
            'price' => 'required|numeric|min:0',
        ]);

        $price = WeighInPrice::updateOrCreate(
            ['type' => $type],
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
}

