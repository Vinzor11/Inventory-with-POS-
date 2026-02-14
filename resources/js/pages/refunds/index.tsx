import {
    MobileRecordCard,
    MobileRecordRow,
} from '@/components/mobile/record-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
    PER_PAGE_OPTIONS,
    RowsPerPageSelector,
} from '@/components/ui/rows-per-page-selector';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { formatCurrency } from '@/lib/format-currency';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Eye, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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

    const triggerFetch = useCallback(
        (params: any = {}) => {
            router.get(
                '/refunds',
                {
                    page: params.page || refunds?.current_page || 1,
                    per_page: params.per_page || parseInt(perPage, 10),
                    search:
                        params.search !== undefined
                            ? params.search
                            : debouncedSearch,
                    ...params,
                },
                {
                    preserveState: true,
                    preserveScroll: false,
                    replace: true,
                },
            );
        },
        [debouncedSearch, perPage, refunds?.current_page],
    );

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

    const mobileHeaderControls = (
        <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
                type="text"
                placeholder="Search by sale number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="app-search-surface h-10 w-full pl-10 text-sm"
            />
        </div>
    );

    return (
        <AppLayout
            breadcrumbs={breadcrumbs}
            mobileHeaderContent={mobileHeaderControls}
        >
            <Head title="Refund History" />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
                <div className="z-40 hidden flex-shrink-0 border-b border-border bg-card px-3 py-2.5 shadow-sm md:block md:space-y-4 md:p-4">
                    <div className="hidden items-center justify-between md:flex">
                        <h1 className="hidden text-2xl font-bold md:block">
                            Refund History
                        </h1>
                    </div>

                    <div className="hidden items-center gap-2 md:flex">
                        <div className="relative min-w-0 flex-1 md:flex-none">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Search by sale number..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 w-full pl-10 md:h-10 md:w-[250px]"
                            />
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-background">
                    <div className="p-4">
                        <div className="space-y-3 md:hidden">
                            {refunds.data.length > 0 ? (
                                refunds.data.map((refund) => (
                                    <MobileRecordCard
                                        key={refund.id}
                                        title={`#${refund.id}`}
                                        subtitle={refund.sale.sale_number}
                                        value={
                                            <span className="text-red-600">
                                                â‚±
                                                {formatCurrency(
                                                    refund.refund_amount,
                                                )}
                                            </span>
                                        }
                                        badges={[
                                            {
                                                label:
                                                    refund.type === 'full'
                                                        ? 'Full'
                                                        : 'Partial',
                                                className:
                                                    refund.type === 'full'
                                                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
                                            },
                                        ]}
                                        footer={
                                            <Button
                                                type="button"
                                                className="h-11 w-full"
                                                onClick={() =>
                                                    router.visit(
                                                        `/sales/${refund.sale.id}`,
                                                    )
                                                }
                                            >
                                                View Sale
                                            </Button>
                                        }
                                    >
                                        <MobileRecordRow
                                            label="Items"
                                            value={`${refund.items.length} item(s)`}
                                        />
                                        <MobileRecordRow
                                            label="Processed By"
                                            value={refund.processed_by.name}
                                        />
                                        <MobileRecordRow
                                            label="Date"
                                            value={new Date(
                                                refund.created_at,
                                            ).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        />
                                    </MobileRecordCard>
                                ))
                            ) : (
                                <div className="rounded-xl border border-sidebar-border/70 bg-card px-4 py-12 text-center text-gray-500 dark:border-sidebar-border dark:text-gray-400">
                                    <RefreshCw className="mx-auto mb-4 h-12 w-12 opacity-50" />
                                    <p>No refunds found</p>
                                </div>
                            )}
                        </div>

                        <div className="hidden rounded-xl border border-sidebar-border/70 md:block dark:border-sidebar-border">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Refund ID
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Sale Number
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Refund Amount
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Type
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Items
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Processed By
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Date
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
                                        {refunds.data.length > 0 ? (
                                            refunds.data.map((refund) => (
                                                <tr
                                                    key={refund.id}
                                                    className="hover:bg-gray-50 dark:hover:bg-gray-800"
                                                >
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        #{refund.id}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        {
                                                            refund.sale
                                                                .sale_number
                                                        }
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        <span className="font-semibold text-red-600">
                                                            â‚±
                                                            {formatCurrency(
                                                                refund.refund_amount,
                                                            )}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span
                                                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                                                                refund.type ===
                                                                'full'
                                                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                                    : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                                            }`}
                                                        >
                                                            {refund.type ===
                                                            'full'
                                                                ? 'Full'
                                                                : 'Partial'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        {refund.items.length}{' '}
                                                        item(s)
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        {
                                                            refund.processed_by
                                                                .name
                                                        }
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        {new Date(
                                                            refund.created_at,
                                                        ).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                router.visit(
                                                                    `/sales/${refund.sale.id}`,
                                                                )
                                                            }
                                                            title="View sale"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td
                                                    colSpan={8}
                                                    className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                                                >
                                                    <RefreshCw className="mx-auto mb-4 h-12 w-12 opacity-50" />
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
                                    Showing{' '}
                                    {(refunds.current_page - 1) *
                                        refunds.per_page +
                                        1}{' '}
                                    to{' '}
                                    {Math.min(
                                        refunds.current_page * refunds.per_page,
                                        refunds.total,
                                    )}{' '}
                                    of {refunds.total} refunds
                                </div>
                                <Pagination
                                    currentPage={refunds.current_page}
                                    lastPage={refunds.last_page}
                                    total={refunds.total}
                                    perPage={refunds.per_page}
                                    onPageChange={handlePageChange}
                                    pageSizeSelector={
                                        <RowsPerPageSelector
                                            perPage={perPage}
                                            onPerPageChange={(value) =>
                                                handlePerPageChange(
                                                    parseInt(value, 10),
                                                )
                                            }
                                            storageKey={STORAGE_KEY}
                                        />
                                    }
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
