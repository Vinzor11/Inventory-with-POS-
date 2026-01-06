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

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Payments Report',
        href: '/reports/payments',
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

interface Payment {
    id: number;
    amount: number;
    payment_method: string;
    status: string;
    received_at: string;
    notes: string | null;
    sale: Sale;
    received_by: User;
}

interface PaymentsReportProps {
    payments: {
        data: Payment[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        date_from?: string;
        date_to?: string;
        payment_method?: string;
        status?: string;
        type?: string;
    };
}

export default function PaymentsReport({ payments, filters }: PaymentsReportProps) {
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters?.date_to ?? '');
    const [paymentMethod, setPaymentMethod] = useState(filters.payment_method || 'all');
    const [status, setStatus] = useState(filters.status || 'all');
    const [type, setType] = useState(filters.type || 'all');
    const [perPage, setPerPage] = useState(String(filters?.per_page ?? 15));

    const triggerFetch = useCallback((params: any = {}) => {
        const currentDateFrom = params.date_from !== undefined ? params.date_from : dateFrom;
        const currentDateTo = params.date_to !== undefined ? params.date_to : dateTo;
        const currentPaymentMethod = params.payment_method !== undefined ? params.payment_method : paymentMethod;
        const currentStatus = params.status !== undefined ? params.status : status;
        const currentType = params.type !== undefined ? params.type : type;
        
        router.get('/reports/payments', {
            page: params.page || payments?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            date_from: currentDateFrom || undefined,
            date_to: currentDateTo || undefined,
            payment_method: currentPaymentMethod === 'all' ? undefined : currentPaymentMethod,
            status: currentStatus === 'all' ? undefined : currentStatus,
            type: currentType === 'all' ? undefined : currentType,
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [dateFrom, dateTo, paymentMethod, status, type, perPage, payments?.current_page]);

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

    const isRefund = (payment: Payment) => payment.amount < 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Payments Report" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div>
                    <h1 className="text-2xl font-bold">Payments Report</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Complete payment history including refunds
                    </p>
                </div>

                {/* Filters */}
                <div className="grid gap-4 md:grid-cols-5">
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
                        <label className="text-sm font-medium mb-1 block">Payment Method</label>
                        <Select 
                            value={paymentMethod} 
                            onValueChange={(value) => { 
                                setPaymentMethod(value); 
                                triggerFetch({ payment_method: value, page: 1 }); 
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Methods" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Methods</SelectItem>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="check">Check</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
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
                                <SelectItem value="payment">Payments</SelectItem>
                                <SelectItem value="refund">Refunds</SelectItem>
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
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Payments</div>
                        <div className="text-2xl font-bold">
                            {formatCurrency(
                                payments.data
                                    .filter(p => !isRefund(p))
                                    .reduce((sum, p) => sum + Math.abs(p.amount), 0)
                            )}
                        </div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Refunds</div>
                        <div className="text-2xl font-bold text-destructive">
                            {formatCurrency(
                                payments.data
                                    .filter(p => isRefund(p))
                                    .reduce((sum, p) => sum + Math.abs(p.amount), 0)
                            )}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-lg border">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Sale Number</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Method</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Received By</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.data.map((payment) => (
                                    <tr key={payment.id} className="border-b hover:bg-accent">
                                        <td className="px-4 py-3 text-sm">
                                            {new Date(payment.received_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium">
                                            {payment.sale.sale_number}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {isRefund(payment) ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                                                    Refund
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                                                    Payment
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm capitalize">{payment.payment_method}</td>
                                        <td className={`px-4 py-3 text-sm text-right font-medium ${isRefund(payment) ? 'text-destructive' : ''}`}>
                                            {isRefund(payment) ? '-' : ''}{formatCurrency(Math.abs(payment.amount))}
                                        </td>
                                        <td className="px-4 py-3 text-sm">{payment.received_by.name}</td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">{payment.notes || '-'}</td>
                                    </tr>
                                ))}
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
                        currentPage={payments.current_page}
                        totalPages={payments.last_page}
                        onPageChange={handlePageChange}
                    />
                </div>
            </div>
        </AppLayout>
    );
}

