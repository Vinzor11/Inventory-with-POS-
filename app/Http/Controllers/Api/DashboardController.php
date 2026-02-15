<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    protected DashboardQueryService $dashboardService;

    public function __construct(DashboardQueryService $dashboardService)
    {
        $this->dashboardService = $dashboardService;
    }

    /**
     * Get dashboard data
     */
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->isAdmin()) {
            abort(403, 'Only administrators can access the dashboard.');
        }

        // Dashboard must reflect write actions (sale/payment/refund/void/cancel) immediately.
        // Avoid API-level TTL caching here to prevent stale KPIs after checkout.
        $dashboardData = $this->dashboardService->getDashboardData();

        return response()
            ->json([
                'success' => true,
                'data' => $dashboardData,
            ])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
    }
}

