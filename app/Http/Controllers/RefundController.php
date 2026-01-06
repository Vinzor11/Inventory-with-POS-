<?php

namespace App\Http\Controllers;

use App\Models\Refund;
use App\Models\RefundItem;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Payment;
use App\Models\InventoryMovement;
use App\Models\Inventory;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class RefundController extends Controller
{
    /**
     * Display the refund page for a sale
     * 
     * Business Rules:
     * - Only Admin/Manager can access
     * - Sale must be eligible for refund
     * - Shows sale items with refundable quantities
     */
    public function show(Request $request, Sale $sale): Response|RedirectResponse
    {
        // Authorization: Only Admin/Manager
        if (!$request->user()?->hasRole('admin')) {
            abort(403, 'Only administrators can process refunds.');
        }

        // Check eligibility
        if (!$sale->isEligibleForRefund()) {
            return redirect()->route('sales.show', $sale)
                ->with('error', 'This sale is not eligible for refund.');
        }

        // Refresh sale to ensure we have the latest total (after any cancellations)
        $sale->refresh();
        
        // Load sale with all necessary relationships
        $sale->load([
            'items.productVariant.product.category',
            'items.productVariant.inventory',
            'refunds.items.saleItem.productVariant',
            'cashier',
        ]);
        
        // Ensure sale total is up-to-date after any cancellations
        // Recalculate if there are canceled items but total might not reflect it
        $hasCanceledItems = $sale->items()->where('canceled_quantity', '>', 0)->exists();
        if ($hasCanceledItems) {
            // Recalculate to ensure total is correct
            $sale->adjustSale();
            $sale->refresh(); // Refresh to get updated total
        }

        // Calculate already refunded quantities per item
        $refundedQuantities = [];
        foreach ($sale->refunds as $refund) {
            foreach ($refund->items as $refundItem) {
                $saleItemId = $refundItem->sale_item_id;
                $refundedQuantities[$saleItemId] = ($refundedQuantities[$saleItemId] ?? 0) + $refundItem->quantity;
            }
        }

        // Prepare sale items with refundable quantities
        // Refundable = quantity - refunded - canceled
        // Items with item_status = 'CANCELED' cannot be refunded
        $saleItemsWithRefundable = $sale->items->map(function ($saleItem) use ($refundedQuantities) {
            $refundedQty = $refundedQuantities[$saleItem->id] ?? 0;
            $canceledQty = $saleItem->canceled_quantity ?? 0;
            $itemStatus = $saleItem->item_status ?? 'ACTIVE';
            
            // Items with status CANCELED cannot be refunded
            if ($itemStatus === 'CANCELED') {
                $refundableQty = 0;
            } else {
                // Refundable = quantity - refunded - canceled
                $refundableQty = max(0, $saleItem->quantity - $refundedQty - $canceledQty);
            }
            
            return [
                'id' => $saleItem->id,
                'product_variant_id' => $saleItem->product_variant_id,
                'quantity' => $saleItem->quantity,
                'unit_price' => $saleItem->unit_price,
                'line_total' => $saleItem->line_total,
                'refunded_quantity' => $refundedQty,
                'canceled_quantity' => $canceledQty,
                'item_status' => $itemStatus,
                'refundable_quantity' => $refundableQty,
                'product_variant' => [
                    'id' => $saleItem->productVariant->id,
                    'description' => $saleItem->productVariant->description,
                    'product' => [
                        'id' => $saleItem->productVariant->product->id,
                        'name' => $saleItem->productVariant->product->name,
                        'category' => [
                            'id' => $saleItem->productVariant->product->category->id,
                            'name' => $saleItem->productVariant->product->category->name,
                        ],
                    ],
                ],
            ];
        });

        $totalRefunded = $sale->total_refunded;
        $remainingRefundable = $sale->remaining_refundable;

        return Inertia::render('refunds/show', [
            'sale' => $sale,
            'saleItems' => $saleItemsWithRefundable,
            'totalRefunded' => $totalRefunded,
            'remainingRefundable' => $remainingRefundable,
        ]);
    }

    /**
     * Process a refund (full or partial)
     * 
     * Business Rules:
     * - Only Admin/Manager can process
     * - Validates refund amount doesn't exceed remaining refundable
     * - Creates refund and refund_items records
     * - Restores inventory only for returned items
     * - Creates negative payment record
     * - Updates sale statuses
     * - All operations in DB transaction
     */
    public function store(Request $request, Sale $sale): RedirectResponse
    {
        // Authorization: Only Admin/Manager
        if (!$request->user()?->hasRole('admin')) {
            abort(403, 'Only administrators can process refunds.');
        }

        // Validate request
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.sale_item_id' => 'required|exists:sale_items,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.restore_inventory' => 'boolean',
            'reason' => 'nullable|string|max:1000',
        ]);

        // Check eligibility
        if (!$sale->isEligibleForRefund()) {
            return redirect()->back()
                ->withErrors(['refund' => 'This sale is not eligible for refund.'])
                ->withInput();
        }

        try {
            DB::transaction(function () use ($request, $sale) {
                // Load sale items
                $sale->load('items.productVariant.inventory');
                
                // Calculate already refunded quantities
                $refundedQuantities = [];
                foreach ($sale->refunds as $refund) {
                    foreach ($refund->items as $refundItem) {
                        $saleItemId = $refundItem->sale_item_id;
                        $refundedQuantities[$saleItemId] = ($refundedQuantities[$saleItemId] ?? 0) + $refundItem->quantity;
                    }
                }

                $refundItems = [];
                $totalRefundAmount = 0;

                // Validate and prepare refund items
                foreach ($request->items as $itemData) {
                    $saleItem = $sale->items->firstWhere('id', $itemData['sale_item_id']);
                    if (!$saleItem) {
                        throw new \Exception("Sale item {$itemData['sale_item_id']} not found in sale.");
                    }

                    // Check if item is canceled - canceled items cannot be refunded
                    $itemStatus = $saleItem->item_status ?? 'ACTIVE';
                    if ($itemStatus === 'CANCELED') {
                        throw new \Exception(
                            "Cannot refund canceled item (Sale Item ID: {$saleItem->id}). Canceled items are not eligible for refund."
                        );
                    }

                    $refundedQty = $refundedQuantities[$saleItem->id] ?? 0;
                    $canceledQty = $saleItem->canceled_quantity ?? 0;
                    // Refundable = quantity - refunded - canceled
                    $refundableQty = $saleItem->quantity - $refundedQty - $canceledQty;
                    $requestedQty = $itemData['quantity'];

                    // Validate quantity
                    if ($requestedQty > $refundableQty) {
                        throw new \Exception(
                            "Refund quantity ({$requestedQty}) exceeds refundable quantity ({$refundableQty}) for item {$saleItem->id}"
                        );
                    }

                    // Calculate refund amount for this item (proportional to line total)
                    $itemRefundAmount = ($requestedQty / $saleItem->quantity) * $saleItem->line_total;
                    $totalRefundAmount += $itemRefundAmount;

                    $refundItems[] = [
                        'sale_item' => $saleItem,
                        'quantity' => $requestedQty,
                        'amount' => $itemRefundAmount,
                        'restore_inventory' => $itemData['restore_inventory'] ?? true,
                    ];
                }

                // Validate total refund amount
                $remainingRefundable = $sale->remaining_refundable;
                if ($totalRefundAmount > $remainingRefundable) {
                    throw new \Exception(
                        "Refund amount (${$totalRefundAmount}) exceeds remaining refundable amount (${$remainingRefundable})"
                    );
                }

                // Determine refund type
                $isFullRefund = $totalRefundAmount >= $remainingRefundable;

                // Create refund record
                $refund = Refund::create([
                    'sale_id' => $sale->id,
                    'refund_amount' => $totalRefundAmount,
                    'reason' => $request->reason,
                    'processed_by_user_id' => auth()->id(),
                    'type' => $isFullRefund ? 'full' : 'partial',
                ]);

                // Create refund items and restore inventory
                foreach ($refundItems as $itemData) {
                    $saleItem = $itemData['sale_item'];
                    $variant = $saleItem->productVariant;

                    // Create refund item
                    RefundItem::create([
                        'refund_id' => $refund->id,
                        'sale_item_id' => $saleItem->id,
                        'product_variant_id' => $variant->id,
                        'quantity' => $itemData['quantity'],
                        'amount' => $itemData['amount'],
                        'restore_inventory' => $itemData['restore_inventory'],
                    ]);

                    // Restore inventory if requested
                    if ($itemData['restore_inventory']) {
                        $currentStock = $variant->inventory->quantity_on_hand ?? 0;
                        $newStock = $currentStock + $itemData['quantity'];

                        // Create inventory movement (IN)
                        InventoryMovement::create([
                            'product_variant_id' => $variant->id,
                            'quantity' => $itemData['quantity'],
                            'type' => 'IN',
                            'reason' => 'refund',
                            'reference_id' => $sale->id,
                            'unit_cost' => null,
                            'notes' => "Refund for sale: {$sale->sale_number}",
                            'recorded_by_user_id' => auth()->id(),
                        ]);

                        // Update inventory quantity
                        Inventory::updateOrCreate(
                            ['product_variant_id' => $variant->id],
                            ['quantity_on_hand' => $newStock]
                        );
                    }
                }

                // Create negative payment record (refund)
                Payment::create([
                    'sale_id' => $sale->id,
                    'amount' => -$totalRefundAmount, // Negative amount for refund
                    'payment_method' => $request->payment_method ?? 'cash',
                    'received_by_user_id' => auth()->id(),
                    'received_at' => now(),
                    'notes' => "Refund: {$request->reason}",
                ]);

                // Update sale statuses
                $sale->refresh();
                $sale->load('payments', 'refunds');
                $sale->updatePaymentStatus();
                // Compute sale status (will set to REFUNDED or PARTIALLY_REFUNDED)
                $sale->computeSaleStatus();

                // Recompute delivery status if applicable (accounts for refunded items)
                if ($sale->is_for_delivery) {
                    $sale->load('deliveries');
                    foreach ($sale->deliveries as $delivery) {
                        // Recompute delivery status based on remaining items (after refunds)
                        $delivery->computeStatus();
                    }
                    // Refresh sale to get updated delivery_status
                    $sale->refresh();
                }
            });

            return redirect()->route('sales.show', $sale)
                ->with('success', 'Refund processed successfully.');
        } catch (\Exception $e) {
            return redirect()->back()
                ->withErrors(['refund' => $e->getMessage()])
                ->withInput();
        }
    }

    /**
     * Display refund history (Admin only)
     */
    public function index(Request $request): Response
    {
        // Authorization: Only Admin/Manager
        if (!$request->user()?->hasRole('admin')) {
            abort(403, 'Only administrators can view refund history.');
        }

        $perPage = $request->integer('per_page', 15);
        $search = $request->input('search', '');

        $query = Refund::with(['sale', 'processedBy', 'items.saleItem.productVariant.product'])
            ->orderBy('created_at', 'desc');

        // Filter by search term (sale number)
        if ($search) {
            $query->whereHas('sale', function ($q) use ($search) {
                $q->where('sale_number', 'like', "%{$search}%");
            });
        }

        $refunds = $query->paginate($perPage)->withQueryString();

        return Inertia::render('refunds/index', [
            'refunds' => $refunds,
            'filters' => [
                'search' => $search,
                'per_page' => $perPage,
            ],
        ]);
    }
}
