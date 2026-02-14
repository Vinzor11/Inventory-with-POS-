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
import { MobileRecordCard, MobileRecordRow } from '@/components/mobile/record-card';
import { FilterSheetButton } from '@/components/mobile/filter-sheet-button';

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
    sale_date?: string | null;
    created_at: string;
    cashier: User;
    items: Array<{
        id: number;
        quantity: number;
        canceled_quantity?: number;
        unit_price: number;
        line_total: number;
        unit_cost?: number | null;
        total_cost?: number | null;
        profit?: number | null;
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
        per_page?: number;
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

    const getQtySold = (sale: Sale): number => {
        return sale.items.reduce((sum, item) => {
            const canceled = item.canceled_quantity ?? 0;
            return sum + Math.max(item.quantity - canceled, 0);
        }, 0);
    };

    const getRevenue = (sale: Sale): number => {
        return sale.items.reduce((sum, item) => {
            const canceled = item.canceled_quantity ?? 0;
            const activeQty = Math.max(item.quantity - canceled, 0);
            if (item.quantity <= 0) {
                return sum;
            }

            return sum + (activeQty / item.quantity) * item.line_total;
        }, 0);
    };

    const getCogs = (sale: Sale): number => {
        return sale.items.reduce((sum, item) => {
            const canceled = item.canceled_quantity ?? 0;
            const activeQty = Math.max(item.quantity - canceled, 0);
            if (activeQty <= 0) {
                return sum;
            }

            if (item.total_cost !== null && item.total_cost !== undefined) {
                if (item.quantity <= 0) {
                    return sum;
                }

                return sum + (activeQty / item.quantity) * item.total_cost;
            }

            if (item.unit_cost !== null && item.unit_cost !== undefined) {
                return sum + activeQty * item.unit_cost;
            }

            return sum;
        }, 0);
    };

    const getGrossProfit = (sale: Sale): number => {
        return getRevenue(sale) - getCogs(sale);
    };

    const hasActiveFilters = Boolean(dateFrom) || Boolean(dateTo) || cashierId !== 'all' || status !== 'all';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Sales Report" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div>
                    <h1 className="hidden text-2xl font-bold md:block">Sales Report</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Complete sales history with filters and drill-down capabilities
                    </p>
                </div>

                {/* Filters */}
                <div className="flex justify-end md:hidden">
                    <FilterSheetButton title="Sales Report Filters" isActive={hasActiveFilters}>
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
                    </FilterSheetButton>
                </div>

                <div className="hidden gap-4 md:grid md:grid-cols-4">
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
                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Qty Sold (kg)</div>
                        <div className="hidden text-2xl font-bold md:block">
                            {sales.data.reduce((sum, sale) => sum + getQtySold(sale), 0).toFixed(2)}
                        </div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Revenue</div>
                        <div className="text-2xl font-bold">
                            {formatCurrency(sales.data.reduce((sum, sale) => sum + getRevenue(sale), 0))}
                        </div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">COGS</div>
                        <div className="hidden text-2xl font-bold md:block">
                            {formatCurrency(sales.data.reduce((sum, sale) => sum + getCogs(sale), 0))}
                        </div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Gross Profit</div>
                        <div className="hidden text-2xl font-bold md:block">
                            {formatCurrency(sales.data.reduce((sum, sale) => sum + getGrossProfit(sale), 0))}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="space-y-3 md:hidden">
                    {sales.data.map((sale) => {
                        const qtySold = getQtySold(sale);
                        const revenue = getRevenue(sale);
                        const cogs = getCogs(sale);
                        const grossProfit = getGrossProfit(sale);
                        return (
                            <MobileRecordCard
                                key={sale.id}
                                title={sale.sale_number}
                                subtitle={sale.cashier.name}
                                value={formatCurrency(revenue)}
                                badges={[{
                                    label: sale.status,
                                    className: ((): string => {
                                        const statusConfig: Record<string, string> = {
                                            OPEN: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
                                            PARTIAL: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
                                            COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
                                            PARTIALLY_REFUNDED: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
                                            REFUNDED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
                                            VOIDED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                                        };
                                        return statusConfig[sale.status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
                                    })(),
                                }]}
                                footer={
                                    <Button
                                        type="button"
                                        className="h-11 w-full"
                                        onClick={() => router.visit(`/sales/${sale.id}`)}
                                    >
                                        View Details
                                    </Button>
                                }
                            >
                                <MobileRecordRow
                                    label="Date"
                                    value={new Date(sale.sale_date || sale.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                />
                                <MobileRecordRow label="Qty Sold" value={`${qtySold.toFixed(2)} kg`} />
                                <MobileRecordRow label="COGS" value={formatCurrency(cogs)} />
                                <MobileRecordRow label="Gross Profit" value={formatCurrency(grossProfit)} />
                            </MobileRecordCard>
                        );
                    })}
                </div>

                <div className="hidden rounded-lg border md:block">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left text-sm font-medium">Sale Number</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Cashier</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Qty Sold (kg)</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Revenue</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">COGS</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Gross Profit</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.data.map((sale) => {
                                    const qtySold = getQtySold(sale);
                                    const revenue = getRevenue(sale);
                                    const cogs = getCogs(sale);
                                    const grossProfit = getGrossProfit(sale);
                                    return (
                                        <tr key={sale.id} className="border-b hover:bg-accent">
                                            <td className="px-4 py-3 text-sm font-medium">{sale.sale_number}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {new Date(sale.sale_date || sale.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm">{sale.cashier.name}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <StatusBadge status={sale.status} />
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">{qtySold.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-sm text-right">{formatCurrency(revenue)}</td>
                                            <td className="px-4 py-3 text-sm text-right">{formatCurrency(cogs)}</td>
                                            <td className="px-4 py-3 text-sm text-right font-medium">
                                                {formatCurrency(grossProfit)}
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
                <div className="hidden md:block">
                    <Pagination
                        currentPage={sales.current_page}
                        lastPage={sales.last_page}
                        total={sales.total}
                        perPage={sales.per_page}
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
                        currentPage={sales.current_page}
                        lastPage={sales.last_page}
                        total={sales.total}
                        perPage={sales.per_page}
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


