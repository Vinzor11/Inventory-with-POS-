<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class SalesController extends Controller
{
    /**
     * Display a listing of sales
     * Shows all sales with pagination
     */
    public function index(Request $request): Response
    {
        $perPage = $request->input('per_page', 15);
        $search = $request->input('search', '');
        $status = $request->input('status', '');
        $paymentStatus = $request->input('payment_status', '');
        $deliveryStatus = $request->input('delivery_status', '');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $query = Sale::with(['cashier', 'items.productVariant.product.category', 'refunds.items', 'deliveries.items'])
            ->withCount('items')
            ->orderBy('created_at', 'desc');

        // Filter by search term (sale number)
        if ($search) {
            $query->where('sale_number', 'like', "%{$search}%");
        }

        // Filter by status
        if ($status && in_array($status, ['OPEN', 'COMPLETED', 'PARTIAL', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED'])) {
            $query->where('status', $status);
        }

        // Filter by payment status
        if ($paymentStatus && in_array($paymentStatus, ['UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REVERSED'])) {
            $query->where('payment_status', $paymentStatus);
        }

        // Filter by delivery status
        if ($deliveryStatus) {
            if ($deliveryStatus === 'WALK_IN') {
                // Filter for sales that are not for delivery
                $query->where('is_for_delivery', false);
            } elseif (in_array($deliveryStatus, ['PENDING', 'PARTIAL', 'DELIVERED', 'RETURNED', 'CANCELED'])) {
                // Filter for sales with specific delivery status
                $query->where('is_for_delivery', true)
                      ->where('delivery_status', $deliveryStatus);
            }
        }

        // Filter by date range
        if ($dateFrom) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $sales = $query->paginate($perPage)->withQueryString();

        // Calculate remaining delivery quantities for each sale
        $sales->getCollection()->transform(function ($sale) {
            if (!$sale->is_for_delivery) {
                $sale->has_remaining_delivery = false;
                return $sale;
            }

            // Calculate refunded quantities per sale item
            $refundedQuantities = [];
            foreach ($sale->refunds as $refund) {
                foreach ($refund->items as $refundItem) {
                    $saleItemId = $refundItem->sale_item_id;
                    $refundedQuantities[$saleItemId] = ($refundedQuantities[$saleItemId] ?? 0) + $refundItem->quantity;
                }
            }

            // Check if there are any remaining items to deliver
            // Remaining = quantity - delivered - refunded - canceled
            // Use delivered_quantity from sale_items (source of truth) instead of summing delivery items
            // Exclude items with item_status = 'CANCELED' even if they have remaining quantity
            $hasRemaining = false;
            foreach ($sale->items as $saleItem) {
                // Skip items that are fully canceled (item_status = 'CANCELED')
                $itemStatus = $saleItem->item_status ?? 'ACTIVE';
                if ($itemStatus === 'CANCELED') {
                    continue; // Skip canceled items entirely
                }
                
                $refundedQty = $refundedQuantities[$saleItem->id] ?? 0;
                // Use delivered_quantity from sale_items table (already sums all deliveries)
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

        // Get users for delivery assignment
        $users = \App\Models\User::orderBy('name')->get(['id', 'name', 'email']);

        return Inertia::render('sales/index', [
            'sales' => $sales,
            'users' => $users,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'payment_status' => $paymentStatus,
                'delivery_status' => $deliveryStatus,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
        ]);
    }

    /**
     * Display the specified sale
     */
    public function show(Sale $sale): Response
    {
        // Refresh sale to ensure payments relationship is up-to-date
        $sale->refresh();
        
        // Load relationships AFTER refresh (refresh clears loaded relationships)
        $sale->load([
            'cashier',
            'voidedBy', // Load user who voided the sale (if voided)
            'items.productVariant.product.category',
            'payments.receivedBy', // Load payments with user who received them
            'refunds.processedBy', // Load refunds with user who processed them
        ]);

        // Calculate payment summary
        // For VOIDED sales: all values are 0
        if ($sale->status === 'VOIDED') {
            $totalPaid = 0;
            $totalRefunded = 0;
            $netTotal = 0;
            $balance = 0;
            $change = 0;
        } else {
            // total_paid includes refunds (negative payments), so it reflects current amount after refunds
            $totalPaid = $sale->total_paid;
            $totalRefunded = $sale->total_refunded;
            $netTotal = $sale->net_total; // Total after refunds
            $balance = max(0, $netTotal - $totalPaid); // Balance remaining (if underpaid, based on net total)
            $change = max(0, $totalPaid - $netTotal); // Change due (if overpaid, based on net total)
        }

        return Inertia::render('sales/show', [
            'sale' => $sale,
            'paymentSummary' => [
                'total_paid' => $totalPaid,
                'total_refunded' => $totalRefunded,
                'net_total' => $netTotal, // Total after refunds
                'balance' => $balance,
                'change' => $change,
            ],
        ]);
    }

    /**
     * Void a sale (Admin/Manager only)
     * 
     * VOID BUSINESS RULES:
     * 
     * WHEN a sale CAN be voided:
     * - No delivery occurred: SUM(delivered_quantity) = 0
     * - No refunds exist: refund_total = 0
     * - Sale is not already VOIDED: sale_status != VOIDED
     * - Sale is not REFUNDED or PARTIALLY_REFUNDED
     * - User is authorized: Admin or Manager role only
     * 
     * WHEN a sale CANNOT be voided:
     * - Any item has delivered_quantity > 0
     * - Any refund record exists
     * - Sale is REFUNDED or PARTIALLY_REFUNDED
     * - Sale is already VOIDED
     * 
     * VOID SIDE EFFECTS:
     * - Sale: sale_status = VOIDED
     * - Payment: Reverse all payments (status = REVERSED, payment_status = REVERSED)
     * - Inventory: No inventory changes (inventory deducted only on delivery, delivery never occurred)
     * - Delivery: delivery_status = CANCELED
     * - Totals: total_amount = 0.00, balance_due = 0.00
     * - Audit: Record voided_by, voided_at, void_reason
     * 
     * VOIDED sales are immutable and cannot be modified, refunded, or delivered.
     */
    public function void(Request $request, Sale $sale): RedirectResponse
    {
        $request->validate([
            'void_reason' => 'nullable|string|max:1000',
        ]);

        // Authorization: Use policy to check permissions
        $this->authorize('void', $sale);
        
        $user = $request->user();

        try {
            DB::transaction(function () use ($sale, $request, $user) {
                // Load necessary relationships
                $sale->load(['items', 'payments', 'refunds']);

                // VALIDATION: Check if sale CAN be voided
                
                // Rule 1: Check if sale is already VOIDED
                if ($sale->status === 'VOIDED') {
                    throw new \Exception('This sale is already voided.');
                }

                // Rule 2: Check if sale is REFUNDED or PARTIALLY_REFUNDED
                if ($sale->status === 'REFUNDED' || $sale->status === 'PARTIALLY_REFUNDED') {
                    throw new \Exception('Cannot void a sale that has been refunded or partially refunded.');
                }

                // Rule 3: Check if any delivery occurred (SUM(delivered_quantity) = 0)
                $totalDelivered = $sale->items->sum('delivered_quantity') ?? 0;
                if ($totalDelivered > 0) {
                    throw new \Exception('Cannot void a sale with delivered items. Total delivered quantity: ' . $totalDelivered);
                }

                // Rule 4: Check if any refunds exist (refund_total = 0)
                $totalRefunded = $sale->refunds()->sum('refund_amount') ?? 0;
                if ($totalRefunded > 0) {
                    throw new \Exception('Cannot void a sale with refunds. Total refunded amount: $' . number_format($totalRefunded, 2));
                }

                // All validation passed - proceed with void

                // SIDE EFFECT 1: Reverse all payments
                foreach ($sale->payments as $payment) {
                    $payment->update([
                        'status' => 'REVERSED',
                    ]);
                }

                // SIDE EFFECT 2: Update sale
                $sale->update([
                    'status' => 'VOIDED',
                    'payment_status' => 'REVERSED',
                    'delivery_status' => $sale->is_for_delivery ? 'CANCELED' : null,
                    'total' => 0.00,
                    'subtotal' => 0.00,
                    'voided_by_user_id' => $user->id,
                    'voided_at' => now(),
                    'void_reason' => $request->void_reason,
                ]);

                // SIDE EFFECT 3: Restore inventory for walk-in sales (non-delivery)
                // For walk-in sales: inventory was deducted at checkout, so restore it
                // For delivery sales: inventory is deducted only on delivery, and delivery never occurred, so nothing to restore
                if (!$sale->is_for_delivery) {
                    // Load sale items with variants and inventory
                    $sale->load('items.productVariant.inventory');
                    
                    foreach ($sale->items as $item) {
                        $variant = $item->productVariant;
                        $quantityToRestore = $item->quantity; // Restore full quantity for walk-in sales
                        
                        if ($quantityToRestore <= 0) {
                            continue;
                        }
                        
                        $currentStock = $variant->inventory->quantity_on_hand ?? 0;
                        $newStock = $currentStock + $quantityToRestore;
                        
                        // Create inventory movement (IN) for void
                        \App\Models\InventoryMovement::create([
                            'product_variant_id' => $variant->id,
                            'quantity' => $quantityToRestore,
                            'type' => 'IN',
                            'reason' => 'sale_void',
                            'reference_id' => $sale->id,
                            'unit_cost' => null,
                            'notes' => "Voided walk-in sale: {$sale->sale_number}",
                            'recorded_by_user_id' => $user->id,
                        ]);
                        
                        // Update inventory quantity back
                        \App\Models\Inventory::updateOrCreate(
                            ['product_variant_id' => $variant->id],
                            ['quantity_on_hand' => $newStock]
                        );
                    }
                }

                // AUDIT TRAIL: Log the void action
                Log::info('Sale voided', [
                    'sale_id' => $sale->id,
                    'sale_number' => $sale->sale_number,
                    'voided_by' => $user->id,
                    'void_reason' => $request->void_reason,
                    'voided_at' => now(),
                ]);
            });

            return redirect()->route('sales.show', $sale)
                ->with('success', 'Sale voided successfully. All payments have been reversed.');
        } catch (\Exception $e) {
            return redirect()->back()
                ->withErrors(['error' => $e->getMessage()])
                ->withInput();
        }
    }

    /**
     * Cancel a sale item (Sale Adjustment) - Supports Partial Cancellation
     * 
     * Business Rules:
     * 1. Can cancel only undelivered quantity (quantity - delivered - already canceled)
     * 2. Update canceled_quantity on sale_item
     * 3. Update item_status: CANCELED (if all canceled), PARTIAL_ADJUSTED (if partial), or ACTIVE
     * 4. Recalculate sale total (remove canceled quantity's proportional amount)
     * 5. Recalculate balance_due = total_amount - paid_amount
     * 6. Update payment_status if paid_amount == adjusted_total_amount → FULLY_PAID
     * 7. Update sale status: COMPLETED if no balance due and no deliverable items
     * 8. Update delivery status: PARTIAL if some items delivered, some canceled
     * 9. Create audit trail record with canceled_quantity
     * 10. Do NOT restore inventory
     * 11. Do NOT create refund records
     * 
     * @param Request $request
     * @param Sale $sale
     * @return RedirectResponse
     */
    public function cancelItem(Request $request, Sale $sale): RedirectResponse
    {
        $request->validate([
            'sale_item_id' => 'required|exists:sale_items,id',
            'quantity_to_cancel' => 'nullable|numeric|min:0.01',
            'reason' => 'nullable|string|max:500',
        ]);

        try {
            DB::transaction(function () use ($request, $sale) {
                // Load the sale item
                $saleItem = $sale->items()->findOrFail($request->sale_item_id);
                
                // Validate item can be canceled
                if (!$saleItem->canBeCanceled()) {
                    throw new \Exception('Item cannot be canceled. No undelivered quantity available.');
                }
                
                // Determine quantity to cancel
                // If not specified, cancel all remaining undelivered quantity
                $quantityToCancel = $request->quantity_to_cancel ?? $saleItem->max_cancelable_quantity;
                
                // Cancel the item (creates adjustment record)
                $saleItem->cancel($quantityToCancel, $request->user()->id, $request->reason);
                
                // Adjust the sale (recalculate totals, statuses)
                $sale->adjustSale();
            });

            $quantityCanceled = $request->quantity_to_cancel ?? 'all remaining';
            return redirect()->route('sales.show', $sale)
                ->with('success', "Item canceled successfully ({$quantityCanceled} units). Sale has been adjusted.");
        } catch (\Exception $e) {
            return redirect()->back()
                ->with('error', 'Failed to cancel item: ' . $e->getMessage());
        }
    }
}

