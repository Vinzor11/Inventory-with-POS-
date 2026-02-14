<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\WeighIn;
use App\Models\WeighInTransaction;
use App\Services\WeighInInventoryService;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class WeighInsLandingController extends Controller
{
    /**
     * Display the weigh-ins landing page
     * Shows category cards to create new weigh-ins
     */
    public function index(): Response
    {
        // Get current prices for all types
        $cookedCopraPrice = \App\Models\WeighInPrice::getPriceForType('cooked_copra');
        $uncookedCopraPrice = \App\Models\WeighInPrice::getPriceForType('uncooked_copra');
        $coconutPrice = \App\Models\WeighInPrice::getPriceForType('coconut');

        // Get agricultural products with their images
        $agriculturalProducts = \App\Models\Product::whereHas('category', function ($query) {
            $query->where('name', 'Agricultural Products');
        })->get(['id', 'name', 'sku', 'image'])->keyBy('sku');

        return Inertia::render('weigh-ins-landing', [
            'prices' => [
                'cooked_copra' => $cookedCopraPrice,
                'uncooked_copra' => $uncookedCopraPrice,
                'coconut' => $coconutPrice,
            ],
            'products' => [
                'cooked_copra' => $agriculturalProducts->get('COOKED-COPRA'),
                'uncooked_copra' => $agriculturalProducts->get('UNCOOKED-COPRA'),
                'coconut' => $agriculturalProducts->get('COCONUT'),
            ],
        ]);
    }

    /**
     * Store a newly created weigh-in from landing page
     */
    public function store(\App\Http\Requests\StoreWeighInRequest $request): RedirectResponse
    {
        $data = $request->validated();
        
        // Auto-fetch price from database based on type
        $price = \App\Models\WeighInPrice::getPriceForType($data['type']);
        if (!$price) {
            return redirect()->back()
                ->withErrors(['type' => 'Price not set for ' . $data['type'] . '. Please set the price first.'])
                ->withInput();
        }
        
        $data['unit_price'] = $price;
        
        $weighIn = WeighIn::create($data);

        // Create inventory movement (stock IN) for this weigh-in
        // Get user from request or use default
        $userId = $request->user()?->id ?? $weighIn->weighed_by_user_id ?? 1;
        try {
            WeighInInventoryService::createInventoryMovementFromWeighIn($weighIn, $userId);
        } catch (\Exception $e) {
            // Log error but don't fail the request
            \Illuminate\Support\Facades\Log::error('Failed to create inventory movement for weigh-in', [
                'weigh_in_id' => $weighIn->id,
                'error' => $e->getMessage(),
            ]);
        }

        return redirect()->back()
            ->with('success', 'Weigh-in added successfully.');
    }

    /**
     * Batch store multiple weigh-ins from landing page
     */
    public function batchStore(Request $request): RedirectResponse
    {
        $request->validate([
            'pin' => 'required|string',
            'weigh_ins' => 'required|array|min:1',
            'weigh_ins.*.type' => 'required|in:cooked_copra,uncooked_copra,coconut',
            'weigh_ins.*.weight_kg' => 'nullable|numeric|min:0.01',
            'weigh_ins.*.count' => 'nullable|integer|min:1',
        ]);

        // Verify PIN against active users only.
        $processedBy = User::findActiveByPin($request->pin);

        if (!$processedBy) {
            throw ValidationException::withMessages([
                'pin' => ['Invalid PIN. Please try again.'],
            ]);
        }

        try {
            $transaction = null;
            
            DB::transaction(function () use ($request, $processedBy, &$transaction) {
                // Create a SINGLE transaction for ALL weigh-ins (regardless of type)
                // All weigh-ins in the batch will be grouped under this one transaction
                // weighed_by_user_id = user who entered the PIN
                // weighed_at = current timestamp
                $now = now();
                $transaction = WeighInTransaction::create([
                    'weighed_by_user_id' => $processedBy->id, // User who entered the PIN
                    'weighed_at' => $now, // Current timestamp
                    'notes' => null,
                    'status' => 'unpaid',
                ]);

                // Create all weigh-ins as multiple items within the SAME transaction
                // This includes different types (cooked_copra, uncooked_copra, coconut)
                // All are linked to the same transaction_id
                foreach ($request->weigh_ins as $weighInData) {
                    $price = \App\Models\WeighInPrice::getPriceForType($weighInData['type']);
                    if (!$price) {
                        throw new \Exception('Price not set for ' . $weighInData['type']);
                    }
                    
                    $weighIn = WeighIn::create([
                        'weigh_in_transaction_id' => $transaction->id, // All items share the same transaction
                        'type' => $weighInData['type'],
                        'weight_kg' => $weighInData['weight_kg'] ?? null,
                        'count' => $weighInData['count'] ?? null,
                        'unit_price' => $price,
                        'weighed_by_user_id' => $processedBy->id, // User who entered the PIN
                        'weighed_at' => $now, // Current timestamp
                        'notes' => null,
                        'status' => 'unpaid',
                    ]);

                    // Create inventory movement (stock IN) for this weigh-in
                    // This links weigh-ins to product variants and tracks inventory
                    try {
                        WeighInInventoryService::createInventoryMovementFromWeighIn($weighIn, $processedBy->id);
                    } catch (\Exception $e) {
                        // Log error but don't fail the transaction
                        // This allows weigh-ins to be recorded even if inventory tracking fails
                        \Illuminate\Support\Facades\Log::error('Failed to create inventory movement for weigh-in', [
                            'weigh_in_id' => $weighIn->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                // Refresh transaction to get updated total (sum of all weigh-ins)
                $transaction->refresh();
            });

            return redirect()->route('weigh-ins-landing.success', ['id' => $transaction->id])
                ->with('success', 'Weigh-in transaction processed successfully.');
        } catch (\Exception $e) {
            throw ValidationException::withMessages([
                'weigh_ins' => [$e->getMessage()],
            ]);
        }
    }

    /**
     * Display unpaid weigh-ins page (no auth required)
     */
    public function unpaid(Request $request): Response|\Illuminate\Http\JsonResponse
    {
        // Only show unpaid transactions
        $transactions = WeighInTransaction::with(['weighedBy', 'paidBy', 'weighIns'])
            ->where('status', 'unpaid')
            ->orderBy('weighed_at', 'desc')
            ->get()
            ->map(function ($transaction) {
                return [
                    'id' => $transaction->id,
                    'ref_num' => $transaction->ref_num,
                    'total_amount' => $transaction->total_amount,
                    'status' => $transaction->status,
                    'weighed_at' => $transaction->weighed_at,
                    'notes' => $transaction->notes,
                    'weighed_by' => $transaction->weighedBy ? [
                        'id' => $transaction->weighedBy->id,
                        'name' => $transaction->weighedBy->name,
                    ] : null,
                    'paid_by' => $transaction->paidBy ? [
                        'id' => $transaction->paidBy->id,
                        'name' => $transaction->paidBy->name,
                    ] : null,
                    'paid_at' => $transaction->paid_at,
                    'weigh_ins' => $transaction->weighIns->map(function ($weighIn) {
                        return [
                            'id' => $weighIn->id,
                            'type' => $weighIn->type,
                            'weight_kg' => $weighIn->weight_kg,
                            'count' => $weighIn->count,
                            'unit_price' => $weighIn->unit_price,
                            'total_amount' => $weighIn->total_amount,
                            'status' => $weighIn->status,
                        ];
                    }),
                ];
            });

        // If it's a JSON request (query parameter, wantsJson, or Accept header), return JSON
        if ($request->has('json') || $request->wantsJson() || $request->ajax() || $request->header('Accept') === 'application/json') {
            return response()->json([
                'props' => [
                    'transactions' => $transactions,
                ],
            ]);
        }

        // Otherwise return Inertia page
        return Inertia::render('weigh-ins-landing/unpaid', [
            'transactions' => $transactions,
        ]);
    }

    /**
     * Mark weigh-in transaction as paid (requires admin PIN)
     */
    public function markAsPaid(Request $request, WeighInTransaction $transaction): RedirectResponse|\Illuminate\Http\JsonResponse
    {
        $request->validate([
            'pin' => 'required|string',
        ]);

        // Verify PIN and check if owner is admin.
        $paidBy = User::findActiveByPin($request->pin);

        if (!$paidBy || !$paidBy->isAdmin()) {
            throw ValidationException::withMessages([
                'pin' => ['Invalid PIN or PIN does not belong to an administrator.'],
            ]);
        }

        try {
            DB::transaction(function () use ($transaction, $paidBy) {
                $transaction->update([
                    'status' => 'paid',
                    'paid_by_user_id' => $paidBy->id,
                    'paid_at' => now(),
                ]);

                // Update all related weigh-ins to paid
                $transaction->weighIns()->update([
                    'status' => 'paid',
                ]);
            });

            // Always return redirect (Inertia will handle it)
            return redirect()->back()
                ->with('success', 'Weigh-in transaction marked as paid successfully.');
        } catch (\Exception $e) {
            throw ValidationException::withMessages([
                'payment' => [$e->getMessage()],
            ]);
        }
    }

    /**
     * Process weigh-in payment - mark as paid
     */
    public function processPayment(Request $request, WeighIn $weighIn): RedirectResponse
    {
        $request->validate([
            'pin' => 'required|string',
        ]);

        // Verify PIN against active users only.
        $processedBy = User::findActiveByPin($request->pin);

        if (!$processedBy) {
            throw ValidationException::withMessages([
                'pin' => ['Invalid PIN. Please try again.'],
            ]);
        }

        try {
            $weighIn->update([
                'status' => 'paid',
            ]);
            
            return redirect()->route('weigh-ins-landing.success', ['id' => $weighIn->id])
                ->with('success', 'Weigh-in payment processed successfully.');
        } catch (\Exception $e) {
            throw ValidationException::withMessages([
                'payment' => [$e->getMessage()],
            ]);
        }
    }

    /**
     * Process multiple weigh-ins payment
     */
    public function processPayments(Request $request): RedirectResponse
    {
        $request->validate([
            'pin' => 'required|string',
            'weigh_in_ids' => 'required|array|min:1',
            'weigh_in_ids.*' => 'required|exists:weigh_ins,id',
        ]);

        // Verify PIN against active users only.
        $processedBy = User::findActiveByPin($request->pin);

        if (!$processedBy) {
            throw ValidationException::withMessages([
                'pin' => ['Invalid PIN. Please try again.'],
            ]);
        }

        try {
            DB::transaction(function () use ($request) {
                WeighIn::whereIn('id', $request->weigh_in_ids)
                    ->where('status', 'unpaid')
                    ->update(['status' => 'paid']);
            });
            
            return redirect()->route('weigh-ins-landing')
                ->with('success', 'Weigh-ins payment processed successfully.');
        } catch (\Exception $e) {
            throw ValidationException::withMessages([
                'payment' => [$e->getMessage()],
            ]);
        }
    }

    /**
     * Display weigh-in transaction success page
     */
    public function success(Request $request, $id): Response
    {
        // Check if it's a transaction or single weigh-in
        $transaction = WeighInTransaction::with(['weighedBy', 'weighIns.weighedBy'])->find($id);
        
        if ($transaction) {
            return Inertia::render('weigh-ins-landing/success', [
                'transaction' => $transaction,
            ]);
        }

        // Fallback to single weigh-in for backward compatibility
        $weighIn = WeighIn::with('weighedBy')->findOrFail($id);
        return Inertia::render('weigh-ins-landing/success', [
            'weighIn' => $weighIn,
        ]);
    }
}

