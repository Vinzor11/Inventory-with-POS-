<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\ProductVariant;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockMovementController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_request_id' => ['required', 'uuid'],
            'product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'movement_type' => ['required', 'string', 'in:IN,OUT,in,out'],
            'qty' => ['required', 'numeric', 'gt:0'],
            'reason' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:500'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
        ]);

        $branchId = (int) $request->header('X-Branch-Id', config('pos_bootstrap.store.id', 1));
        $clientRequestId = $validated['client_request_id'];

        $existing = InventoryMovement::query()
            ->where('branch_id', $branchId)
            ->where('client_request_id', $clientRequestId)
            ->first();

        if ($existing) {
            return response()->json([
                'success' => true,
                'data' => $this->toPayload($existing),
            ], 200);
        }

        try {
            $movement = DB::transaction(function () use ($validated, $request, $branchId, $clientRequestId): InventoryMovement {
                $variant = ProductVariant::query()
                    ->with('inventory')
                    ->lockForUpdate()
                    ->findOrFail((int) $validated['product_variant_id']);

                $movementType = strtoupper($validated['movement_type']);
                $quantity = (float) $validated['qty'];
                $currentStock = (float) ($variant->inventory->quantity_on_hand ?? 0);
                $nextStock = $movementType === 'IN'
                    ? $currentStock + $quantity
                    : $currentStock - $quantity;

                if ($nextStock < 0) {
                    abort(422, 'Insufficient stock for OUT movement.');
                }

                $unitCost = array_key_exists('unit_cost', $validated) ? (float) ($validated['unit_cost'] ?? 0) : null;
                $qtySigned = $movementType === 'IN' ? abs($quantity) : -abs($quantity);

                $movement = InventoryMovement::query()->create([
                    'branch_id' => $branchId,
                    'client_request_id' => $clientRequestId,
                    'product_variant_id' => $variant->id,
                    'product_id' => $variant->product_id,
                    'quantity' => abs($quantity),
                    'qty' => $qtySigned,
                    'type' => $movementType,
                    'movement_type' => $movementType === 'IN' ? 'manual_in' : 'manual_out',
                    'reason' => $validated['reason'] ?? 'manual',
                    'reference_type' => 'mobile_sync',
                    'reference_id' => null,
                    'unit_cost' => $unitCost,
                    'total_cost' => $unitCost !== null ? abs($quantity) * $unitCost : null,
                    'unit' => $variant->getOfficialStockUnit(),
                    'notes' => $validated['notes'] ?? null,
                    'recorded_by_user_id' => $request->user()->id,
                ]);

                Inventory::query()->updateOrCreate(
                    ['product_variant_id' => $variant->id],
                    ['quantity_on_hand' => $nextStock]
                );

                return $movement;
            });

            return response()->json([
                'success' => true,
                'data' => $this->toPayload($movement),
            ], 201);
        } catch (QueryException $exception) {
            if ($this->isDuplicateKeyException($exception)) {
                $duplicate = InventoryMovement::query()
                    ->where('branch_id', $branchId)
                    ->where('client_request_id', $clientRequestId)
                    ->first();

                if ($duplicate) {
                    return response()->json([
                        'success' => true,
                        'data' => $this->toPayload($duplicate),
                    ], 200);
                }
            }

            throw $exception;
        }
    }

    private function toPayload(InventoryMovement $movement): array
    {
        return [
            'id' => $movement->id,
            'client_request_id' => $movement->client_request_id,
            'product_variant_id' => $movement->product_variant_id,
            'movement_type' => strtoupper((string) ($movement->type ?? 'IN')),
            'qty' => abs((float) ($movement->quantity ?? 0)),
            'created_at' => optional($movement->created_at)->toIso8601String(),
        ];
    }

    private function isDuplicateKeyException(QueryException $exception): bool
    {
        $sqlState = $exception->errorInfo[0] ?? '';
        $driverCode = (string) ($exception->errorInfo[1] ?? '');

        return in_array($sqlState, ['23000', '23505'], true)
            || in_array($driverCode, ['1062', '2067'], true);
    }
}
