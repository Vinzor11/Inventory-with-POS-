<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDeliveryRequest;
use App\Models\Delivery;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DeliveriesController extends Controller
{
    /**
     * Display a listing of deliveries grouped by sale
     * Each sale with deliveries shows as a single record
     */
    public function index(Request $request): Response
    {
        $perPage = $request->integer('per_page', 15);

        // Get sales that have deliveries
        $salesQuery = Sale::query()
            ->whereHas('deliveries')
            ->where('is_for_delivery', true)
            ->when($request->search, function ($query, $search) {
                $query->where('sale_number', 'like', "%{$search}%");
            })
            ->when($request->status, function ($query, $status) {
                // Map lowercase status to uppercase for database
                $statusMap = [
                    'pending' => 'PENDING',
                    'partial' => 'PARTIAL',
                    'delivered' => 'DELIVERED',
                    'canceled' => 'CANCELED',
                    'returned' => 'RETURNED',
                ];
                $dbStatus = $statusMap[$status] ?? $status;
                $query->where('delivery_status', $dbStatus);
            })
            ->with(['deliveries' => function ($q) {
                $q->with(['deliveredBy', 'items.productVariant.product'])
                  ->orderBy('created_at', 'desc');
            }])
            ->orderBy('created_at', 'desc');

        $sales = $salesQuery->paginate($perPage)->withQueryString();

        // Transform sales to include combined delivery information
        $salesData = $sales->getCollection()->map(function ($sale) {
            // Filter out empty deliveries (those with no items)
            $deliveries = $sale->deliveries->filter(function ($delivery) {
                return $delivery->items->count() > 0;
            });
            
            // Get the most recent delivery date
            $latestDelivery = $deliveries->sortByDesc('delivered_at')->first();
            
            // Get the sale's delivery status (from sale table, not individual delivery)
            $deliveryStatus = $sale->delivery_status ?? 'PENDING';
            
            // Convert to lowercase for display
            $statusMap = [
                'PENDING' => 'pending',
                'PARTIAL' => 'partial',
                'DELIVERED' => 'delivered',
                'CANCELED' => 'canceled',
                'RETURNED' => 'returned',
            ];
            $displayStatus = $statusMap[$deliveryStatus] ?? 'pending';
            
            // Count total items across all deliveries (only those with items)
            $totalItems = $deliveries->sum(function ($delivery) {
                return $delivery->items->count();
            });
            
            // Get most recent delivered by (from latest delivery)
            $deliveredBy = $latestDelivery?->deliveredBy;
            
            return [
                'id' => $sale->id,
                'sale_number' => $sale->sale_number,
                'delivery_status' => $displayStatus,
                'delivered_at' => $latestDelivery?->delivered_at,
                'delivered_by' => $deliveredBy,
                'total_items' => $totalItems,
                'delivery_count' => $deliveries->count(), // Only count deliveries with items
                'latest_delivery_id' => $latestDelivery?->id, // Include latest delivery ID for receipt printing
            ];
        });

        // Create a custom paginator response
        $paginatedSales = new \Illuminate\Pagination\LengthAwarePaginator(
            $salesData,
            $sales->total(),
            $sales->perPage(),
            $sales->currentPage(),
            ['path' => $request->url(), 'query' => $request->query()]
        );

        return Inertia::render('deliveries/index', [
            'deliveries' => $paginatedSales,
            'filters' => $request->only(['search', 'status', 'per_page']),
        ]);
    }

    /**
     * Show the form for creating a new delivery
     */
    public function create(Request $request): Response
    {
        $sales = Sale::orderBy('sale_number', 'desc')->get();
        $users = User::orderBy('name')->get();
        $products = \App\Models\Product::where('is_active', true)
            ->with(['category', 'variants'])
            ->orderBy('name')
            ->get()
            ->map(function ($product) {
                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'category' => $product->category ? [
                        'id' => $product->category->id,
                        'name' => $product->category->name,
                    ] : null,
                    'variants' => $product->variants->map(function ($variant) {
                        return [
                            'id' => $variant->id,
                            'description' => $variant->description,
                            'unit_price' => $variant->unit_price,
                        ];
                    })->toArray(),
                ];
            })
            ->toArray();

        return Inertia::render('deliveries/create', [
            'sales' => $sales,
            'users' => $users,
            'products' => $products,
            'preselectedSaleId' => $request->input('sale_id'),
        ]);
    }

    /**
     * Store a newly created delivery
     * Note: Deliveries do NOT affect inventory
     */
    public function store(StoreDeliveryRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $items = $data['items'];
        unset($data['items']);

        $delivery = Delivery::create($data);

        // Create delivery items
        foreach ($items as $item) {
            $delivery->items()->create([
                'product_variant_id' => $item['product_variant_id'],
                'quantity' => $item['quantity'],
            ]);
        }
        
        // Compute delivery status and update sale's delivery_status
        $delivery->refresh();
        $delivery->computeStatus();

        return redirect()->route('deliveries.index')
                        ->with('success', 'Delivery created successfully.');
    }

    /**
     * Display the specified delivery
     */
    public function show(Delivery $delivery): Response
    {
        $delivery->load(['sale', 'deliveredBy', 'items.productVariant.product']);

        return Inertia::render('deliveries/show', [
            'delivery' => $delivery,
        ]);
    }

    /**
     * Show delivery page for a specific sale (Phase 4.5)
     * Shows all deliveries for the sale and allows creating new ones
     */
    public function forSale(Sale $sale): Response
    {
        // Load sale with items, refunds, and refund items
        $sale->load(['items.productVariant.product.category', 'cashier', 'refunds.items', 'deliveries.items.productVariant.product', 'deliveries.deliveredBy']);
        
        // Ensure sale's delivery_status is set if it's null
        if ($sale->delivery_status === null && $sale->is_for_delivery) {
            $sale->update(['delivery_status' => 'PENDING']);
        }
        
        // Get users for delivery assignment
        $users = User::orderBy('name')->get(['id', 'name', 'email']);
        
        // Calculate refunded quantities per sale item
        $refundedQuantities = [];
        foreach ($sale->refunds as $refund) {
            foreach ($refund->items as $refundItem) {
                $saleItemId = $refundItem->sale_item_id;
                $refundedQuantities[$saleItemId] = ($refundedQuantities[$saleItemId] ?? 0) + $refundItem->quantity;
            }
        }
        
        // Calculate delivered quantities per product variant from ALL deliveries
        $deliveredQuantities = [];
        foreach ($sale->deliveries as $delivery) {
            foreach ($delivery->items as $deliveryItem) {
                $variantId = $deliveryItem->product_variant_id;
                $deliveredQuantities[$variantId] = ($deliveredQuantities[$variantId] ?? 0) + $deliveryItem->quantity;
            }
        }
        
        // Prepare sale items with remaining quantities (accounting for refunds and cancellations)
        $saleItemsWithRemaining = $sale->items->map(function ($saleItem) use ($deliveredQuantities, $refundedQuantities) {
            $variantId = $saleItem->product_variant_id;
            $soldQty = $saleItem->quantity;
            $deliveredQty = $deliveredQuantities[$variantId] ?? 0;
            $refundedQty = $refundedQuantities[$saleItem->id] ?? 0;
            $canceledQty = $saleItem->canceled_quantity ?? 0;
            // Remaining quantity = sold - delivered - refunded - canceled (but can't be negative)
            $remainingQty = max(0, $soldQty - $deliveredQty - $refundedQty - $canceledQty);

            // Handle missing product variant data safely
            $productVariant = $saleItem->productVariant;
            $product = $productVariant?->product;
            $category = $product?->category;

            return [
                'id' => $saleItem->id,
                'product_variant_id' => $variantId,
                'quantity' => $soldQty,
                'unit_price' => $saleItem->unit_price,
                'line_total' => $saleItem->line_total,
                'delivered_quantity' => $deliveredQty,
                'refunded_quantity' => $refundedQty,
                'canceled_quantity' => $canceledQty,
                'item_status' => $saleItem->item_status ?? 'ACTIVE',
                'remaining_quantity' => $remainingQty,
                'product_variant' => $productVariant ? [
                    'id' => $productVariant->id,
                    'description' => $productVariant->description ?? 'N/A',
                    'product' => $product ? [
                        'id' => $product->id,
                        'name' => $product->name ?? 'N/A',
                        'category' => $category ? [
                            'id' => $category->id,
                            'name' => $category->name ?? 'N/A',
                        ] : null,
                    ] : null,
                ] : null,
            ];
        });
        
        // Refresh sale to get updated delivery_status
        $sale->refresh();
        
        // Load deliveries with items, ordered by newest first, and filter out empty deliveries
        $deliveries = $sale->deliveries()
            ->with(['items.productVariant.product', 'deliveredBy'])
            ->has('items') // Only get deliveries that have at least one item
            ->orderBy('created_at', 'desc')
            ->get();
        
        return Inertia::render('deliveries/for-sale', [
            'sale' => $sale,
            'deliveries' => $deliveries,
            'saleItems' => $saleItemsWithRemaining,
            'users' => $users,
        ]);
    }

    /**
     * Add delivery items - creates a new delivery record for each partial delivery (Phase 4.5)
     * Validates remaining quantities and updates delivery status
     * Each partial delivery creates a separate delivery record
     */
    public function addItems(Request $request, Sale $sale): RedirectResponse
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_variant_id' => 'required|exists:product_variants,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'delivered_by_user_id' => 'required|exists:users,id',
            'delivered_at' => 'required|date',
            'notes' => 'nullable|string|max:1000',
        ]);
        
        try {
            DB::transaction(function () use ($request, $sale) {
                // Load sale items to validate quantities
                $sale->load('items', 'deliveries.items');
                $saleItems = $sale->items;
                
                // Calculate already delivered quantities from ALL deliveries for this sale
                $deliveredQuantities = [];
                foreach ($sale->deliveries as $del) {
                    foreach ($del->items as $item) {
                        $variantId = $item->product_variant_id;
                        $deliveredQuantities[$variantId] = ($deliveredQuantities[$variantId] ?? 0) + $item->quantity;
                    }
                }
                
                // Create a NEW delivery record for this partial delivery
                $delivery = Delivery::create([
                    'sale_id' => $sale->id,
                    'delivered_by_user_id' => $request->delivered_by_user_id,
                    'delivered_at' => $request->delivered_at,
                    'status' => 'pending',
                    'notes' => $request->notes,
                ]);
                
                // Validate and create delivery items
                foreach ($request->items as $itemData) {
                    $variantId = $itemData['product_variant_id'];
                    $requestedQty = $itemData['quantity'];
                    
                    // Find corresponding sale item
                    $saleItem = $saleItems->firstWhere('product_variant_id', $variantId);
                    if (!$saleItem) {
                        throw new \Exception("Product variant {$variantId} not found in sale");
                    }
                    
                    $soldQty = $saleItem->quantity;
                    $alreadyDelivered = $deliveredQuantities[$variantId] ?? 0;
                    $canceledQty = $saleItem->canceled_quantity ?? 0;
                    // Remaining quantity = sold - delivered - canceled
                    $remainingQty = $soldQty - $alreadyDelivered - $canceledQty;
                    
                    // Validate quantity doesn't exceed remaining
                    if ($requestedQty > $remainingQty) {
                        throw new \Exception(
                            "Delivery quantity ({$requestedQty}) exceeds remaining quantity ({$remainingQty}) for variant {$variantId}"
                        );
                    }
                    
                    // Create delivery item
                    $delivery->items()->create([
                        'product_variant_id' => $variantId,
                        'quantity' => $requestedQty,
                    ]);
                    
                    // Update delivered_quantity on sale_item (sum of all deliveries for this variant)
                    $newDeliveredQty = $alreadyDelivered + $requestedQty;
                    $saleItem->update(['delivered_quantity' => $newDeliveredQty]);
                    
                    // Deduct inventory when items are delivered
                    // Load variant with inventory
                    $variant = \App\Models\ProductVariant::with('inventory')->findOrFail($variantId);
                    $currentStock = $variant->inventory->quantity_on_hand ?? 0;
                    $newStock = $currentStock - $requestedQty;
                    
                    // Validate stock availability
                    if ($newStock < 0) {
                        throw new \Exception(
                            "Insufficient stock for delivery. Available: {$currentStock}, Requested: {$requestedQty}"
                        );
                    }
                    
                    // Create inventory movement (OUT) for delivery
                    InventoryMovement::create([
                        'product_variant_id' => $variantId,
                        'quantity' => $requestedQty,
                        'type' => 'OUT',
                        'reason' => 'delivery',
                        'reference_id' => $sale->id,
                        'unit_cost' => null,
                        'notes' => "Delivery for sale: {$sale->sale_number}",
                        'recorded_by_user_id' => $request->delivered_by_user_id,
                    ]);
                    
                    // Update inventory quantity
                    Inventory::updateOrCreate(
                        ['product_variant_id' => $variantId],
                        ['quantity_on_hand' => $newStock]
                    );
                }
                
                // Reload delivery with items to ensure they're available
                $delivery->load('items');
                
                // Recompute delivery status for the new delivery
                $delivery->computeStatus();
            });
            
                return redirect()->route('deliveries.for-sale', $sale->id);
        } catch (\Exception $e) {
            return redirect()->back()
                ->withErrors(['error' => $e->getMessage()])
                ->withInput();
        }
    }
}
