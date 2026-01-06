<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWeighInRequest;
use App\Models\WeighIn;
use App\Models\WeighInTransaction;
use App\Models\WeighInPrice;
use App\Services\WeighInInventoryService;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class WeighInsController extends Controller
{
    /**
     * Display a listing of weigh-ins and transactions
     */
    public function index(Request $request): Response
    {
        $perPage = $request->integer('per_page', 15);

        // Get transactions with their weigh-ins
        $transactions = WeighInTransaction::query()
            ->with(['weighedBy', 'weighIns'])
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('ref_num', 'like', "%{$search}%")
                      ->orWhereHas('weighedBy', function ($subQ) use ($search) {
                          $subQ->where('name', 'like', "%{$search}%");
                      })
                      ->orWhereHas('weighIns', function ($subQ) use ($search) {
                          $subQ->where('ref_num', 'like', "%{$search}%");
                      });
                });
            })
            ->orderBy('weighed_at', 'desc')
            ->paginate($perPage)
            ->withQueryString();

        // Also get standalone weigh-ins (not part of transactions) for backward compatibility
        $standaloneWeighIns = WeighIn::query()
            ->whereNull('weigh_in_transaction_id')
            ->with('weighedBy')
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('ref_num', 'like', "%{$search}%")
                      ->orWhereHas('weighedBy', function ($subQ) use ($search) {
                          $subQ->where('name', 'like', "%{$search}%");
                      });
                });
            })
            ->when($request->type, function ($query, $type) {
                $query->where('type', $type);
            })
            ->orderBy('weighed_at', 'desc')
            ->get();

        $users = \App\Models\User::orderBy('name')->get();
        
        // Get current prices for all types
        $cookedCopraPrice = WeighInPrice::getPriceForType('cooked_copra');
        $uncookedCopraPrice = WeighInPrice::getPriceForType('uncooked_copra');
        $coconutPrice = WeighInPrice::getPriceForType('coconut');

        return Inertia::render('weigh-ins/index', [
            'transactions' => $transactions,
            'standaloneWeighIns' => $standaloneWeighIns,
            'filters' => $request->only(['search', 'per_page', 'type']),
            'users' => $users,
            'prices' => [
                'cooked_copra' => $cookedCopraPrice,
                'uncooked_copra' => $uncookedCopraPrice,
                'coconut' => $coconutPrice,
            ],
        ]);
    }

    /**
     * Show the form for creating a new weigh-in
     */
    public function create(): Response
    {
        $users = \App\Models\User::orderBy('name')->get();
        
        // Get current prices for all types
        $cookedCopraPrice = WeighInPrice::getPriceForType('cooked_copra');
        $uncookedCopraPrice = WeighInPrice::getPriceForType('uncooked_copra');
        $coconutPrice = WeighInPrice::getPriceForType('coconut');

        return Inertia::render('weigh-ins/create', [
            'users' => $users,
            'prices' => [
                'cooked_copra' => $cookedCopraPrice,
                'uncooked_copra' => $uncookedCopraPrice,
                'coconut' => $coconutPrice,
            ],
        ]);
    }

    /**
     * Store a newly created weigh-in or batch transaction
     * Automatically creates inventory movements (stock IN) when weigh-ins are recorded
     */
    public function store(StoreWeighInRequest $request): RedirectResponse
    {
        $data = $request->validated();
        
        // Check if this is a batch transaction
        $items = $request->input('items', []);
        
        if (empty($items)) {
            // Single weigh-in (backward compatible)
            $price = WeighInPrice::getPriceForType($data['type']);
            if (!$price) {
                return redirect()->back()
                    ->withErrors(['type' => 'Price not set for ' . $data['type'] . '. Please set the price first.'])
                    ->withInput();
            }
            
            $data['unit_price'] = $price;
            $weighIn = WeighIn::create($data);

            // Create inventory movement (stock IN) for this weigh-in
            $userId = $data['weighed_by_user_id'] ?? $request->user()?->id ?? 1;
            try {
                WeighInInventoryService::createInventoryMovementFromWeighIn($weighIn, $userId);
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error('Failed to create inventory movement for weigh-in', [
                    'weigh_in_id' => $weighIn->id,
                    'error' => $e->getMessage(),
                ]);
            }

            return redirect()->route('weigh-ins.index')
                            ->with('success', 'Weigh-in recorded successfully.');
        }

        // Batch transaction - create transaction first
        try {
            DB::beginTransaction();

            $transaction = WeighInTransaction::create([
                'weighed_by_user_id' => $data['weighed_by_user_id'],
                'weighed_at' => $data['weighed_at'],
                'notes' => $data['notes'] ?? null,
                'status' => 'unpaid',
            ]);

            $userId = $data['weighed_by_user_id'] ?? $request->user()?->id ?? 1;

            // Create each weigh-in item
            foreach ($items as $item) {
                $price = WeighInPrice::getPriceForType($item['type']);
                if (!$price) {
                    DB::rollBack();
                    return redirect()->back()
                        ->withErrors(['items' => 'Price not set for ' . $item['type'] . '. Please set the price first.'])
                        ->withInput();
                }

                $itemData = [
                    'weigh_in_transaction_id' => $transaction->id,
                    'type' => $item['type'],
                    'weight_kg' => $item['weight_kg'] ?? null,
                    'count' => $item['count'] ?? null,
                    'unit_price' => $price,
                    'weighed_by_user_id' => $data['weighed_by_user_id'],
                    'weighed_at' => $data['weighed_at'],
                    'notes' => $item['notes'] ?? null,
                    'status' => 'unpaid', // Individual items inherit transaction status
                ];

                $weighIn = WeighIn::create($itemData);

                // Create inventory movement (stock IN) for this weigh-in
                try {
                    WeighInInventoryService::createInventoryMovementFromWeighIn($weighIn, $userId);
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::error('Failed to create inventory movement for weigh-in', [
                        'weigh_in_id' => $weighIn->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // Update transaction total (will be auto-calculated by model event)
            $transaction->refresh();

            DB::commit();

            return redirect()->route('weigh-ins.index')
                            ->with('success', 'Weigh-in transaction recorded successfully with ' . count($items) . ' item(s).');
        } catch (\Exception $e) {
            DB::rollBack();
            return redirect()->back()
                ->withErrors(['error' => 'Failed to create weigh-in transaction: ' . $e->getMessage()])
                ->withInput();
        }
    }

    /**
     * Display the specified weigh-in
     */
    public function show(WeighIn $weighIn): Response
    {
        $weighIn->load('weighedBy');

        return Inertia::render('weigh-ins/show', [
            'weighIn' => $weighIn,
        ]);
    }

    /**
     * Update the status of a weigh-in or transaction
     */
    public function updateStatus(Request $request, $id): RedirectResponse
    {
        $request->validate([
            'status' => 'required|in:unpaid,paid',
            'type' => 'required|in:weigh_in,transaction',
        ]);

        if ($request->type === 'transaction') {
            $transaction = WeighInTransaction::findOrFail($id);
            $transaction->update([
                'status' => $request->status,
            ]);
            
            // Update all related weigh-ins to match transaction status
            $transaction->weighIns()->update(['status' => $request->status]);

            return redirect()->back()
                ->with('success', 'Transaction status updated successfully.');
        } else {
            $weighIn = WeighIn::findOrFail($id);
            $weighIn->update([
                'status' => $request->status,
            ]);

            // If weigh-in is part of a transaction, update transaction status
            if ($weighIn->weigh_in_transaction_id) {
                $transaction = $weighIn->transaction;
                // Check if all weigh-ins in transaction are paid
                $allPaid = $transaction->weighIns()->where('status', 'paid')->count() === $transaction->weighIns()->count();
                $transaction->update(['status' => $allPaid ? 'paid' : 'unpaid']);
            }

            return redirect()->back()
                ->with('success', 'Weigh-in status updated successfully.');
        }
    }
}
