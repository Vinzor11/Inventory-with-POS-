<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Services\DatabaseSqlDumpService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DatabaseExportController extends Controller
{
    public function edit(Request $request): Response
    {
        $this->authorizeAdmin($request);

        return Inertia::render('settings/database');
    }

    public function export(Request $request, DatabaseSqlDumpService $dumpService): StreamedResponse
    {
        $this->authorizeAdmin($request);

        $filename = 'hims_db_'.now()->format('Ymd_His').'.sql';

        return response()->streamDownload(function () use ($dumpService): void {
            $dumpService->streamToOutput();
        }, $filename, [
            'Content-Type' => 'application/sql; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        if (! $request->user()?->isAdmin()) {
            abort(403, 'Only administrators can export database backups.');
        }
    }
}
