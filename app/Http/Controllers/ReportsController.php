<?php

namespace App\Http\Controllers;

use App\Services\SalesReportQueryService;
use App\Services\PaymentsReportQueryService;
use App\Services\RefundsAdjustmentsReportQueryService;
use App\Services\DeliveriesReportQueryService;
use App\Services\InventoryMovementReportQueryService;
use App\Services\WeighInsReportQueryService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Reports Controller
 * 
 * READ-ONLY controller for Owner/Manager reports.
 * Provides full drill-down reports with filters, pagination, and exports.
 * 
 * All reports use shared query services that are also used by the dashboard
 * to ensure numbers match exactly.
 */
class ReportsController extends Controller
{
    protected SalesReportQueryService $salesReportService;
    protected PaymentsReportQueryService $paymentsReportService;
    protected RefundsAdjustmentsReportQueryService $refundsAdjustmentsReportService;
    protected DeliveriesReportQueryService $deliveriesReportService;
    protected InventoryMovementReportQueryService $inventoryMovementReportService;
    protected WeighInsReportQueryService $weighInsReportService;

    public function __construct(
        SalesReportQueryService $salesReportService,
        PaymentsReportQueryService $paymentsReportService,
        RefundsAdjustmentsReportQueryService $refundsAdjustmentsReportService,
        DeliveriesReportQueryService $deliveriesReportService,
        InventoryMovementReportQueryService $inventoryMovementReportService,
        WeighInsReportQueryService $weighInsReportService
    ) {
        $this->salesReportService = $salesReportService;
        $this->paymentsReportService = $paymentsReportService;
        $this->refundsAdjustmentsReportService = $refundsAdjustmentsReportService;
        $this->deliveriesReportService = $deliveriesReportService;
        $this->inventoryMovementReportService = $inventoryMovementReportService;
        $this->weighInsReportService = $weighInsReportService;
    }

    /**
     * Check if user is admin (owner/manager)
     */
    protected function ensureAdmin(Request $request): void
    {
        if (!$request->user()->isAdmin()) {
            abort(403, 'Only owners and managers can access reports.');
        }
    }

    /**
     * Sales Report
     */
    public function sales(Request $request): Response
    {
        $this->ensureAdmin($request);

        $filters = array_filter($request->only(['date_from', 'date_to', 'cashier_id', 'status']), function ($value) {
            return $value !== null && $value !== '' && $value !== 'all';
        });
        $perPage = $request->get('per_page', 15);

        $sales = $this->salesReportService->getPaginated($filters, $perPage);
        $users = \App\Models\User::where('role', 'staff')->orWhere('role', 'admin')->get(['id', 'name']);

        return Inertia::render('reports/sales', [
            'sales' => $sales,
            'users' => $users,
            'filters' => $filters,
        ]);
    }

    /**
     * Payments Report
     */
    public function payments(Request $request): Response
    {
        $this->ensureAdmin($request);

        $filters = array_filter($request->only(['date_from', 'date_to', 'payment_method', 'status', 'type']), function ($value) {
            return $value !== null && $value !== '' && $value !== 'all';
        });
        $perPage = $request->get('per_page', 15);

        $payments = $this->paymentsReportService->getPaginated($filters, $perPage);

        return Inertia::render('reports/payments', [
            'payments' => $payments,
            'filters' => $filters,
        ]);
    }

    /**
     * Refunds & Adjustments Report
     */
    public function refundsAdjustments(Request $request): Response
    {
        $this->ensureAdmin($request);

        $filters = array_filter($request->only(['date_from', 'date_to', 'sale_id']), function ($value) {
            return $value !== null && $value !== '' && $value !== 'all';
        });
        $perPage = $request->get('per_page', 15);

        // Get both refunds and adjustments with pagination
        // Note: Frontend handles tab switching, so we always load both
        $refunds = $this->refundsAdjustmentsReportService->getRefundsPaginated($filters, $perPage);
        $adjustments = $this->refundsAdjustmentsReportService->getAdjustmentsPaginated($filters, $perPage);

        return Inertia::render('reports/refunds-adjustments', [
            'refunds' => $refunds,
            'adjustments' => $adjustments,
            'filters' => $filters,
        ]);
    }

    /**
     * Deliveries Report
     */
    public function deliveries(Request $request): Response
    {
        $this->ensureAdmin($request);

        $filters = array_filter($request->only(['date_from', 'date_to', 'status', 'sale_id']), function ($value) {
            return $value !== null && $value !== '' && $value !== 'all';
        });
        $perPage = $request->get('per_page', 15);

        $deliveries = $this->deliveriesReportService->getPaginated($filters, $perPage);

        return Inertia::render('reports/deliveries', [
            'deliveries' => $deliveries,
            'filters' => $filters,
        ]);
    }

    /**
     * Inventory Movement Report
     */
    public function inventoryMovements(Request $request): Response
    {
        $this->ensureAdmin($request);

        $filters = array_filter($request->only(['date_from', 'date_to', 'type', 'product_variant_id', 'reason']), function ($value) {
            return $value !== null && $value !== '' && $value !== 'all';
        });
        $perPage = $request->get('per_page', 15);

        $movements = $this->inventoryMovementReportService->getPaginated($filters, $perPage);
        $variants = \App\Models\ProductVariant::with('product')->get(['id', 'product_id', 'description']);

        return Inertia::render('reports/inventory-movements', [
            'movements' => $movements,
            'variants' => $variants,
            'filters' => $filters,
        ]);
    }

    /**
     * Weigh-Ins Report
     */
    public function weighIns(Request $request): Response
    {
        $this->ensureAdmin($request);

        $filters = array_filter($request->only(['date_from', 'date_to', 'type', 'status', 'weighed_by_user_id']), function ($value) {
            return $value !== null && $value !== '' && $value !== 'all';
        });
        $perPage = $request->get('per_page', 15);

        $weighIns = $this->weighInsReportService->getPaginated($filters, $perPage);
        $users = \App\Models\User::orderBy('name')->get(['id', 'name']);

        return Inertia::render('reports/weigh-ins', [
            'weighIns' => $weighIns,
            'users' => $users,
            'filters' => $filters,
        ]);
    }
}

