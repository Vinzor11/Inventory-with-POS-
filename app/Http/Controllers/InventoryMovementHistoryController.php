<?php

namespace App\Http\Controllers;

use App\Models\InventoryMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class InventoryMovementHistoryController extends Controller
{
    /**
     * Display inventory movement history
     * Read-only view with filters for audit trail
     * 
     * Filters:
     * - product (by product name)
     * - date range
     * - reason
     * - type (IN/OUT)
     */
    public function index(Request $request): Response
    {
        try {
            $perPage = $request->integer('per_page', 20);

            $movements = InventoryMovement::query()
                ->with([
                    'productVariant.product.category',
                    'product:id,name',
                    'recordedBy:id,name,email'
                ])
                ->when($request->search, function ($query, $search) {
                    $query->whereHas('productVariant.product', function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%")
                          ->orWhere('brand', 'like', "%{$search}%")
                          ->orWhere('sku', 'like', "%{$search}%");
                    });
                })
                ->when($request->product_id, function ($query, $productId) {
                    $query->whereHas('productVariant', function ($q) use ($productId) {
                        $q->where('product_id', $productId);
                    });
                })
                ->when($request->date_from, function ($query, $dateFrom) {
                    $query->whereDate('created_at', '>=', $dateFrom);
                })
                ->when($request->date_to, function ($query, $dateTo) {
                    $query->whereDate('created_at', '<=', $dateTo);
                })
                ->when($request->reason, function ($query, $reason) {
                    $query->where('reason', $reason);
                })
                ->when($request->movement_type, function ($query, $movementType) {
                    $query->where('movement_type', $movementType);
                })
                ->when($request->reference_type, function ($query, $referenceType) {
                    $query->where('reference_type', $referenceType);
                })
                ->when($request->type, function ($query, $type) {
                    $query->where('type', $type);
                })
                ->orderBy('created_at', 'desc')
                ->paginate($perPage)
                ->withQueryString();

            // Get unique reasons for filter dropdown
            $reasons = InventoryMovement::distinct()
                ->pluck('reason')
                ->filter()
                ->sort()
                ->values();

            $movementTypes = InventoryMovement::query()
                ->whereNotNull('movement_type')
                ->distinct()
                ->pluck('movement_type')
                ->filter()
                ->sort()
                ->values();

            $referenceTypes = InventoryMovement::query()
                ->whereNotNull('reference_type')
                ->distinct()
                ->pluck('reference_type')
                ->filter()
                ->sort()
                ->values();

            // Get products for filter dropdown
            $products = \App\Models\Product::where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name']);

            return Inertia::render('inventory/movement-history', [
                'movements' => $movements,
                'reasons' => $reasons,
                'movementTypes' => $movementTypes,
                'referenceTypes' => $referenceTypes,
                'products' => $products,
                'filters' => $request->only([
                    'search',
                    'product_id',
                    'date_from',
                    'date_to',
                    'reason',
                    'movement_type',
                    'reference_type',
                    'type',
                    'per_page'
                ]),
            ]);
        } catch (\Exception $e) {
            Log::error('InventoryMovementHistoryController@index error: ' . $e->getMessage());
            throw $e;
        }
    }
}
