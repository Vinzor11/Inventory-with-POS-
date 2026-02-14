<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\User;
use App\Models\WeighIn;
use App\Models\WeighInPrice;
use App\Models\WeighInTransaction;
use App\Services\ReceiptPrintService;
use App\Services\WeighInInventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WeighInController extends Controller
{
    /**
     * List all weigh-in transactions.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $type = $request->input('type');
        $status = $request->input('status');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $query = WeighInTransaction::with(['weighIns', 'paidBy', 'weighedBy'])
            ->orderBy('weighed_at', 'desc')
            ->orderBy('created_at', 'desc');

        $allowedTypes = $this->getAllowedWeighInTypes();
        if ($type && in_array($type, $allowedTypes, true)) {
            $query->whereHas('weighIns', function ($q) use ($type) {
                $q->where('type', $type);
            });
        }

        if ($status && in_array($status, ['unpaid', 'paid'])) {
            $query->where('status', $status);
        }

        if ($dateFrom) {
            $query->whereDate('weighed_at', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('weighed_at', '<=', $dateTo);
        }

        $transactions = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $transactions,
        ]);
    }

    /**
     * List unpaid transactions with flattened payload for mobile.
     */
    public function unpaid(): JsonResponse
    {
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
                            'ref_num' => $weighIn->ref_num,
                            'type' => $weighIn->type,
                            'weight_kg' => $weighIn->weight_kg,
                            'count' => $weighIn->count,
                            'unit_price' => $weighIn->unit_price,
                            'total_amount' => $weighIn->total_amount,
                            'status' => $weighIn->status,
                        ];
                    }),
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => $transactions,
        ]);
    }

    /**
     * Show one weigh-in transaction.
     */
    public function show(WeighInTransaction $weighIn): JsonResponse
    {
        $weighIn->load(['weighIns', 'paidBy', 'weighedBy']);

        return response()->json([
            'success' => true,
            'data' => $weighIn,
        ]);
    }

    /**
     * Store one transaction containing multiple weigh-ins.
     *
     * Payload:
     * - pin
     * - weigh_ins[]: { type, weight_kg?, count? }
     */
    public function batchStore(Request $request): JsonResponse
    {
        $allowedTypes = $this->getAllowedWeighInTypes();

        $request->validate([
            'pin' => 'required|string',
            'weigh_ins' => 'required|array|min:1',
            'weigh_ins.*.type' => ['required', Rule::in($allowedTypes)],
            'weigh_ins.*.weight_kg' => 'nullable|numeric|min:0.01',
            'weigh_ins.*.count' => 'nullable|integer|min:1',
        ]);

        $processedBy = $this->resolveUserByPin($request->pin);
        if (!$processedBy) {
            throw ValidationException::withMessages([
                'pin' => ['Invalid PIN. Please try again.'],
            ]);
        }

        try {
            $transaction = null;

            DB::transaction(function () use ($request, $processedBy, &$transaction) {
                $now = now();
                $transaction = WeighInTransaction::create([
                    'weighed_by_user_id' => $processedBy->id,
                    'weighed_at' => $now,
                    'notes' => null,
                    'status' => 'unpaid',
                ]);

                foreach ($request->weigh_ins as $weighInData) {
                    $price = WeighInPrice::getPriceForType($weighInData['type']);
                    if (!$price) {
                        throw new \Exception('Price not set for ' . $weighInData['type']);
                    }

                    $weighIn = WeighIn::create([
                        'weigh_in_transaction_id' => $transaction->id,
                        'type' => $weighInData['type'],
                        'weight_kg' => $weighInData['weight_kg'] ?? null,
                        'count' => $weighInData['count'] ?? null,
                        'unit_price' => $price,
                        'weighed_by_user_id' => $processedBy->id,
                        'weighed_at' => $now,
                        'notes' => null,
                        'status' => 'unpaid',
                    ]);

                    try {
                        WeighInInventoryService::createInventoryMovementFromWeighIn($weighIn, $processedBy->id);
                    } catch (\Exception $e) {
                        \Illuminate\Support\Facades\Log::error('Failed to create inventory movement for weigh-in', [
                            'weigh_in_id' => $weighIn->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            });

            return response()->json([
                'success' => true,
                'message' => 'Weigh-in transaction processed successfully.',
                'data' => $transaction->fresh()->load(['weighIns', 'weighedBy', 'paidBy']),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Legacy single-store entry point.
     * Mobile uses batchStore for parity with web landing flow.
     */
    public function store(Request $request): JsonResponse
    {
        return $this->batchStore($request);
    }

    /**
     * Update transaction status (admin only).
     */
    public function updateStatus(Request $request, WeighInTransaction $weighIn): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'status' => 'required|string|in:unpaid,paid',
        ]);

        DB::transaction(function () use ($request, $weighIn) {
            $weighIn->update([
                'status' => $request->status,
                'paid_at' => $request->status === 'paid' ? now() : null,
                'paid_by_user_id' => $request->status === 'paid' ? $request->user()->id : null,
            ]);

            $weighIn->weighIns()->update([
                'status' => $request->status,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Status updated successfully',
            'data' => $weighIn->fresh()->load(['weighIns', 'weighedBy', 'paidBy']),
        ]);
    }

    /**
     * Mark transaction as paid via admin PIN.
     */
    public function markAsPaid(Request $request, WeighInTransaction $weighIn): JsonResponse
    {
        $request->validate([
            'pin' => 'required|string',
        ]);

        $paidBy = $this->resolveUserByPin($request->pin);
        if (!$paidBy || !$paidBy->isAdmin()) {
            throw ValidationException::withMessages([
                'pin' => ['Invalid PIN or PIN does not belong to an administrator.'],
            ]);
        }

        if ($weighIn->status === 'paid') {
            return response()->json([
                'success' => false,
                'message' => 'This weigh-in transaction is already paid',
            ], 422);
        }

        DB::transaction(function () use ($weighIn, $paidBy) {
            $weighIn->update([
                'status' => 'paid',
                'paid_by_user_id' => $paidBy->id,
                'paid_at' => now(),
            ]);

            $weighIn->weighIns()->update([
                'status' => 'paid',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Weigh-in transaction marked as paid successfully.',
            'data' => $weighIn->fresh()->load(['weighIns', 'weighedBy', 'paidBy']),
        ]);
    }

    /**
     * Process payment for weigh-in transaction using PIN (non-admin accepted).
     */
    public function processPayment(Request $request, WeighInTransaction $weighIn): JsonResponse
    {
        $request->validate([
            'pin' => 'required|string|size:4',
        ]);

        $user = $this->resolveUserByPin($request->pin);
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid PIN',
            ], 422);
        }

        if ($weighIn->status === 'paid') {
            return response()->json([
                'success' => false,
                'message' => 'This weigh-in is already paid',
            ], 422);
        }

        DB::transaction(function () use ($weighIn, $user) {
            $weighIn->update([
                'status' => 'paid',
                'paid_at' => now(),
                'paid_by_user_id' => $user->id,
            ]);

            $weighIn->weighIns()->update([
                'status' => 'paid',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Payment processed successfully',
            'data' => $weighIn->fresh()->load(['weighIns', 'weighedBy', 'paidBy']),
        ]);
    }

    /**
     * Get weigh-in receipt.
     */
    public function receipt(Request $request, WeighInTransaction $transaction): JsonResponse
    {
        $transaction->load(['weighIns', 'paidBy', 'weighedBy']);

        $charWidth = $request->input('char_width', 32);
        $printService = new ReceiptPrintService($charWidth);
        $receiptText = $printService->generateWeighInReceiptPlain($transaction);

        return response()->json([
            'success' => true,
            'data' => [
                'transaction' => $transaction,
                'receipt_text' => $receiptText,
            ],
        ]);
    }

    private function resolveUserByPin(string $pin): ?User
    {
        return User::findActiveByPin($pin);
    }

    private function authorizeAdmin(Request $request): void
    {
        if (!$request->user()->isAdmin()) {
            abort(403, 'Only administrators can perform this action.');
        }
    }

    /**
     * @return array<int, string>
     */
    private function getAllowedWeighInTypes(): array
    {
        $agriTypes = Product::query()
            ->whereHas('category', function ($query) {
                $query->where('name', 'Agricultural Products');
            })
            ->get(['name', 'sku'])
            ->map(function (Product $product) {
                return $this->inferTypeKeyFromProduct($product);
            })
            ->filter()
            ->values()
            ->all();

        return array_values(array_unique(array_merge(
            ['cooked_copra', 'uncooked_copra', 'bagol', 'coconut'],
            WeighInPrice::query()->pluck('type')->all(),
            $agriTypes
        )));
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
}
