<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

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

        $dashboardData = Cache::remember(
            key: 'api:dashboard:v1',
            ttl: now()->addSeconds(90),
            callback: fn (): array => $this->dashboardService->getDashboardData(),
        );

        return response()->json([
            'success' => true,
            'data' => $dashboardData,
        ]);
    }
}

