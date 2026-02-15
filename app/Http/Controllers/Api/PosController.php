<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PosController extends Controller
{
    /**
     * Get all active categories for POS
     */
    public function getCategories(): JsonResponse
    {
        $categories = ProductCategory::where('is_active', true)
            ->where('name', '!=', 'Agricultural Products')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Get all active products for POS
     */
    public function getProducts(Request $request): JsonResponse
    {
        $categoryId = $request->input('category_id');

        $query = Product::where('is_active', true)
            ->whereHas('category', function ($q) {
                $q->where('name', '!=', 'Agricultural Products');
            })
            ->with([
                'category',
                'variants' => function ($q) {
                    $q->orderBy('unit_price', 'asc')
                        ->with('inventory');
                }
            ])
            ->orderBy('name');

        if ($categoryId) {
            $query->where('category_id', $categoryId);
        }

        $products = $query->get();
        $variantIds = $products->flatMap(function ($product) {
            return $product->variants->pluck('id');
        })->map(fn ($id) => (int) $id)->unique()->values()->all();

        $reservedByVariant = $this->reservedDeliveryQuantitiesByVariant($variantIds);

        $products->each(function ($product) use ($reservedByVariant) {
            $product->variants->each(function ($variant) use ($reservedByVariant) {
                $stock = (float) ($variant->inventory->quantity_on_hand ?? 0);
                $reserved = (float) ($reservedByVariant[$variant->id] ?? 0);
                $available = max(0, $stock - $reserved);

                $variant->setAttribute('reserved_for_delivery', $reserved);
                $variant->setAttribute('available_quantity', $available);
            });
        });

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }

    /**
     * Verify PIN
     */
    public function verifyPin(Request $request): JsonResponse
    {
        $request->validate([
            'pin' => 'required|string|size:4',
        ]);

        $user = User::findActiveByPin($request->pin);

        if (!$user) {
            throw ValidationException::withMessages([
                'pin' => ['Invalid PIN. Please try again.'],
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $user->id,
                'user_name' => $user->name,
                'role' => $user->role,
            ],
        ]);
    }

    /**
     * Process POS checkout
     */
    public function checkout(Request $request): JsonResponse
    {
        $request->validate([
            'pin' => 'required|string|size:4',
            'items' => 'required|array|min:1',
            'items.*.product_variant_id' => 'required|exists:product_variants,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'nullable|numeric|min:0.01',
            'payment_amount' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|string|in:cash,gcash,cheque,credit',
            'is_for_delivery' => 'nullable|boolean',
            'delivery_name' => 'nullable|string|max:255|required_if:is_for_delivery,true',
            'delivery_address' => 'nullable|string|max:500|required_if:is_for_delivery,true',
            'delivery_contact' => 'nullable|string|max:50|required_if:is_for_delivery,true',
            'notes' => 'nullable|string|max:500',
        ]);

        // Verify PIN against active users only.
        $cashier = User::findActiveByPin($request->pin);

        if (!$cashier) {
            throw ValidationException::withMessages([
                'pin' => ['Invalid PIN. Please try again.'],
            ]);
        }

        try {
            $sale = DB::transaction(function () use ($request, $cashier) {
                $items = $request->items;
                $subtotal = 0;
                $saleItems = [];
                $requestedByVariant = [];
                $pricingStateByVariant = [];
                foreach ($items as $itemData) {
                    $variantId = (int) $itemData['product_variant_id'];
                    $requestedByVariant[$variantId] = ($requestedByVariant[$variantId] ?? 0) + (float) $itemData['quantity'];
                }
                $reservedByVariant = $this->reservedDeliveryQuantitiesByVariant(array_keys($requestedByVariant));
                $validatedVariantIds = [];

                foreach ($items as $itemData) {
                    $variant = ProductVariant::with(['inventory', 'product.category'])->findOrFail($itemData['product_variant_id']);

                    // Validate that product is not from Agricultural Products category
                    if ($variant->product->category && $variant->product->category->name === 'Agricultural Products') {
                        throw new \Exception(
                            "Agricultural products (copra/coconut) cannot be sold through the POS."
                        );
                    }

                    $currentStock = (float) ($variant->inventory->quantity_on_hand ?? 0);
                    $reservedForDelivery = (float) ($reservedByVariant[$variant->id] ?? 0);
                    $availableStock = max(0, $currentStock - $reservedForDelivery);
                    $requestedQuantity = (float) $itemData['quantity'];

                    if (!in_array($variant->id, $validatedVariantIds, true)) {
                        $totalRequested = (float) ($requestedByVariant[$variant->id] ?? 0);
                        if ($totalRequested > $availableStock) {
                            throw new \Exception(
                                "Insufficient available stock for {$variant->description}. " .
                                "Available: {$availableStock}, Requested: {$totalRequested}"
                            );
                        }
                        $validatedVariantIds[] = $variant->id;

                        $pendingUnitPrice = $variant->pending_unit_price !== null ? (float) $variant->pending_unit_price : null;
                        $pendingBatchQty = $variant->pending_price_quantity !== null ? (float) $variant->pending_price_quantity : null;
                        $hasPendingBatch = $pendingUnitPrice !== null && $pendingBatchQty !== null && $pendingBatchQty > 0;
                        $oldQtyRemaining = $hasPendingBatch ? max(0, $availableStock - $pendingBatchQty) : INF;

                        $pricingStateByVariant[$variant->id] = [
                            'base_unit_price' => (float) $variant->unit_price,
                            'pending_unit_price' => $pendingUnitPrice,
                            'old_qty_remaining' => $oldQtyRemaining,
                            'has_pending_batch' => $hasPendingBatch,
                        ];
                    }

                    $pricingState = &$pricingStateByVariant[$variant->id];
                    $baseUnitPrice = (float) ($pricingState['base_unit_price'] ?? 0);
                    $pendingUnitPrice = $pricingState['pending_unit_price'] !== null ? (float) $pricingState['pending_unit_price'] : null;
                    $oldQtyRemaining = (float) ($pricingState['old_qty_remaining'] ?? 0);
                    $hasPendingBatch = (bool) ($pricingState['has_pending_batch'] ?? false);

                    $baseQty = $requestedQuantity;
                    $batchQty = 0.0;
                    $manualUnitPrice = array_key_exists('unit_price', $itemData) && $itemData['unit_price'] !== null
                        ? (float) $itemData['unit_price']
                        : null;

                    if ($manualUnitPrice !== null) {
                        $lineTotal = round($manualUnitPrice * $requestedQuantity, 2);
                        $unitPrice = $manualUnitPrice;
                    } else {
                        if ($hasPendingBatch && $pendingUnitPrice !== null) {
                            $baseQty = min($requestedQuantity, $oldQtyRemaining);
                            $batchQty = max(0, $requestedQuantity - $baseQty);
                            $pricingState['old_qty_remaining'] = max(0, $oldQtyRemaining - $baseQty);
                        }

                        $lineTotal = ($baseQty * $baseUnitPrice) + ($batchQty * ($pendingUnitPrice ?? $baseUnitPrice));
                        $lineTotal = round($lineTotal, 2);
                        $unitPrice = $requestedQuantity > 0 ? round($lineTotal / $requestedQuantity, 2) : $baseUnitPrice;
                    }
                    $subtotal += $lineTotal;

                    $saleItems[] = [
                        'variant' => $variant,
                        'quantity' => $requestedQuantity,
                        'unit_price' => $unitPrice,
                        'line_total' => $lineTotal,
                    ];
                    unset($pricingState);
                }

                $total = $subtotal;
                $paymentAmount = $request->payment_amount ?? 0;
                $paymentMethod = $request->payment_method ?? 'cash';

                if ($paymentAmount < 0) {
                    throw new \Exception("Payment amount cannot be negative");
                }

                // Create sale
                $sale = Sale::create([
                    'sale_number' => Sale::generateSaleNumber(),
                    'status' => 'COMPLETED',
                    'payment_status' => 'UNPAID',
                    'is_for_delivery' => $request->boolean('is_for_delivery', false),
                    'delivery_name' => $request->boolean('is_for_delivery', false) ? $request->delivery_name : null,
                    'delivery_address' => $request->boolean('is_for_delivery', false) ? $request->delivery_address : null,
                    'delivery_contact' => $request->boolean('is_for_delivery', false) ? $request->delivery_contact : null,
                    'subtotal' => $subtotal,
                    'total' => $total,
                    'notes' => $request->notes,
                    'cashier_user_id' => $cashier->id,
                ]);

                // Create sale items and update inventory
                foreach ($saleItems as $itemData) {
                    $variant = $itemData['variant'];
                    $quantity = $itemData['quantity'];

                    SaleItem::create([
                        'sale_id' => $sale->id,
                        'product_variant_id' => $variant->id,
                        'quantity' => $quantity,
                        'unit_price' => $itemData['unit_price'],
                        'line_total' => $itemData['line_total'],
                    ]);

                    // Only deduct inventory for non-delivery sales
                    if (!$sale->is_for_delivery) {
                        $currentStock = $variant->inventory->quantity_on_hand ?? 0;
                        $newStock = $currentStock - $quantity;

                        InventoryMovement::create([
                            'product_variant_id' => $variant->id,
                            'quantity' => $quantity,
                            'type' => 'OUT',
                            'reason' => 'sale',
                            'reference_id' => $sale->id,
                            'unit_cost' => null,
                            'notes' => "Sale: {$sale->sale_number}",
                            'recorded_by_user_id' => $cashier->id,
                        ]);

                        Inventory::updateOrCreate(
                            ['product_variant_id' => $variant->id],
                            ['quantity_on_hand' => $newStock]
                        );
                    }
                }

                // Auto-create delivery placeholder if sale is for delivery
                if ($sale->is_for_delivery) {
                    Delivery::create([
                        'sale_id' => $sale->id,
                        'delivered_by_user_id' => null,
                        'delivered_at' => null,
                        'status' => 'pending',
                        'notes' => null,
                    ]);

                    $sale->update(['delivery_status' => 'PENDING']);
                }

                // Create initial payment if amount provided
                if ($paymentAmount > 0) {
                    Payment::create([
                        'sale_id' => $sale->id,
                        'amount' => $paymentAmount,
                        'payment_method' => $paymentMethod,
                        'received_by_user_id' => $cashier->id,
                        'received_at' => now(),
                        'notes' => 'Initial payment at POS checkout',
                    ]);

                    $sale->refresh();
                    $sale->load('payments');
                    $sale->updatePaymentStatus();
                }

                $sale->computeSaleStatus();

                return $sale;
            });

            // Load relationships for response
            $sale->load([
                'items.productVariant.product',
                'cashier',
                'payments.receivedBy',
            ]);

            $totalPaid = $sale->total_paid;
            $saleTotal = $sale->total;
            $balance = max(0, $saleTotal - $totalPaid);
            $change = max(0, $totalPaid - $saleTotal);

            return response()->json([
                'success' => true,
                'message' => 'Sale completed successfully',
                'data' => [
                    'sale' => $sale,
                    'payment_summary' => [
                        'total_paid' => $totalPaid,
                        'balance' => $balance,
                        'change' => $change,
                    ],
                ],
            ]);
        } catch (\Exception $e) {
            throw ValidationException::withMessages([
                'checkout' => [$e->getMessage()],
            ]);
        }
    }

    /**
     * Get remaining reserved quantities for in-progress delivery sales per variant.
     *
     * Reserved qty = sold - delivered - refunded - canceled
     * for sales where delivery is still pending/partial.
     *
     * @param  array<int>  $variantIds
     * @return array<int, float>
     */
    private function reservedDeliveryQuantitiesByVariant(array $variantIds): array
    {
        if (empty($variantIds)) {
            return [];
        }

        $refundSubquery = DB::table('refund_items')
            ->select('sale_item_id', DB::raw('SUM(quantity) as refunded_qty'))
            ->groupBy('sale_item_id');

        return DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->leftJoinSub($refundSubquery, 'refund_totals', function ($join) {
                $join->on('refund_totals.sale_item_id', '=', 'sale_items.id');
            })
            ->whereIn('sale_items.product_variant_id', $variantIds)
            ->where('sales.is_for_delivery', true)
            ->whereIn('sales.delivery_status', ['PENDING', 'PARTIAL'])
            ->where('sales.status', '!=', 'VOIDED')
            ->groupBy('sale_items.product_variant_id')
            ->select(
                'sale_items.product_variant_id',
                DB::raw(
                    'SUM(GREATEST(sale_items.quantity - COALESCE(sale_items.delivered_quantity, 0) - COALESCE(sale_items.canceled_quantity, 0) - COALESCE(refund_totals.refunded_qty, 0), 0)) as reserved_qty'
                )
            )
            ->pluck('reserved_qty', 'sale_items.product_variant_id')
            ->map(fn ($qty) => (float) $qty)
            ->toArray();
    }
}

