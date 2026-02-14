<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Payment;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Services\ReceiptPrintService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaleController extends Controller
{
    /**
     * Display a listing of sales
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $search = $request->input('search');
        $status = $request->input('status');
        $paymentStatus = $request->input('payment_status');
        $deliveryStatus = $request->input('delivery_status');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $query = Sale::with(['cashier', 'voidedBy', 'items.productVariant.product.category', 'refunds.items', 'deliveries.items'])
            ->withCount('items')
            ->orderBy('created_at', 'desc');

        if ($search) {
            $query->where('sale_number', 'like', "%{$search}%");
        }

        if ($status && in_array($status, ['OPEN', 'COMPLETED', 'PARTIAL', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED'])) {
            $query->where('status', $status);
        }

        if ($paymentStatus && in_array($paymentStatus, ['UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REVERSED'])) {
            $query->where('payment_status', $paymentStatus);
        }

        if ($deliveryStatus) {
            if ($deliveryStatus === 'WALK_IN') {
                $query->where('is_for_delivery', false);
            } elseif (in_array($deliveryStatus, ['PENDING', 'PARTIAL', 'DELIVERED', 'RETURNED', 'CANCELED'])) {
                $query->where('is_for_delivery', true)
                    ->where('delivery_status', $deliveryStatus);
            }
        }

        if ($dateFrom) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $sales = $query->paginate($perPage);

        // Match web sales listing behavior: expose whether a delivery sale still has
        // deliverable quantity after delivered/refunded/canceled adjustments.
        $sales->getCollection()->transform(function ($sale) {
            if (!$sale->is_for_delivery) {
                $sale->has_remaining_delivery = false;
                return $sale;
            }

            $refundedQuantities = [];
            foreach ($sale->refunds as $refund) {
                foreach ($refund->items as $refundItem) {
                    $saleItemId = $refundItem->sale_item_id;
                    $refundedQuantities[$saleItemId] = ($refundedQuantities[$saleItemId] ?? 0) + $refundItem->quantity;
                }
            }

            $hasRemaining = false;
            foreach ($sale->items as $saleItem) {
                $itemStatus = $saleItem->item_status ?? 'ACTIVE';
                if ($itemStatus === 'CANCELED') {
                    continue;
                }

                $refundedQty = $refundedQuantities[$saleItem->id] ?? 0;
                $deliveredQty = $saleItem->delivered_quantity ?? 0;
                $canceledQty = $saleItem->canceled_quantity ?? 0;
                $remainingQty = $saleItem->quantity - $refundedQty - $deliveredQty - $canceledQty;

                if ($remainingQty > 0) {
                    $hasRemaining = true;
                    break;
                }
            }

            $sale->has_remaining_delivery = $hasRemaining;
            return $sale;
        });

        return response()->json([
            'success' => true,
            'data' => $sales,
        ]);
    }

    /**
     * Store a sale for outbox sync with idempotency by client_request_id.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_request_id' => ['required', 'uuid'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'payment_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'in:cash,gcash,cheque,credit'],
            'is_for_delivery' => ['nullable', 'boolean'],
            'delivery_name' => ['nullable', 'string', 'max:255'],
            'delivery_address' => ['nullable', 'string', 'max:500'],
            'delivery_contact' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $branchId = (int) $request->header('X-Branch-Id', config('pos_bootstrap.store.id', 1));
        $clientRequestId = $validated['client_request_id'];

        $existing = Sale::query()
            ->where('branch_id', $branchId)
            ->where('client_request_id', $clientRequestId)
            ->with(['items.productVariant.product', 'cashier', 'payments'])
            ->first();

        if ($existing) {
            return response()->json([
                'success' => true,
                'data' => $this->toSyncSalePayload($existing),
            ], 200);
        }

        try {
            $sale = DB::transaction(function () use ($validated, $request, $branchId, $clientRequestId): Sale {
                $isForDelivery = (bool) ($validated['is_for_delivery'] ?? false);
                $paymentAmount = (float) ($validated['payment_amount'] ?? 0);
                $paymentMethod = (string) ($validated['payment_method'] ?? 'cash');
                $lineItems = $validated['items'];

                $variantIds = collect($lineItems)->pluck('product_variant_id')->unique()->values()->all();
                $variants = ProductVariant::query()
                    ->with(['inventory', 'product.category'])
                    ->whereIn('id', $variantIds)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                if ($variants->count() !== count($variantIds)) {
                    throw ValidationException::withMessages([
                        'items' => ['One or more product variants were not found.'],
                    ]);
                }

                $subtotal = 0.0;
                $saleItemsPayload = [];
                $requestedByVariant = [];
                foreach ($lineItems as $item) {
                    $variantId = (int) $item['product_variant_id'];
                    $requestedByVariant[$variantId] = ($requestedByVariant[$variantId] ?? 0) + (float) $item['quantity'];
                }

                foreach ($lineItems as $item) {
                    $variantId = (int) $item['product_variant_id'];
                    $variant = $variants->get($variantId);
                    if (!$variant) {
                        throw ValidationException::withMessages([
                            'items' => ["Variant {$variantId} not found."],
                        ]);
                    }

                    if (!$variant->product?->is_active) {
                        throw ValidationException::withMessages([
                            'items' => ["Variant {$variantId} is under an inactive product."],
                        ]);
                    }

                    $quantity = (float) $item['quantity'];
                    $unitPrice = array_key_exists('unit_price', $item) && $item['unit_price'] !== null
                        ? (float) $item['unit_price']
                        : (float) $variant->unit_price;

                    if ($variant->product->track_stock && !$isForDelivery) {
                        $availableStock = (float) ($variant->inventory->quantity_on_hand ?? 0);
                        $requestedTotal = (float) ($requestedByVariant[$variantId] ?? 0);
                        if ($requestedTotal > $availableStock) {
                            throw ValidationException::withMessages([
                                'items' => [
                                    "Insufficient stock for {$variant->description}. Available: {$availableStock}, Requested: {$requestedTotal}.",
                                ],
                            ]);
                        }
                    }

                    $lineTotal = round($quantity * $unitPrice, 2);
                    $subtotal += $lineTotal;

                    $saleItemsPayload[] = [
                        'variant' => $variant,
                        'quantity' => $quantity,
                        'unit_price' => $unitPrice,
                        'line_total' => $lineTotal,
                    ];
                }

                $sale = Sale::query()->create([
                    'branch_id' => $branchId,
                    'client_request_id' => $clientRequestId,
                    'sale_number' => Sale::generateSaleNumber(),
                    'status' => 'OPEN',
                    'payment_status' => 'UNPAID',
                    'is_for_delivery' => $isForDelivery,
                    'delivery_status' => $isForDelivery ? 'PENDING' : null,
                    'delivery_name' => $isForDelivery ? ($validated['delivery_name'] ?? null) : null,
                    'delivery_address' => $isForDelivery ? ($validated['delivery_address'] ?? null) : null,
                    'delivery_contact' => $isForDelivery ? ($validated['delivery_contact'] ?? null) : null,
                    'subtotal' => $subtotal,
                    'total' => $subtotal,
                    'notes' => $validated['notes'] ?? null,
                    'cashier_user_id' => $request->user()->id,
                ]);

                foreach ($saleItemsPayload as $itemPayload) {
                    $variant = $itemPayload['variant'];
                    $quantity = (float) $itemPayload['quantity'];

                    SaleItem::query()->create([
                        'sale_id' => $sale->id,
                        'product_variant_id' => $variant->id,
                        'quantity' => $quantity,
                        'unit_price' => $itemPayload['unit_price'],
                        'line_total' => $itemPayload['line_total'],
                        'unit_cost' => $variant->purchase_price,
                        'total_cost' => $variant->purchase_price !== null
                            ? round($quantity * (float) $variant->purchase_price, 4)
                            : null,
                    ]);

                    if (!$isForDelivery && $variant->product->track_stock) {
                        $currentStock = (float) ($variant->inventory->quantity_on_hand ?? 0);
                        $newStock = max(0, $currentStock - $quantity);

                        InventoryMovement::query()->create([
                            'branch_id' => $branchId,
                            'product_variant_id' => $variant->id,
                            'product_id' => $variant->product_id,
                            'quantity' => abs($quantity),
                            'qty' => -abs($quantity),
                            'type' => 'OUT',
                            'movement_type' => 'sale_out',
                            'reason' => 'sale',
                            'reference_id' => $sale->id,
                            'reference_type' => 'Sale',
                            'unit_cost' => $variant->purchase_price,
                            'total_cost' => $variant->purchase_price !== null
                                ? round($quantity * (float) $variant->purchase_price, 4)
                                : null,
                            'unit' => $variant->getOfficialStockUnit(),
                            'notes' => "Sale: {$sale->sale_number}",
                            'recorded_by_user_id' => $request->user()->id,
                        ]);

                        Inventory::query()->updateOrCreate(
                            ['product_variant_id' => $variant->id],
                            ['quantity_on_hand' => $newStock]
                        );
                    }
                }

                if ($isForDelivery) {
                    Delivery::query()->create([
                        'sale_id' => $sale->id,
                        'delivered_by_user_id' => null,
                        'delivered_at' => null,
                        'status' => 'pending',
                        'notes' => null,
                    ]);
                }

                if ($paymentAmount > 0) {
                    Payment::query()->create([
                        'sale_id' => $sale->id,
                        'amount' => $paymentAmount,
                        'payment_method' => $paymentMethod,
                        'received_by_user_id' => $request->user()->id,
                        'received_at' => now(),
                        'notes' => 'Initial payment from mobile sync',
                    ]);

                    $sale->refresh()->load('payments');
                    $sale->updatePaymentStatus();
                }

                $sale->computeSaleStatus();

                return $sale->fresh()->load(['items.productVariant.product', 'cashier', 'payments']);
            });

            return response()->json([
                'success' => true,
                'data' => $this->toSyncSalePayload($sale),
            ], 201);
        } catch (QueryException $exception) {
            if ($this->isDuplicateKeyException($exception)) {
                $duplicate = Sale::query()
                    ->where('branch_id', $branchId)
                    ->where('client_request_id', $clientRequestId)
                    ->with(['items.productVariant.product', 'cashier', 'payments'])
                    ->first();

                if ($duplicate) {
                    return response()->json([
                        'success' => true,
                        'data' => $this->toSyncSalePayload($duplicate),
                    ], 200);
                }
            }

            throw $exception;
        }
    }

    /**
     * Display the specified sale
     */
    public function show(Sale $sale): JsonResponse
    {
        $sale->load([
            'cashier',
            'voidedBy',
            'items.productVariant.product.category',
            'payments.receivedBy',
            'refunds.items.productVariant.product',
            'refunds.processedBy',
            'deliveries.items.productVariant.product',
            'deliveries.deliveredBy',
            'adjustments.processedBy',
        ]);

        return response()->json([
            'success' => true,
            'data' => $sale,
        ]);
    }

    /**
     * Void a sale
     */
    public function void(Request $request, Sale $sale): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        if ($sale->status === 'VOIDED') {
            return response()->json([
                'success' => false,
                'message' => 'Sale is already voided',
            ], 422);
        }

        if ($sale->status === 'REFUNDED') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot void a refunded sale',
            ], 422);
        }

        DB::transaction(function () use ($sale, $request) {
            // Restore inventory for non-delivery sales
            if (!$sale->is_for_delivery) {
                foreach ($sale->items as $item) {
                    $variant = $item->productVariant;
                    $currentStock = $variant->inventory->quantity_on_hand ?? 0;
                    $newStock = $currentStock + $item->quantity;

                    InventoryMovement::create([
                        'product_variant_id' => $variant->id,
                        'quantity' => $item->quantity,
                        'type' => 'IN',
                        'reason' => 'void',
                        'reference_id' => $sale->id,
                        'notes' => "Void: {$sale->sale_number} - {$request->reason}",
                        'recorded_by_user_id' => $request->user()->id,
                    ]);

                    Inventory::updateOrCreate(
                        ['product_variant_id' => $variant->id],
                        ['quantity_on_hand' => $newStock]
                    );
                }
            }

            $sale->update([
                'status' => 'VOIDED',
                'voided_at' => now(),
                'voided_by_user_id' => $request->user()->id,
                'void_reason' => $request->reason,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Sale voided successfully',
            'data' => $sale->fresh()->load(['cashier', 'voidedBy', 'items.productVariant.product']),
        ]);
    }

    /**
     * Cancel an item from a sale
     */
    public function cancelItem(Request $request, Sale $sale): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'sale_item_id' => 'required|exists:sale_items,id',
            'quantity_to_cancel' => 'nullable|numeric|min:0.01',
            'reason' => 'nullable|string|max:500',
        ]);

        $saleItem = $sale->items()->find($request->sale_item_id);

        if (!$saleItem) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found in this sale',
            ], 422);
        }

        if (!$saleItem->canBeCanceled()) {
            return response()->json([
                'success' => false,
                'message' => 'Item cannot be canceled. No undelivered quantity available.',
            ], 422);
        }

        try {
            $quantityToCancel = $request->input('quantity_to_cancel', $saleItem->max_cancelable_quantity);

            DB::transaction(function () use ($sale, $saleItem, $request, $quantityToCancel) {
                $saleItem->cancel(
                    (float) $quantityToCancel,
                    $request->user()->id,
                    $request->input('reason')
                );
                $sale->adjustSale();
            });
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Item canceled successfully',
            'data' => $sale->fresh()->load(['cashier', 'items.productVariant.product']),
        ]);
    }

    /**
     * Get receipt for a sale
     */
    public function receipt(Request $request, Sale $sale): JsonResponse
    {
        $sale->load([
            'items.productVariant.product',
            'cashier',
            'payments.receivedBy',
        ]);

        $totalPaid = $sale->total_paid;
        $saleTotal = $sale->total;
        $balance = max(0, $saleTotal - $totalPaid);
        $change = max(0, $totalPaid - $saleTotal);

        $paymentSummary = [
            'total_paid' => $totalPaid,
            'balance' => $balance,
            'change' => $change,
        ];

        $charWidth = $request->input('char_width', 32);
        $printService = new ReceiptPrintService($charWidth);
        $receiptText = $printService->generateSalesReceiptPlain($sale, $paymentSummary);

        return response()->json([
            'success' => true,
            'data' => [
                'sale' => $sale,
                'payment_summary' => $paymentSummary,
                'receipt_text' => $receiptText,
            ],
        ]);
    }

    private function toSyncSalePayload(Sale $sale): array
    {
        return [
            'id' => $sale->id,
            'sale_number' => $sale->sale_number,
            'client_request_id' => $sale->client_request_id,
            'status' => $sale->status,
            'payment_status' => $sale->payment_status,
            'total' => (float) $sale->total,
            'created_at' => optional($sale->created_at)->toIso8601String(),
            'items' => $sale->items->map(static function ($item): array {
                return [
                    'product_variant_id' => $item->product_variant_id,
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'line_total' => (float) $item->line_total,
                ];
            })->values()->all(),
        ];
    }

    private function isDuplicateKeyException(QueryException $exception): bool
    {
        $sqlState = $exception->errorInfo[0] ?? '';
        $driverCode = (string) ($exception->errorInfo[1] ?? '');

        return in_array($sqlState, ['23000', '23505'], true)
            || in_array($driverCode, ['1062', '2067'], true);
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

