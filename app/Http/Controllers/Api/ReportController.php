<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DeliveriesReportQueryService;
use App\Services\InventoryMovementReportQueryService;
use App\Services\PaymentsReportQueryService;
use App\Services\RefundsAdjustmentsReportQueryService;
use App\Services\SalesReportQueryService;
use App\Services\WeighInsReportQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    /**
     * Sales report
     */
    public function sales(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $service = new SalesReportQueryService();

        $filters = [
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
            'cashier_id' => $request->input('cashier_id'),
            'status' => $request->input('status'),
            'payment_status' => $request->input('payment_status'),
        ];

        $perPage = $request->input('per_page', 15);
        $sales = $service->getPaginated($filters, $perPage);
        $grossSales = $service->getGrossSalesTotal($filters);
        $totalCost = $service->getSalesCostTotal($filters);
        $grossProfit = $service->getGrossProfitTotal($filters);
        $netSales = $service->getNetSalesTotal($filters);
        $summary = [
            'count' => $service->getSalesCount($filters),
            'gross_sales' => $grossSales,
            'total_cost' => $totalCost,
            'gross_profit' => $grossProfit,
            'total_refunded' => max(0, $grossSales - $netSales),
            'net_sales' => $netSales,
            'by_status' => $service->getSummaryByStatus($filters),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'sales' => $sales,
                'summary' => $summary,
            ],
        ]);
    }

    /**
     * Payments report
     */
    public function payments(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $service = new PaymentsReportQueryService();

        $filters = [
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
            'payment_method' => $request->input('payment_method'),
            'received_by_id' => $request->input('received_by_id'),
        ];

        $perPage = $request->input('per_page', 15);
        $payments = $service->getPaginated($filters, $perPage);
        $summary = $service->getSummary($filters);

        return response()->json([
            'success' => true,
            'data' => [
                'payments' => $payments,
                'summary' => $summary,
            ],
        ]);
    }

    /**
     * Refunds and adjustments report
     */
    public function refundsAdjustments(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $service = new RefundsAdjustmentsReportQueryService();

        $filters = [
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
            'type' => $request->input('type'),
        ];

        $perPage = $request->input('per_page', 15);
        $data = $service->getPaginated($filters, $perPage);
        $summary = $service->getSummary($filters);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $data,
                'summary' => $summary,
            ],
        ]);
    }

    /**
     * Deliveries report
     */
    public function deliveries(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $service = new DeliveriesReportQueryService();

        $filters = [
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
            'status' => $request->input('status'),
            'delivered_by_id' => $request->input('delivered_by_id'),
        ];

        $perPage = $request->input('per_page', 15);
        $deliveries = $service->getPaginated($filters, $perPage);
        $summary = $service->getSummary($filters);

        return response()->json([
            'success' => true,
            'data' => [
                'deliveries' => $deliveries,
                'summary' => $summary,
            ],
        ]);
    }

    /**
     * Inventory movements report
     */
    public function inventoryMovements(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $service = new InventoryMovementReportQueryService();

        $filters = [
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
            'type' => $request->input('type'),
            'reason' => $request->input('reason'),
            'product_id' => $request->input('product_id'),
        ];

        $perPage = $request->input('per_page', 15);
        $movements = $service->getPaginated($filters, $perPage);
        $summary = $service->getSummary($filters);

        return response()->json([
            'success' => true,
            'data' => [
                'movements' => $movements,
                'summary' => $summary,
            ],
        ]);
    }

    /**
     * Weigh-ins report
     */
    public function weighIns(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $service = new WeighInsReportQueryService();

        $filters = [
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
            'type' => $request->input('type'),
            'payment_status' => $request->input('payment_status'),
        ];

        $perPage = $request->input('per_page', 15);
        $weighIns = $service->getPaginated($filters, $perPage);
        $summary = $service->getSummary($filters);

        return response()->json([
            'success' => true,
            'data' => [
                'weigh_ins' => $weighIns,
                'summary' => $summary,
            ],
        ]);
    }

    /**
     * Authorize admin access
     */
    private function authorizeAdmin(Request $request): void
    {
        if (!$request->user()->isAdmin()) {
            abort(403, 'Only administrators can access reports.');
        }
    }
}

