import { Head } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import { Eye } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { formatCurrency } from '@/lib/format-currency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Sales Report',
        href: '/reports/sales',
    },
];

interface User {
    id: number;
    name: string;
    email: string;
}

interface Sale {
    id: number;
    sale_number: string;
    status: string;
    payment_status: string;
    subtotal: number;
    total: number;
    created_at: string;
    cashier: User;
    items: Array<{
        id: number;
        quantity: number;
        unit_price: number;
        line_total: number;
        product_variant: {
            id: number;
            description: string;
            product: {
                id: number;
                name: string;
            };
        };
    }>;
    payments: Array<{
        id: number;
        amount: number;
    }>;
    refunds: Array<{
        id: number;
        refund_amount: number;
    }>;
}

interface SalesReportProps {
    sales: {
        data: Sale[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    users: User[];
    filters: {
        date_from?: string;
        date_to?: string;
        cashier_id?: string;
        status?: string;
    };
}

function StatusBadge({ status }: { status: string }) {
    // Match sales page badge colors using Tailwind classes
    const statusConfig: Record<string, { label: string; className: string }> = {
        OPEN: { 
            label: 'Open', 
            className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
        },
        PARTIAL: { 
            label: 'Partial', 
            className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' 
        },
        COMPLETED: { 
            label: 'Completed', 
            className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' 
        },
        PARTIALLY_REFUNDED: { 
            label: 'Partially Refunded', 
            className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' 
        },
        REFUNDED: { 
            label: 'Refunded', 
            className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' 
        },
        VOIDED: { 
            label: 'Voided', 
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

export default function SalesReport({ sales, users, filters }: SalesReportProps) {
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters?.date_to ?? '');
    const [cashierId, setCashierId] = useState(filters.cashier_id || 'all');
    const [status, setStatus] = useState(filters.status ? filters.status : 'all');
    const [perPage, setPerPage] = useState(String(filters?.per_page ?? 15));

    const triggerFetch = useCallback((params: any = {}) => {
        const currentStatus = params.status !== undefined ? params.status : status;
        const currentCashierId = params.cashier_id !== undefined ? params.cashier_id : cashierId;
        const currentDateFrom = params.date_from !== undefined ? params.date_from : dateFrom;
        const currentDateTo = params.date_to !== undefined ? params.date_to : dateTo;
        
        router.get('/reports/sales', {
            page: params.page || sales?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            date_from: currentDateFrom || undefined,
            date_to: currentDateTo || undefined,
            cashier_id: currentCashierId === 'all' ? undefined : currentCashierId,
            status: currentStatus === 'all' ? undefined : currentStatus,
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [dateFrom, dateTo, cashierId, status, perPage, sales?.current_page]);

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

    const getTotalRefunded = (sale: Sale): number => {
        return sale.refunds.reduce((sum, refund) => sum + parseFloat(String(refund.refund_amount)), 0);
    };

    const getTotalPaid = (sale: Sale): number => {
        return sale.payments.reduce((sum, payment) => sum + parseFloat(String(payment.amount)), 0);
    };

    const getAdjustedTotal = (sale: Sale): number => {
        // Adjusted total = original total - refunds
        return sale.total - getTotalRefunded(sale);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Sales Report" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div>
                    <h1 className="text-2xl font-bold">Sales Report</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Complete sales history with filters and drill-down capabilities
                    </p>
                </div>

                {/* Filters */}
                <div className="grid gap-4 md:grid-cols-4">
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
                        <label className="text-sm font-medium mb-1 block">Cashier</label>
                        <Select 
                            value={cashierId} 
                            onValueChange={(value) => { 
                                setCashierId(value); 
                                triggerFetch({ cashier_id: value, page: 1 }); 
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Cashiers" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Cashiers</SelectItem>
                                {users.map((user) => (
                                    <SelectItem key={user.id} value={String(user.id)}>
                                        {user.name}
                                    </SelectItem>
                                ))}
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
                                <SelectItem value="OPEN">Open</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="PARTIAL">Partial</SelectItem>
                                <SelectItem value="VOIDED">Voided</SelectItem>
                                <SelectItem value="REFUNDED">Refunded</SelectItem>
                                <SelectItem value="PARTIALLY_REFUNDED">Partially Refunded</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Sales</div>
                        <div className="text-2xl font-bold">
                            {formatCurrency(sales.data.reduce((sum, sale) => sum + sale.total, 0))}
                        </div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Refunded</div>
                        <div className="text-2xl font-bold text-destructive">
                            {formatCurrency(sales.data.reduce((sum, sale) => sum + getTotalRefunded(sale), 0))}
                        </div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Net Sales</div>
                        <div className="text-2xl font-bold">
                            {formatCurrency(sales.data.reduce((sum, sale) => sum + getAdjustedTotal(sale), 0))}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-lg border">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left text-sm font-medium">Sale Number</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Cashier</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Original Total</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Refunded</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Adjusted Total</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.data.map((sale) => {
                                    const totalRefunded = getTotalRefunded(sale);
                                    const adjustedTotal = getAdjustedTotal(sale);
                                    return (
                                        <tr key={sale.id} className="border-b hover:bg-accent">
                                            <td className="px-4 py-3 text-sm font-medium">{sale.sale_number}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {new Date(sale.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm">{sale.cashier.name}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <StatusBadge status={sale.status} />
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">{formatCurrency(sale.total)}</td>
                                            <td className="px-4 py-3 text-sm text-right text-destructive">
                                                {totalRefunded > 0 ? formatCurrency(totalRefunded) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-medium">
                                                {formatCurrency(adjustedTotal)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => router.visit(`/sales/${sale.id}`)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                    <RowsPerPageSelector
                        value={parseInt(perPage, 10)}
                        onChange={handlePerPageChange}
                        options={PER_PAGE_OPTIONS}
                    />
                    <Pagination
                        currentPage={sales.current_page}
                        totalPages={sales.last_page}
                        onPageChange={handlePageChange}
                    />
                </div>
            </div>
        </AppLayout>
    );
}

