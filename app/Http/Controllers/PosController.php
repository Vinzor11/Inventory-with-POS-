<?php

namespace App\Http\Controllers;

use App\Http\Requests\SaleCheckoutRequest;
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
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PosController extends Controller
{
    /**
     * Display the POS interface
     * 
     * Excludes products from "Agricultural Products" category (copra/coconut)
     * to keep them separate from hardware POS operations
     */
    public function index(Request $request): Response
    {
        // Category name to exclude from POS (for copra/coconut products)
        $excludedCategoryName = 'Agricultural Products';

        // Get active categories (exclude agricultural category from POS)
        $categories = ProductCategory::where('is_active', true)
            ->where('name', '!=', $excludedCategoryName)
            ->orderBy('name')
            ->get();

        // Get active products, excluding agricultural category
        // These products are for hardware POS, not copra/coconut business
        $products = Product::where('is_active', true)
            ->whereHas('category', function ($query) use ($excludedCategoryName) {
                $query->where('name', '!=', $excludedCategoryName);
            })
            ->with([
                'category',
                'variants' => function ($query) {
                    $query->orderBy('unit_price', 'asc')
                        ->with('inventory');
                }
            ])
            ->orderBy('name')
            ->get();

        // Filter products by category if requested
        $selectedCategoryId = $request->input('category_id');
        if ($selectedCategoryId) {
            $products = $products->filter(function ($product) use ($selectedCategoryId) {
                return $product->category_id == $selectedCategoryId;
            });
        }

        return Inertia::render('pos', [
            'categories' => $categories,
            'products' => $products->values(),
        ]);
    }

    /**
     * Process POS checkout
     * 
     * Business Rules:
     * 1. Validates cashier PIN
     * 2. Validates stock availability for all items
     * 3. Creates sale + sale_items in transaction
     * 4. Creates inventory_movements (type = OUT, reason = sale)
     * 5. Updates inventory.quantity_on_hand
     * 6. All operations in DB transaction
     */
    public function checkout(SaleCheckoutRequest $request): RedirectResponse
    {
        // Verify PIN - check against all users to find cashier
        // PIN is stored in a separate hashed field, not the password
        $cashier = null;
        $users = User::all();
        
        foreach ($users as $user) {
            // Access the PIN directly from attributes (bypasses hidden attribute)
            $pinHash = $user->getAttributes()['pin'] ?? null;
            
            // Verify the PIN if user has one set
            if ($pinHash && Hash::check($request->pin, $pinHash)) {
                $cashier = $user;
                break;
            }
        }

        if (!$cashier) {
            throw ValidationException::withMessages([
                'pin' => ['Invalid PIN. Please try again.'],
            ]);
        }

        try {
            $sale = DB::transaction(function () use ($request, $cashier) {
                // Validate stock availability for all items
                $items = $request->items;
                $subtotal = 0;
                $saleItems = [];

                foreach ($items as $itemData) {
                    $variant = ProductVariant::with(['inventory', 'product.category'])->findOrFail($itemData['product_variant_id']);
                    
                    // Validate that product is not from Agricultural Products category
                    if ($variant->product->category && $variant->product->category->name === 'Agricultural Products') {
                        throw new \Exception(
                            "Agricultural products (copra/coconut) cannot be sold through the POS. " .
                            "Please use the agricultural sales system instead."
                        );
                    }
                    
                    $currentStock = $variant->inventory->quantity_on_hand ?? 0;
                    $requestedQuantity = $itemData['quantity'];

                    // Validate stock availability
                    if ($requestedQuantity > $currentStock) {
                        throw new \Exception(
                            "Insufficient stock for {$variant->description}. " .
                            "Available: {$currentStock}, Requested: {$requestedQuantity}"
                        );
                    }

                    // Calculate line total
                    $unitPrice = $variant->unit_price;
                    $lineTotal = $requestedQuantity * $unitPrice;
                    $subtotal += $lineTotal;

                    // Prepare sale item data
                    $saleItems[] = [
                        'variant' => $variant,
                        'quantity' => $requestedQuantity,
                        'unit_price' => $unitPrice,
                        'line_total' => $lineTotal,
                    ];
                }

                // Calculate total (subtotal for now, no tax/discounts)
                $total = $subtotal;

                // Get payment amount (if provided)
                $paymentAmount = $request->payment_amount ?? 0;
                $paymentMethod = $request->payment_method ?? 'cash';

                // Allow overpayment (change will be given to customer)
                // Only validate that payment amount is not negative
                if ($paymentAmount < 0) {
                    throw new \Exception("Payment amount cannot be negative");
                }

                // Create sale
                $sale = Sale::create([
                    'sale_number' => Sale::generateSaleNumber(),
                    'status' => 'COMPLETED', // Default to COMPLETED, will be adjusted by computeSaleStatus
                    'payment_status' => 'UNPAID', // Will be updated after payment creation
                    'is_for_delivery' => $request->boolean('is_for_delivery', false),
                    'delivery_name' => $request->boolean('is_for_delivery', false) ? $request->delivery_name : null,
                    'delivery_address' => $request->boolean('is_for_delivery', false) ? $request->delivery_address : null,
                    'delivery_contact' => $request->boolean('is_for_delivery', false) ? $request->delivery_contact : null,
                    'subtotal' => $subtotal,
                    'total' => $total,
                    'notes' => $request->notes,
                    'cashier_user_id' => $cashier->id,
                ]);

                // Create sale items
                // Inventory deduction logic:
                // - For non-delivery sales: deduct inventory immediately
                // - For delivery sales: deduct inventory only when items are delivered
                foreach ($saleItems as $itemData) {
                    $variant = $itemData['variant'];
                    $quantity = $itemData['quantity'];

                    // Create sale item
                    SaleItem::create([
                        'sale_id' => $sale->id,
                        'product_variant_id' => $variant->id,
                        'quantity' => $quantity,
                        'unit_price' => $itemData['unit_price'],
                        'line_total' => $itemData['line_total'],
                    ]);

                    // Only deduct inventory for non-delivery sales (walk-in sales)
                    // For delivery sales, inventory will be deducted when items are actually delivered
                    if (!$sale->is_for_delivery) {
                        $currentStock = $variant->inventory->quantity_on_hand ?? 0;
                        $newStock = $currentStock - $quantity;

                        // Create inventory movement (OUT)
                        InventoryMovement::create([
                            'product_variant_id' => $variant->id,
                            'quantity' => $quantity,
                            'type' => 'OUT',
                            'reason' => 'sale',
                            'reference_id' => $sale->id,
                            'unit_cost' => null, // NULL for OUT movements
                            'notes' => "Sale: {$sale->sale_number}",
                            'recorded_by_user_id' => $cashier->id,
                        ]);

                        // Update inventory quantity
                        Inventory::updateOrCreate(
                            ['product_variant_id' => $variant->id],
                            ['quantity_on_hand' => $newStock]
                        );
                    }
                }

                // Phase 4.5: Auto-create delivery placeholder if sale is for delivery
                // Set delivery_status BEFORE computing sale status so it's considered in status calculation
                if ($sale->is_for_delivery) {
                    Delivery::create([
                        'sale_id' => $sale->id,
                        'delivered_by_user_id' => null, // Will be set when items are delivered
                        'delivered_at' => null, // Will be set when items are delivered
                        'status' => 'pending', // Starts as pending, computed later
                        'notes' => null,
                    ]);
                    
                    // Set sale's delivery_status to PENDING (uppercase)
                    $sale->update(['delivery_status' => 'PENDING']);
                }

                // Create initial payment if amount provided (Phase 3.5)
                if ($paymentAmount > 0) {
                    Payment::create([
                        'sale_id' => $sale->id,
                        'amount' => $paymentAmount,
                        'payment_method' => $paymentMethod,
                        'received_by_user_id' => $cashier->id,
                        'received_at' => now(),
                        'notes' => 'Initial payment at POS checkout',
                    ]);

                    // Refresh sale and update payment status
                    $sale->refresh();
                    $sale->load('payments');
                    $sale->updatePaymentStatus();
                }
                
                // Compute sale_status AFTER delivery_status is set (if applicable)
                // This ensures delivery_status is considered in the status calculation
                $sale->computeSaleStatus();

                return $sale;
            });

            return redirect()->route('pos.checkout.success', ['sale' => $sale->id])
                ->with('success', 'Sale completed successfully.');
        } catch (\Exception $e) {
            throw ValidationException::withMessages([
                'checkout' => [$e->getMessage()],
            ]);
        }
    }

    /**
     * Display checkout success page
     */
    public function checkoutSuccess(Request $request, Sale $sale): Response
    {
        $sale->load([
            'items.productVariant.product',
            'cashier',
            'payments.receivedBy', // Load payments with user who received them
        ]);

        // Calculate payment summary
        $totalPaid = $sale->total_paid;
        $saleTotal = $sale->total;
        $balance = max(0, $saleTotal - $totalPaid); // Balance remaining (if underpaid)
        $change = max(0, $totalPaid - $saleTotal); // Change due (if overpaid)

        return Inertia::render('pos/checkout-success', [
            'sale' => $sale,
            'paymentSummary' => [
                'total_paid' => $totalPaid,
                'balance' => $balance,
                'change' => $change,
            ],
        ]);
    }
}
