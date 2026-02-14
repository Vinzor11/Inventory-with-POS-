import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector } from '@/components/ui/rows-per-page-selector';
import { formatCurrency } from '@/lib/format-currency';

interface ProductionLine {
    id: number;
    direction: 'in' | 'out';
    qty: number;
    unit: string;
    unit_cost: number | null;
}

interface ProductionRun {
    id: number;
    batch_code: string;
    run_type: 'coconut_to_uncooked' | 'uncooked_to_cooked' | 'coconut_to_cooked';
    production_date: string;
    input_qty: number;
    output_qty: number;
    yield_percent: number | null;
    shrinkage_qty: number | null;
    shrinkage_percent: number | null;
    total_input_cost: number;
    output_unit_cost: number;
    operator: string | null;
    created_by: {
        id: number;
        name: string;
    } | null;
    lines: ProductionLine[];
}

interface ProductionReportProps {
    runs: {
        data: ProductionRun[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        date_from?: string;
        date_to?: string;
        run_type?: string;
        per_page?: number;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Production Report', href: '/reports/production' },
];

export default function ProductionReport({ runs, filters }: ProductionReportProps) {
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');
    const [runType, setRunType] = useState(filters.run_type || 'all');
    const [perPage, setPerPage] = useState(String(filters.per_page || runs.per_page || 15));

    const fetch = (params: {
        date_from?: string;
        date_to?: string;
        run_type?: string;
        per_page?: number;
        page?: number;
    } = {}) => {
        const nextDateFrom = params.date_from !== undefined ? params.date_from : dateFrom;
        const nextDateTo = params.date_to !== undefined ? params.date_to : dateTo;
        const nextRunType = params.run_type !== undefined ? params.run_type : runType;
        const nextPerPage = params.per_page !== undefined ? params.per_page : Number(perPage);
        const nextPage = params.page !== undefined ? params.page : 1;

        router.get(
            '/reports/production',
            {
                date_from: nextDateFrom || undefined,
                date_to: nextDateTo || undefined,
                run_type: nextRunType === 'all' ? undefined : nextRunType,
                per_page: nextPerPage,
                page: nextPage,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Production Report" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <h1 className="text-2xl font-bold">Production Report</h1>

                <div className="grid gap-4 md:grid-cols-4">
                    <div>
                        <label className="mb-1 block text-sm">Date From</label>
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={(event) => {
                                setDateFrom(event.target.value);
                                fetch({ date_from: event.target.value, page: 1 });
                            }}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">Date To</label>
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={(event) => {
                                setDateTo(event.target.value);
                                fetch({ date_to: event.target.value, page: 1 });
                            }}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">Run Type</label>
                        <Select
                            value={runType}
                            onValueChange={(value) => {
                                setRunType(value);
                                fetch({ run_type: value, page: 1 });
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All run types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="coconut_to_uncooked">Coconut to Uncooked</SelectItem>
                                <SelectItem value="uncooked_to_cooked">Uncooked to Cooked</SelectItem>
                                <SelectItem value="coconut_to_cooked">Coconut to Cooked</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDateFrom('');
                                setDateTo('');
                                setRunType('all');
                                fetch({
                                    date_from: undefined,
                                    date_to: undefined,
                                    run_type: 'all',
                                    page: 1,
                                });
                            }}
                        >
                            Clear Filters
                        </Button>
                    </div>
                </div>

                <div className="rounded-lg border">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left text-sm font-medium">Batch</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Run Type</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Input</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Output</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Output Metrics</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Total Cost</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Cost per Kg</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Operator</th>
                                </tr>
                            </thead>
                            <tbody>
                                {runs.data.map((run) => (
                                    <tr key={run.id} className="border-b">
                                        <td className="px-4 py-3 text-sm font-semibold">{run.batch_code}</td>
                                        <td className="px-4 py-3 text-sm">{run.production_date}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {run.run_type === 'coconut_to_uncooked'
                                                ? 'Coconut -> Uncooked'
                                                : run.run_type === 'uncooked_to_cooked'
                                                  ? 'Uncooked -> Cooked'
                                                  : 'Coconut -> Cooked'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm">{run.input_qty}</td>
                                        <td className="px-4 py-3 text-right text-sm">{run.output_qty}</td>
                                        <td className="px-4 py-3 text-right text-sm">
                                            {run.run_type === 'coconut_to_uncooked'
                                                || run.run_type === 'coconut_to_cooked'
                                                ? run.input_qty > 0 && run.output_qty > 0
                                                    ? `${(run.output_qty / run.input_qty).toFixed(2)} kg/pc | ${(run.input_qty / run.output_qty).toFixed(2)} pcs/kg`
                                                    : '0.00 kg/pc | 0.00 pcs/kg'
                                                : `${(run.shrinkage_qty || 0).toFixed(2)} kg (${(run.shrinkage_percent || 0).toFixed(2)}%)`}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm">
                                            P {formatCurrency(run.total_input_cost)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm">
                                            P {formatCurrency(run.output_unit_cost)}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {run.operator || run.created_by?.name || '-'}
                                        </td>
                                    </tr>
                                ))}
                                {runs.data.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                            No production runs found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {runs.data.length > 0 && (
                    <Pagination
                        currentPage={runs.current_page}
                        lastPage={runs.last_page}
                        total={runs.total}
                        perPage={runs.per_page}
                        onPageChange={(page) => fetch({ page })}
                        pageSizeSelector={
                            <RowsPerPageSelector
                                perPage={perPage}
                                onPerPageChange={(value) => {
                                    setPerPage(value);
                                    fetch({ per_page: Number(value), page: 1 });
                                }}
                            />
                        }
                    />
                )}
            </div>
        </AppLayout>
    );
}
