import { Head } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { formatCurrency, formatNumber } from '@/lib/format-currency';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Inventory',
        href: '/inventory',
    },
    {
        title: 'Movement History',
        href: '/inventory/movements',
    },
];

interface ProductCategory {
    id: number;
    name: string;
}

interface Product {
    id: number;
    name: string;
    category: ProductCategory;
}

interface ProductVariant {
    id: number;
    description: string;
    product: Product;
}

interface User {
    id: number;
    name: string;
    email: string;
}

interface InventoryMovement {
    id: number;
    quantity: number;
    type: 'IN' | 'OUT';
    reason: string;
    unit_cost: number | null;
    notes: string | null;
    created_at: string;
    product_variant: ProductVariant;
    recorded_by: User;
}

interface MovementHistoryProps {
    movements: {
        data: InventoryMovement[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    reasons: string[];
    products: Array<{
        id: number;
        name: string;
    }>;
    filters: {
        search?: string;
        product_id?: number;
        date_from?: string;
        date_to?: string;
        reason?: string;
        type?: 'IN' | 'OUT';
        per_page?: number;
    };
}

const STORAGE_KEY = 'inventory_movements_perPage';

export default function MovementHistory({ movements, reasons, products, filters }: MovementHistoryProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [selectedProduct, setSelectedProduct] = useState(filters.product_id?.toString() || '');
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters?.date_to ?? '');
    const [selectedReason, setSelectedReason] = useState(filters.reason || '');
    const [selectedType, setSelectedType] = useState(filters.type || '');
    const [perPage, setPerPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && PER_PAGE_OPTIONS.includes(saved as any)) {
                return saved;
            }
        }
        return String(filters?.per_page ?? 20);
    });

    const triggerFetch = useCallback((params: any = {}) => {
        router.get('/inventory/movements', {
            page: params.page || movements?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            search: params.search !== undefined ? params.search : debouncedSearch,
            product_id: params.product_id !== undefined ? params.product_id : (selectedProduct || undefined),
            date_from: params.date_from !== undefined ? params.date_from : (dateFrom ? dateFrom : undefined),
            date_to: params.date_to !== undefined ? params.date_to : (dateTo ? dateTo : undefined),
            reason: params.reason !== undefined ? params.reason : (selectedReason || undefined),
            type: params.type !== undefined ? params.type : (selectedType || undefined),
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [debouncedSearch, selectedProduct, dateFrom, dateTo, selectedReason, selectedType, perPage, movements?.current_page]);

    useEffect(() => {
        triggerFetch({ page: 1 });
    }, [debouncedSearch, selectedProduct, dateFrom, dateTo, selectedReason, selectedType]);

    const handlePerPageChange = (value: string) => {
        const valueInt = parseInt(value, 10);
        setPerPage(value);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, value);
        }
        triggerFetch({ per_page: valueInt, page: 1 });
    };

    const handlePageChange = (page: number) => {
        triggerFetch({ page });
    };

    const handleClearFilters = () => {
        setSearch('');
        setSelectedProduct('');
        setDateFrom('');
        setDateTo('');
        setSelectedReason('');
        setSelectedType('');
        triggerFetch({
            search: '',
            product_id: undefined,
            date_from: undefined,
            date_to: undefined,
            reason: undefined,
            type: undefined,
            page: 1,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Inventory Movement History" />
            <div className="flex flex-col overflow-hidden bg-background" style={{ height: 'calc(100vh - 80px)' }}>
                {/* Top Section - Controls (Fixed Height) */}
                <div className="flex-shrink-0 bg-card border-b border-border shadow-sm z-40 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-bold">Inventory Movement History</h1>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2 mb-2">
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                        <select
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        >
                            <option value="">All Products</option>
                            {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                    {product.name}
                                </option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => {
                                const value = e.target.value;
                                setDateFrom(value);
                                triggerFetch({ date_from: value || undefined, page: 1 });
                            }}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            placeholder="From Date"
                        />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => {
                                const value = e.target.value;
                                setDateTo(value);
                                triggerFetch({ date_to: value || undefined, page: 1 });
                            }}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            placeholder="To Date"
                        />
                        <select
                            value={selectedReason}
                            onChange={(e) => setSelectedReason(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        >
                            <option value="">All Reasons</option>
                            {reasons.map((reason) => (
                                <option key={reason} value={reason}>
                                    {reason}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        >
                            <option value="">All Types</option>
                            <option value="IN">IN</option>
                            <option value="OUT">OUT</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearFilters}
                        >
                            Clear Filters
                        </Button>
                        <RowsPerPageSelector
                            perPage={perPage}
                            onPerPageChange={handlePerPageChange}
                            storageKey={STORAGE_KEY}
                        />
                    </div>
                </div>

                {/* Table Container - Dynamic Expansion */}
                <div className="flex-1 min-h-0 bg-background overflow-y-auto">
                    <div className="p-4">
                        <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Date</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Product</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Variant</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Type</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Quantity</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Unit Cost</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Reason</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Recorded By</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
                                        {movements.data.map((movement) => (
                                            <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {new Date(movement.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {movement.product_variant.product.name}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {movement.product_variant.description}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {movement.type === 'IN' ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                                                            <TrendingUp className="h-3 w-3" />
                                                            IN
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
                                                            <TrendingDown className="h-3 w-3" />
                                                            OUT
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                                                    {formatNumber(movement.quantity)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {movement.unit_cost ? `₱${formatCurrency(movement.unit_cost)}` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {movement.reason}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {movement.recorded_by.name}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={movement.notes || ''}>
                                                    {movement.notes || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {movements.data.length === 0 && (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No inventory movements found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pagination - Fixed at bottom of viewport */}
                <div className="flex-shrink-0 bg-card border-t border-border shadow-sm z-30">
                    {movements.data.length > 0 && (
                        <Pagination
                            currentPage={movements.current_page}
                            lastPage={movements.last_page}
                            total={movements.total}
                            perPage={movements.per_page}
                            onPageChange={handlePageChange}
                            filters={{
                                search: debouncedSearch,
                                product_id: selectedProduct || undefined,
                                date_from: dateFrom ? dateFrom : undefined,
                                date_to: dateTo ? dateTo : undefined,
                                reason: selectedReason || undefined,
                                type: selectedType || undefined,
                            }}
                        />
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
