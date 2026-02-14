import { Head } from '@inertiajs/react';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import { Eye } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MobileRecordCard, MobileRecordRow } from '@/components/mobile/record-card';
import { FilterSheetButton } from '@/components/mobile/filter-sheet-button';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Deliveries Report',
        href: '/reports/deliveries',
    },
];

interface User {
    id: number;
    name: string;
}

interface Sale {
    id: number;
    sale_number: string;
}

interface ProductVariant {
    id: number;
    description: string;
    product: {
        id: number;
        name: string;
    };
}

interface DeliveryItem {
    id: number;
    quantity: number;
    product_variant: ProductVariant;
}

interface Delivery {
    id: number;
    status: string;
    delivered_at: string;
    notes: string | null;
    sale: Sale;
    delivered_by: User;
    items: DeliveryItem[];
}

interface DeliveriesReportProps {
    deliveries: {
        data: Delivery[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        date_from?: string;
        date_to?: string;
        status?: string;
        sale_id?: string;
    };
}

function StatusBadge({ status }: { status: string }) {
    // Match sales page badge colors using Tailwind classes
    const statusConfig: Record<string, { label: string; className: string }> = {
        pending: { 
            label: 'Pending', 
            className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' 
        },
        partial: { 
            label: 'Partial', 
            className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' 
        },
        delivered: { 
            label: 'Delivered', 
            className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' 
        },
        canceled: { 
            label: 'Canceled', 
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

export default function DeliveriesReport({ deliveries, filters }: DeliveriesReportProps) {
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters?.date_to ?? '');
    const [status, setStatus] = useState(filters.status ? filters.status : 'all');
    const [perPage, setPerPage] = useState(String(filters?.per_page ?? 15));

    const triggerFetch = useCallback((params: any = {}) => {
        const currentStatus = params.status !== undefined ? params.status : status;
        const currentDateFrom = params.date_from !== undefined ? params.date_from : dateFrom;
        const currentDateTo = params.date_to !== undefined ? params.date_to : dateTo;
        
        router.get('/reports/deliveries', {
            page: params.page || deliveries?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            date_from: currentDateFrom || undefined,
            date_to: currentDateTo || undefined,
            status: currentStatus === 'all' ? undefined : currentStatus,
            sale_id: params.sale_id !== undefined ? params.sale_id : filters.sale_id || undefined,
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [dateFrom, dateTo, status, perPage, deliveries?.current_page, filters.sale_id]);

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

    const hasActiveFilters = Boolean(dateFrom) || Boolean(dateTo) || status !== 'all';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Deliveries Report" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div>
                    <h1 className="hidden text-2xl font-bold md:block">Deliveries Report</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Complete delivery history with partial and full deliveries
                    </p>
                </div>

                {/* Filters */}
                <div className="flex justify-end md:hidden">
                    <FilterSheetButton title="Delivery Filters" isActive={hasActiveFilters}>
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
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="partial">Partial</SelectItem>
                                    <SelectItem value="delivered">Delivered</SelectItem>
                                    <SelectItem value="canceled">Canceled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </FilterSheetButton>
                </div>

                <div className="hidden gap-4 md:grid md:grid-cols-3">
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
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="canceled">Canceled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Pending</div>
                        <div className="hidden text-2xl font-bold md:block">
                            {deliveries.data.filter(d => d.status === 'pending').length}
                        </div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Partial</div>
                        <div className="hidden text-2xl font-bold md:block">
                            {deliveries.data.filter(d => d.status === 'partial').length}
                        </div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Delivered</div>
                        <div className="hidden text-2xl font-bold md:block">
                            {deliveries.data.filter(d => d.status === 'delivered').length}
                        </div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Canceled</div>
                        <div className="hidden text-2xl font-bold md:block">
                            {deliveries.data.filter(d => d.status === 'canceled').length}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="space-y-3 md:hidden">
                    {deliveries.data.map((delivery) => {
                        const statusClass =
                            delivery.status === 'partial'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
                                : delivery.status === 'delivered'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

                        return (
                            <MobileRecordCard
                                key={delivery.id}
                                title={delivery.sale.sale_number}
                                subtitle={delivery.delivered_by?.name || 'N/A'}
                                value={`${delivery.items.length} item(s)`}
                                badges={[{ label: delivery.status, className: statusClass }]}
                                footer={
                                    <Button
                                        type="button"
                                        className="h-11 w-full"
                                        onClick={() => router.visit(`/deliveries/${delivery.id}`)}
                                    >
                                        View Details
                                    </Button>
                                }
                            >
                                <MobileRecordRow
                                    label="Date"
                                    value={new Date(delivery.delivered_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                />
                                <MobileRecordRow label="Notes" value={delivery.notes || '-'} />
                            </MobileRecordCard>
                        );
                    })}
                </div>

                <div className="hidden rounded-lg border md:block">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Sale Number</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Items</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Delivered By</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deliveries.data.map((delivery) => (
                                    <tr key={delivery.id} className="border-b hover:bg-accent">
                                        <td className="px-4 py-3 text-sm">
                                            {new Date(delivery.delivered_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium">
                                            {delivery.sale.sale_number}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <StatusBadge status={delivery.status} />
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="space-y-1">
                                                {delivery.items.map((item) => (
                                                    <div key={item.id} className="text-xs">
                                                        {item.product_variant?.product?.name || 'Unknown Product'} - {item.product_variant?.description || 'N/A'}: {item.quantity}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{delivery.delivered_by?.name || 'N/A'}</td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">{delivery.notes || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => router.visit(`/deliveries/${delivery.id}`)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="hidden md:block">
                    <Pagination
                        currentPage={deliveries.current_page}
                        lastPage={deliveries.last_page}
                        total={deliveries.total}
                        perPage={deliveries.per_page}
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
                        currentPage={deliveries.current_page}
                        lastPage={deliveries.last_page}
                        total={deliveries.total}
                        perPage={deliveries.per_page}
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


