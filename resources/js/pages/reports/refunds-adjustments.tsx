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
import { MobileRecordCard, MobileRecordRow } from '@/components/mobile/record-card';
import { FilterSheetButton } from '@/components/mobile/filter-sheet-button';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Refunds & Adjustments Report',
        href: '/reports/refunds-adjustments',
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

interface Refund {
    id: number;
    refund_amount: number;
    reason: string | null;
    type: string;
    created_at: string;
    sale: Sale;
    processed_by: User;
}

interface SaleAdjustment {
    id: number;
    amount_removed: number;
    canceled_quantity: number;
    reason: string | null;
    created_at: string;
    sale: Sale;
    processed_by: User;
    sale_item: {
        id: number;
        product_variant: {
            description: string;
            product: {
                name: string;
            };
        };
    };
}

interface RefundsAdjustmentsReportProps {
    refunds: {
        data: Refund[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    adjustments: {
        data: SaleAdjustment[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        date_from?: string;
        date_to?: string;
        sale_id?: string;
    };
}

export default function RefundsAdjustmentsReport({ refunds, adjustments, filters }: RefundsAdjustmentsReportProps) {
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters?.date_to ?? '');
    const [activeTab, setActiveTab] = useState<'refunds' | 'adjustments'>('refunds');
    const [perPage, setPerPage] = useState(String(filters?.per_page ?? 15));

    const triggerFetch = useCallback((params: any = {}) => {
        const currentDateFrom = params.date_from !== undefined ? params.date_from : dateFrom;
        const currentDateTo = params.date_to !== undefined ? params.date_to : dateTo;
        
        router.get('/reports/refunds-adjustments', {
            page: params.page || (activeTab === 'refunds' ? refunds?.current_page : adjustments?.current_page) || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            date_from: currentDateFrom || undefined,
            date_to: currentDateTo || undefined,
            sale_id: params.sale_id !== undefined ? params.sale_id : filters.sale_id || undefined,
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [dateFrom, dateTo, perPage, activeTab, refunds?.current_page, adjustments?.current_page, filters.sale_id]);

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

    const currentData = activeTab === 'refunds' ? refunds : adjustments;
    const hasActiveFilters = Boolean(dateFrom) || Boolean(dateTo);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Refunds & Adjustments Report" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div>
                    <h1 className="hidden text-2xl font-bold md:block">Refunds & Adjustments Report</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Complete audit trail of refunds and sale adjustments
                    </p>
                </div>

                {/* Filters */}
                <div className="flex justify-end md:hidden">
                    <FilterSheetButton title="Report Filters" isActive={hasActiveFilters}>
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
                    </FilterSheetButton>
                </div>

                <div className="hidden gap-4 md:grid md:grid-cols-2">
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
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b">
                    <Button
                        variant={activeTab === 'refunds' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('refunds')}
                    >
                        Refunds ({refunds.total})
                    </Button>
                    <Button
                        variant={activeTab === 'adjustments' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('adjustments')}
                    >
                        Adjustments ({adjustments.total})
                    </Button>
                </div>

                {/* Summary */}
                {activeTab === 'refunds' && (
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Refunded</div>
                        <div className="text-2xl font-bold text-destructive">
                            {formatCurrency(refunds.data.reduce((sum, r) => sum + r.refund_amount, 0))}
                        </div>
                    </div>
                )}

                {activeTab === 'adjustments' && (
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Amount Removed</div>
                        <div className="text-2xl font-bold text-destructive">
                            {formatCurrency(adjustments.data.reduce((sum, a) => sum + a.amount_removed, 0))}
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="space-y-3 md:hidden">
                    {activeTab === 'refunds'
                        ? refunds.data.map((refund) => (
                            <MobileRecordCard
                                key={refund.id}
                                title={refund.sale.sale_number}
                                subtitle={refund.processed_by.name}
                                value={formatCurrency(refund.refund_amount)}
                                badges={[
                                    {
                                        label: refund.type === 'full' ? 'Full' : 'Partial',
                                        className:
                                            refund.type === 'full'
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                                                : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
                                    },
                                ]}
                            >
                                <MobileRecordRow
                                    label="Date"
                                    value={new Date(refund.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                />
                                <MobileRecordRow label="Reason" value={refund.reason || '-'} />
                            </MobileRecordCard>
                        ))
                        : adjustments.data.map((adjustment) => (
                            <MobileRecordCard
                                key={adjustment.id}
                                title={adjustment.sale.sale_number}
                                subtitle={adjustment.processed_by.name}
                                value={formatCurrency(adjustment.amount_removed)}
                                badges={[{ label: 'Adjustment', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' }]}
                            >
                                <MobileRecordRow
                                    label="Date"
                                    value={new Date(adjustment.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                />
                                <MobileRecordRow
                                    label="Item"
                                    value={`${adjustment.sale_item.product_variant.product.name} - ${adjustment.sale_item.product_variant.description}`}
                                />
                                <MobileRecordRow label="Qty Canceled" value={String(adjustment.canceled_quantity)} />
                                <MobileRecordRow label="Reason" value={adjustment.reason || '-'} />
                            </MobileRecordCard>
                        ))}
                </div>

                <div className="hidden rounded-lg border md:block">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                {activeTab === 'refunds' ? (
                                    <tr className="border-b">
                                        <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium">Sale Number</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium">Processed By</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium">Reason</th>
                                    </tr>
                                ) : (
                                    <tr className="border-b">
                                        <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium">Sale Number</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium">Item</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium">Qty Canceled</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium">Amount Removed</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium">Processed By</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium">Reason</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {activeTab === 'refunds' ? (
                                    refunds.data.map((refund) => (
                                        <tr key={refund.id} className="border-b hover:bg-accent">
                                            <td className="px-4 py-3 text-sm">
                                                {new Date(refund.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium">
                                                {refund.sale.sale_number}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                    refund.type === 'full' 
                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                                                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200'
                                                }`}>
                                                    {refund.type === 'full' ? 'Full' : 'Partial'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-medium text-destructive">
                                                {formatCurrency(refund.refund_amount)}
                                            </td>
                                            <td className="px-4 py-3 text-sm">{refund.processed_by.name}</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{refund.reason || '-'}</td>
                                        </tr>
                                    ))
                                ) : (
                                    adjustments.data.map((adjustment) => (
                                        <tr key={adjustment.id} className="border-b hover:bg-accent">
                                            <td className="px-4 py-3 text-sm">
                                                {new Date(adjustment.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium">
                                                {adjustment.sale.sale_number}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {adjustment.sale_item.product_variant.product.name} - {adjustment.sale_item.product_variant.description}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">{adjustment.canceled_quantity}</td>
                                            <td className="px-4 py-3 text-sm text-right font-medium text-destructive">
                                                {formatCurrency(adjustment.amount_removed)}
                                            </td>
                                            <td className="px-4 py-3 text-sm">{adjustment.processed_by.name}</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{adjustment.reason || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="hidden md:block">
                    <Pagination
                        currentPage={currentData.current_page}
                        lastPage={currentData.last_page}
                        total={currentData.total}
                        perPage={currentData.per_page}
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
                        currentPage={currentData.current_page}
                        lastPage={currentData.last_page}
                        total={currentData.total}
                        perPage={currentData.per_page}
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


