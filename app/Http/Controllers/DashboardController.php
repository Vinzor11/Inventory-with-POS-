<?php

namespace App\Http\Controllers;

use App\Services\DashboardQueryService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Dashboard Controller
 * 
 * READ-ONLY controller for Owner/Manager dashboard.
 * Displays aggregated KPIs only - no mutations allowed.
 * 
 * All dashboard numbers are derived from report query services
 * to ensure consistency with reports.
 */
class DashboardController extends Controller
{
    protected DashboardQueryService $dashboardService;

    public function __construct(DashboardQueryService $dashboardService)
    {
        $this->dashboardService = $dashboardService;
    }

    /**
     * Display the dashboard
     * 
     * Only accessible to admin (owner/manager) role.
     */
    public function index(Request $request): Response
    {
        // Authorization: Only admin can access dashboard
        if (!$request->user()->isAdmin()) {
            abort(403, 'Only owners and managers can access the dashboard.');
        }

        $dashboardData = $this->dashboardService->getDashboardData();

        return Inertia::render('dashboard/index', [
            'dashboard' => $dashboardData,
        ]);
    }
}

