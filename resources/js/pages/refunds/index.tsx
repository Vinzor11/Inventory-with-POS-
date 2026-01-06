import { Head } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import { Search, RefreshCw, Eye } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { formatCurrency } from '@/lib/format-currency';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Refunds',
        href: '/refunds',
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

interface SaleItem {
    id: number;
    product_variant: ProductVariant;
}

interface RefundItem {
    id: number;
    quantity: number;
    amount: number;
    restore_inventory: boolean;
    sale_item: SaleItem;
}

interface Refund {
    id: number;
    sale: {
        id: number;
        sale_number: string;
    };
    refund_amount: number;
    reason: string | null;
    type: 'full' | 'partial';
    processed_by: User;
    created_at: string;
    items: RefundItem[];
}

interface RefundsIndexProps {
    refunds: {
        data: Refund[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        search?: string;
        per_page?: number;
    };
}

const STORAGE_KEY = 'refunds_perPage';

export default function RefundsIndex({ refunds, filters }: RefundsIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [perPage, setPerPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && PER_PAGE_OPTIONS.includes(saved as any)) {
                return saved;
            }
        }
        return String(filters?.per_page ?? 15);
    });

    const triggerFetch = useCallback((params: any = {}) => {
        router.get('/refunds', {
            page: params.page || refunds?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            search: params.search !== undefined ? params.search : debouncedSearch,
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [debouncedSearch, perPage, refunds?.current_page]);

    useEffect(() => {
        triggerFetch({ search: debouncedSearch, page: 1 });
    }, [debouncedSearch]);

    const handlePerPageChange = (value: number) => {
        const valueStr = String(value);
        setPerPage(valueStr);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, valueStr);
        }
        triggerFetch({ per_page: value, page: 1 });
    };

    const handlePageChange = (page: number) => {
        triggerFetch({ page });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Refund History" />
            <div className="flex flex-col overflow-hidden bg-background" style={{ height: 'calc(100vh - 80px)' }}>
                <div className="flex-shrink-0 bg-card border-b border-border shadow-sm z-40 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">Refund History</h1>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Search by sale number..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 w-[250px]"
                            />
                        </div>
                        <RowsPerPageSelector
                            perPage={perPage}
                            onPerPageChange={(value) => handlePerPageChange(parseInt(value, 10))}
                            storageKey={STORAGE_KEY}
                        />
                    </div>
                </div>

                <div className="flex-1 min-h-0 bg-background overflow-y-auto">
                    <div className="p-4">
                        <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Refund ID</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Sale Number</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Refund Amount</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Type</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Items</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Processed By</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Date</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
                                        {refunds.data.length > 0 ? (
                                            refunds.data.map((refund) => (
                                                <tr key={refund.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        #{refund.id}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        {refund.sale.sale_number}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        <span className="font-semibold text-red-600">
                                                            ₱{formatCurrency(refund.refund_amount)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                            refund.type === 'full'
                                                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                                : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                                        }`}>
                                                            {refund.type === 'full' ? 'Full' : 'Partial'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        {refund.items.length} item(s)
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        {refund.processed_by.name}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        {new Date(refund.created_at).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => router.visit(`/sales/${refund.sale.id}`)}
                                                            title="View sale"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                                    <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                    <p>No refunds found</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {refunds.total > 0 && (
                            <div className="mt-4 flex items-center justify-between">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    Showing {((refunds.current_page - 1) * refunds.per_page) + 1} to{' '}
                                    {Math.min(refunds.current_page * refunds.per_page, refunds.total)} of {refunds.total} refunds
                                </div>
                                <Pagination
                                    currentPage={refunds.current_page}
                                    totalPages={refunds.last_page}
                                    onPageChange={handlePageChange}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

