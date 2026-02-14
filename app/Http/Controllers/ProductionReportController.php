<?php

namespace App\Http\Controllers;

use App\Models\ProductionRun;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductionReportController extends Controller
{
    public function index(Request $request): Response
    {
        if (!$request->user()?->isAdmin()) {
            abort(403, 'Only owners and managers can access reports.');
        }

        $perPage = $request->integer('per_page', 15);

        $runs = ProductionRun::query()
            ->with([
                'createdBy:id,name',
                'lines:id,production_run_id,product_variant_id,direction,qty,unit,unit_cost,total_cost,weigh_in_id',
                'lines.productVariant:id,product_id,description',
                'lines.productVariant.product:id,name',
            ])
            ->when($request->date_from, function ($query, $dateFrom) {
                $query->whereDate('production_date', '>=', $dateFrom);
            })
            ->when($request->date_to, function ($query, $dateTo) {
                $query->whereDate('production_date', '<=', $dateTo);
            })
            ->when($request->run_type, function ($query, $runType) {
                $query->where('run_type', $runType);
            })
            ->orderByDesc('production_date')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return Inertia::render('reports/production', [
            'runs' => $runs,
            'filters' => $request->only(['date_from', 'date_to', 'run_type', 'per_page']),
        ]);
    }
}
