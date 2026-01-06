<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateWeighInPriceRequest;
use App\Models\WeighInPrice;
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
        $cookedCopraPrice = WeighInPrice::where('type', 'cooked_copra')->first();
        $uncookedCopraPrice = WeighInPrice::where('type', 'uncooked_copra')->first();
        $coconutPrice = WeighInPrice::where('type', 'coconut')->first();

        return Inertia::render('weigh-ins/prices', [
            'prices' => [
                'cooked_copra' => $cookedCopraPrice ? (float) $cookedCopraPrice->price : null,
                'uncooked_copra' => $uncookedCopraPrice ? (float) $uncookedCopraPrice->price : null,
                'coconut' => $coconutPrice ? (float) $coconutPrice->price : null,
            ],
        ]);
    }

    /**
     * Update the price for a specific type
     */
    public function update(UpdateWeighInPriceRequest $request, string $type): RedirectResponse
    {
        $validated = $request->validated();

        WeighInPrice::updateOrCreate(
            ['type' => $type],
            ['price' => $validated['price']]
        );

        return redirect()->route('weigh-ins.prices.index')
            ->with('success', ucfirst($type) . ' price updated successfully.');
    }
}
