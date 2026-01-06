import { Head } from '@inertiajs/react';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import { TrendingUp, TrendingDown } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Inventory Movements Report',
        href: '/reports/inventory-movements',
    },
];

interface User {
    id: number;
    name: string;
}

interface Product {
    id: number;
    name: string;
}

interface ProductVariant {
    id: number;
    description: string;
    product: Product;
}

interface InventoryMovement {
    id: number;
    quantity: number;
    type: 'IN' | 'OUT';
    reason: string;
    reference_id: number | null;
    unit_cost: number;
    notes: string | null;
    created_at: string;
    product_variant: ProductVariant;
    recorded_by: User;
}

interface InventoryMovementsReportProps {
    movements: {
        data: InventoryMovement[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    variants: ProductVariant[];
    filters: {
        date_from?: string;
        date_to?: string;
        type?: string;
        product_variant_id?: string;
        reason?: string;
    };
}

export default function InventoryMovementsReport({ movements, variants, filters }: InventoryMovementsReportProps) {
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters?.date_to ?? '');
    const [type, setType] = useState(filters.type || 'all');
    const [variantId, setVariantId] = useState(filters.product_variant_id || 'all');
    const [reason, setReason] = useState(filters.reason || 'all');
    const [perPage, setPerPage] = useState(String(filters?.per_page ?? 15));

    const triggerFetch = useCallback((params: any = {}) => {
        const currentDateFrom = params.date_from !== undefined ? params.date_from : dateFrom;
        const currentDateTo = params.date_to !== undefined ? params.date_to : dateTo;
        const currentType = params.type !== undefined ? params.type : type;
        const currentVariantId = params.product_variant_id !== undefined ? params.product_variant_id : variantId;
        const currentReason = params.reason !== undefined ? params.reason : reason;
        
        router.get('/reports/inventory-movements', {
            page: params.page || movements?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            date_from: currentDateFrom || undefined,
            date_to: currentDateTo || undefined,
            type: currentType === 'all' ? undefined : currentType,
            product_variant_id: currentVariantId === 'all' ? undefined : currentVariantId,
            reason: currentReason === 'all' ? undefined : currentReason,
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [dateFrom, dateTo, type, variantId, reason, perPage, movements?.current_page]);

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

    // Get unique reasons from movements
    const uniqueReasons = Array.from(new Set(movements.data.map(m => m.reason))).filter(Boolean);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Inventory Movements Report" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div>
                    <h1 className="text-2xl font-bold">Inventory Movements Report</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Complete audit trail of all inventory movements
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
                                <SelectItem value="IN">Stock In</SelectItem>
                                <SelectItem value="OUT">Stock Out</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Product Variant</label>
                        <Select 
                            value={variantId} 
                            onValueChange={(value) => { 
                                setVariantId(value); 
                                triggerFetch({ product_variant_id: value, page: 1 }); 
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Variants" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Variants</SelectItem>
                                {variants.map((variant) => (
                                    <SelectItem key={variant.id} value={String(variant.id)}>
                                        {variant.product.name} - {variant.description}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Reason</label>
                        <Select 
                            value={reason} 
                            onValueChange={(value) => { 
                                setReason(value); 
                                triggerFetch({ reason: value, page: 1 }); 
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Reasons" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Reasons</SelectItem>
                                {uniqueReasons.map((r) => (
                                    <SelectItem key={r} value={r}>
                                        {r}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Stock In</div>
                        <div className="text-2xl font-bold text-green-600">
                            {movements.data.filter(m => m.type === 'IN').reduce((sum, m) => sum + parseFloat(String(m.quantity)), 0)}
                        </div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Stock Out</div>
                        <div className="text-2xl font-bold text-red-600">
                            {movements.data.filter(m => m.type === 'OUT').reduce((sum, m) => sum + parseFloat(String(m.quantity)), 0)}
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
                                    <th className="px-4 py-3 text-left text-sm font-medium">Product</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Quantity</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Reason</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Recorded By</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.data.map((movement) => (
                                    <tr key={movement.id} className="border-b hover:bg-accent">
                                        <td className="px-4 py-3 text-sm">
                                            {new Date(movement.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div>
                                                <div className="font-medium">{movement.product_variant.product.name}</div>
                                                <div className="text-xs text-muted-foreground">{movement.product_variant.description}</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {movement.type === 'IN' ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                                                    <TrendingUp className="h-3 w-3 mr-1" />
                                                    IN
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                                                    <TrendingDown className="h-3 w-3 mr-1" />
                                                    OUT
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium">
                                            {movement.quantity}
                                        </td>
                                        <td className="px-4 py-3 text-sm">{movement.reason}</td>
                                        <td className="px-4 py-3 text-sm">{movement.recorded_by.name}</td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">{movement.notes || '-'}</td>
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
                        currentPage={movements.current_page}
                        totalPages={movements.last_page}
                        onPageChange={handlePageChange}
                    />
                </div>
            </div>
        </AppLayout>
    );
}

