import { Head } from '@inertiajs/react';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { formatCurrency } from '@/lib/format-currency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MobileRecordCard, MobileRecordRow } from '@/components/mobile/record-card';
import { FilterSheetButton } from '@/components/mobile/filter-sheet-button';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Weigh-Ins Report',
        href: '/reports/weigh-ins',
    },
];

interface User {
    id: number;
    name: string;
}

interface WeighIn {
    id: number;
    ref_num: string;
    type: 'cooked_copra' | 'uncooked_copra' | 'coconut';
    weight_kg: number | null;
    count: number | null;
    unit_price: number;
    total_amount: number;
    status: 'unpaid' | 'paid';
    weighed_at: string;
    notes: string | null;
    weighed_by: User;
}

interface WeighInsReportProps {
    weighIns: {
        data: WeighIn[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    users: User[];
    filters: {
        date_from?: string;
        date_to?: string;
        type?: string;
        status?: string;
        weighed_by_user_id?: number;
    };
}

function TypeBadge({ type }: { type: string }) {
    // Match sales page badge colors using Tailwind classes
    const typeConfig: Record<string, { label: string; className: string }> = {
        cooked_copra: { 
            label: 'Cooked Copra', 
            className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' 
        },
        uncooked_copra: { 
            label: 'Uncooked Copra', 
            className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' 
        },
        coconut: { 
            label: 'Coconut', 
            className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
        },
    };

    const config = typeConfig[type] || { 
        label: type, 
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' 
    };

    return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
            {config.label}
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    // Match sales page payment status badge colors
    const statusConfig: Record<string, { label: string; className: string }> = {
        paid: { 
            label: 'Paid', 
            className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' 
        },
        unpaid: { 
            label: 'Unpaid', 
            className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' 
        },
    };

    const config = statusConfig[status] || { 
        label: status, 
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' 
    };

    return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
            {config.label}
        </span>
    );
}

export default function WeighInsReport({ weighIns, users, filters }: WeighInsReportProps) {
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters?.date_to ?? '');
    const [type, setType] = useState(filters.type || 'all');
    const [status, setStatus] = useState(filters.status || 'all');
    const [weighedByUserId, setWeighedByUserId] = useState(filters.weighed_by_user_id?.toString() || 'all');
    const [perPage, setPerPage] = useState(String(filters?.per_page ?? 15));

    const triggerFetch = useCallback((params: any = {}) => {
        const currentDateFrom = params.date_from !== undefined ? params.date_from : dateFrom;
        const currentDateTo = params.date_to !== undefined ? params.date_to : dateTo;
        const currentType = params.type !== undefined ? params.type : type;
        const currentStatus = params.status !== undefined ? params.status : status;
        const currentWeighedByUserId = params.weighed_by_user_id !== undefined ? params.weighed_by_user_id : weighedByUserId;
        
        router.get('/reports/weigh-ins', {
            page: params.page || weighIns?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            date_from: currentDateFrom || undefined,
            date_to: currentDateTo || undefined,
            type: currentType === 'all' ? undefined : currentType,
            status: currentStatus === 'all' ? undefined : currentStatus,
            weighed_by_user_id: currentWeighedByUserId === 'all' ? undefined : currentWeighedByUserId,
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [dateFrom, dateTo, type, status, weighedByUserId, perPage, weighIns?.current_page]);

    const handleDateChange = (key: 'date_from' | 'date_to', value: string) => {
        if (key === 'date_from') {
            setDateFrom(value);
        } else {
            setDateTo(value);
        }
        triggerFetch({ [key]: value || undefined, page: 1 });
    };

    const handleFilterChange = () => {
        triggerFetch({ page: 1 });
    };

    const handlePerPageChange = (value: number) => {
        const valueStr = String(value);
        setPerPage(valueStr);
        triggerFetch({ per_page: value, page: 1 });
    };

    const handlePageChange = (page: number) => {
        triggerFetch({ page });
    };

    // Calculate summary
    const totalAmount = weighIns.data.reduce((sum, weighIn) => sum + parseFloat(String(weighIn.total_amount || 0)), 0);
    const totalWeight = weighIns.data
        .filter(w => w.type === 'cooked_copra' || w.type === 'uncooked_copra')
        .reduce((sum, weighIn) => sum + parseFloat(String(weighIn.weight_kg || 0)), 0);
    const totalCount = weighIns.data
        .filter(w => w.type === 'coconut')
        .reduce((sum, weighIn) => sum + parseInt(String(weighIn.count || 0), 10), 0);

    const hasActiveFilters =
        Boolean(dateFrom)
        || Boolean(dateTo)
        || type !== 'all'
        || status !== 'all'
        || weighedByUserId !== 'all';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Weigh-Ins Report" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div>
                    <h1 className="hidden text-2xl font-bold md:block">Weigh-Ins Report</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Complete weigh-ins history with filters and drill-down capabilities
                    </p>
                </div>

                {/* Filters */}
                <div className="flex justify-end md:hidden">
                    <FilterSheetButton title="Weigh-In Filters" isActive={hasActiveFilters}>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Date From</label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => handleDateChange('date_from', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Date To</label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => handleDateChange('date_to', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Type</label>
                            <Select
                                value={type}
                                onValueChange={(value) => {
                                    setType(value);
                                    triggerFetch({ type: value, page: 1 });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="cooked_copra">Cooked Copra</SelectItem>
                                    <SelectItem value="uncooked_copra">Uncooked Copra</SelectItem>
                                    <SelectItem value="coconut">Coconut</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Status</label>
                            <Select
                                value={status}
                                onValueChange={(value) => {
                                    setStatus(value);
                                    triggerFetch({ status: value, page: 1 });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All Statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="unpaid">Unpaid</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Weighed By</label>
                            <Select
                                value={weighedByUserId}
                                onValueChange={(value) => {
                                    setWeighedByUserId(value);
                                    triggerFetch({ weighed_by_user_id: value, page: 1 });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All Users" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Users</SelectItem>
                                    {users.map((user) => (
                                        <SelectItem key={user.id} value={String(user.id)}>
                                            {user.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </FilterSheetButton>
                </div>

                <div className="hidden gap-4 md:grid md:grid-cols-5">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Date From</label>
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => handleDateChange('date_from', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Date To</label>
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => handleDateChange('date_to', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Type</label>
                        <Select 
                            value={type} 
                            onValueChange={(value) => { 
                                setType(value); 
                                triggerFetch({ type: value, page: 1 }); 
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="cooked_copra">Cooked Copra</SelectItem>
                                <SelectItem value="uncooked_copra">Uncooked Copra</SelectItem>
                                <SelectItem value="coconut">Coconut</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Status</label>
                        <Select 
                            value={status} 
                            onValueChange={(value) => { 
                                setStatus(value); 
                                triggerFetch({ status: value, page: 1 }); 
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Weighed By</label>
                        <Select 
                            value={weighedByUserId} 
                            onValueChange={(value) => { 
                                setWeighedByUserId(value); 
                                triggerFetch({ weighed_by_user_id: value, page: 1 }); 
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Users" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {users.map((user) => (
                                    <SelectItem key={user.id} value={user.id.toString()}>
                                        {user.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Amount</div>
                        <div className="hidden text-2xl font-bold md:block">{formatCurrency(totalAmount)}</div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Weight (kg)</div>
                        <div className="hidden text-2xl font-bold md:block">{Number(totalWeight || 0).toFixed(2)} kg</div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Count (Coconuts)</div>
                        <div className="hidden text-2xl font-bold md:block">{totalCount}</div>
                    </div>
                </div>

                {/* Table */}
                <div className="space-y-3 md:hidden">
                    {weighIns.data.map((weighIn) => (
                        <MobileRecordCard
                            key={weighIn.id}
                            title={weighIn.ref_num}
                            subtitle={weighIn.weighed_by.name}
                            value={formatCurrency(weighIn.total_amount)}
                            badges={[
                                {
                                    label: weighIn.type,
                                    className:
                                        weighIn.type === 'cooked_copra'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                                            : weighIn.type === 'uncooked_copra'
                                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
                                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
                                },
                                {
                                    label: weighIn.status,
                                    className:
                                        weighIn.status === 'paid'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                                },
                            ]}
                        >
                            <MobileRecordRow
                                label="Date"
                                value={new Date(weighIn.weighed_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            />
                            <MobileRecordRow
                                label="Weight/Count"
                                value={weighIn.type === 'coconut' ? `${weighIn.count || 0} pcs` : `${weighIn.weight_kg || 0} kg`}
                            />
                            <MobileRecordRow label="Unit Price" value={formatCurrency(weighIn.unit_price)} />
                            <MobileRecordRow label="Notes" value={weighIn.notes || '-'} />
                        </MobileRecordCard>
                    ))}
                    {weighIns.data.length === 0 && (
                        <div className="rounded-lg border p-8 text-center text-gray-500 dark:text-gray-400">
                            No weigh-ins found.
                        </div>
                    )}
                </div>

                <div className="hidden rounded-lg border md:block">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left text-sm font-medium">Ref Number</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Weight/Count</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Unit Price</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Total Amount</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Weighed By</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {weighIns.data.map((weighIn) => (
                                    <tr key={weighIn.id} className="border-b hover:bg-accent">
                                        <td className="px-4 py-3 text-sm font-medium">
                                            {weighIn.ref_num}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {new Date(weighIn.weighed_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <TypeBadge type={weighIn.type} />
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {weighIn.type === 'coconut' 
                                                ? `${weighIn.count || 0} pcs`
                                                : `${weighIn.weight_kg || 0} kg`
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {formatCurrency(weighIn.unit_price)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium">
                                            {formatCurrency(weighIn.total_amount)}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <StatusBadge status={weighIn.status} />
                                        </td>
                                        <td className="px-4 py-3 text-sm">{weighIn.weighed_by.name}</td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">{weighIn.notes || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {weighIns.data.length === 0 && (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            No weigh-ins found.
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <div className="hidden md:block">
                    <Pagination
                        currentPage={weighIns.current_page}
                        lastPage={weighIns.last_page}
                        total={weighIns.total}
                        perPage={weighIns.per_page}
                        onPageChange={handlePageChange}
                        pageSizeSelector={
                            <RowsPerPageSelector
                                perPage={perPage}
                                onPerPageChange={(value) => handlePerPageChange(parseInt(value, 10))}
                            />
                        }
                    />
                </div>

                <div className="md:hidden">
                    <Pagination
                        currentPage={weighIns.current_page}
                        lastPage={weighIns.last_page}
                        total={weighIns.total}
                        perPage={weighIns.per_page}
                        onPageChange={handlePageChange}
                        pageSizeSelector={
                            <RowsPerPageSelector
                                perPage={perPage}
                                onPerPageChange={(value) => handlePerPageChange(parseInt(value, 10))}
                            />
                        }
                    />
                </div>
            </div>
        </AppLayout>
    );
}


