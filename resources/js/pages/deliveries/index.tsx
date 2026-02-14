import { FilterSheetButton } from '@/components/mobile/filter-sheet-button';
import {
    RecordActionsSheet,
    type RecordActionItem,
} from '@/components/mobile/record-actions-sheet';
import {
    MobileRecordCard,
    MobileRecordRow,
} from '@/components/mobile/record-card';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
    PER_PAGE_OPTIONS,
    RowsPerPageSelector,
} from '@/components/ui/rows-per-page-selector';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { fetchDeliveryReceiptText, shareReceipt } from '@/lib/receipt-print';
import { toast } from '@/lib/toast';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Eye, Printer } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Deliveries',
        href: '/deliveries',
    },
];

interface User {
    id: number;
    name: string;
}

interface SaleDelivery {
    id: number;
    sale_number: string;
    delivery_status:
        | 'pending'
        | 'partial'
        | 'delivered'
        | 'canceled'
        | 'returned';
    delivered_at: string | null;
    delivered_by: User | null;
    total_items: number;
    delivery_count: number;
    latest_delivery_id?: number | null;
}

interface DeliveriesIndexProps {
    deliveries: {
        data: SaleDelivery[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        search?: string;
        status?: string;
        per_page?: number;
    };
}

const STORAGE_KEY = 'deliveries_perPage';

export default function DeliveriesIndex({
    deliveries,
    filters,
}: DeliveriesIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
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
                '/deliveries',
                {
                    page: params.page || deliveries?.current_page || 1,
                    per_page: params.per_page || parseInt(perPage, 10),
                    search:
                        params.search !== undefined
                            ? params.search
                            : debouncedSearch,
                    status:
                        params.status !== undefined
                            ? params.status
                            : statusFilter === 'all'
                              ? undefined
                              : statusFilter,
                    ...params,
                },
                {
                    preserveState: true,
                    preserveScroll: false,
                    replace: true,
                },
            );
        },
        [debouncedSearch, statusFilter, perPage, deliveries?.current_page],
    );

    useEffect(() => {
        triggerFetch({
            search: debouncedSearch,
            status: statusFilter === 'all' ? undefined : statusFilter,
            page: 1,
        });
    }, [debouncedSearch, statusFilter]);

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

    // Receipt state
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
    const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(
        null,
    );

    const handlePrintReceipt = async (
        deliveryId: number | null | undefined,
    ) => {
        if (!deliveryId) {
            toast.error('No delivery found to print');
            return;
        }

        setSelectedDeliveryId(deliveryId);
        setIsLoadingReceipt(true);
        try {
            // Fetch ESC/POS formatted receipt (has bold commands)
            const text = await fetchDeliveryReceiptText(deliveryId, 80);
            // Directly share to RawBT
            await shareReceipt(text);
        } catch (error) {
            console.error('Failed to print receipt:', error);
            toast.error('Failed to print receipt');
        } finally {
            setIsLoadingReceipt(false);
            setSelectedDeliveryId(null);
        }
    };

    const hasActiveFilters = statusFilter !== 'all';

    const mobileHeaderControls = (
        <>
            <input
                type="text"
                placeholder="Search by sale number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="app-search-surface h-10 min-w-0 flex-1 px-3 text-sm"
            />
            <FilterSheetButton
                title="Delivery Filters"
                isActive={hasActiveFilters}
            >
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                    </SelectContent>
                </Select>
            </FilterSheetButton>
        </>
    );

    return (
        <AppLayout
            breadcrumbs={breadcrumbs}
            mobileHeaderContent={mobileHeaderControls}
        >
            <Head title="Deliveries" />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
                <div className="z-40 hidden flex-shrink-0 border-b border-border bg-card px-3 py-2.5 shadow-sm md:block md:space-y-4 md:p-4">
                    <div className="hidden items-center justify-between md:flex">
                        <h1 className="hidden text-2xl font-bold md:block">
                            Deliveries
                        </h1>
                    </div>

                    <div className="hidden items-center gap-2 md:flex">
                        <input
                            type="text"
                            placeholder="Search by sale number..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none md:py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                        <div className="hidden items-center gap-2 md:flex">
                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value)
                                }
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="partial">Partial</option>
                                <option value="delivered">Delivered</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-background">
                    <div className="p-4">
                        <div className="space-y-3 md:hidden">
                            {deliveries.data.length > 0 ? (
                                deliveries.data.map((saleDelivery) => {
                                    const statusClass =
                                        saleDelivery.delivery_status ===
                                        'delivered'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                            : saleDelivery.delivery_status ===
                                                'partial'
                                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                              : saleDelivery.delivery_status ===
                                                  'canceled'
                                                ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
                                    const statusLabel =
                                        saleDelivery.delivery_status
                                            .charAt(0)
                                            .toUpperCase() +
                                        saleDelivery.delivery_status.slice(1);

                                    const actions: RecordActionItem[] = [];
                                    if (saleDelivery.latest_delivery_id) {
                                        actions.push({
                                            key: 'print',
                                            label: 'Print Receipt',
                                            icon: (
                                                <Printer className="h-4 w-4" />
                                            ),
                                            onClick: () =>
                                                handlePrintReceipt(
                                                    saleDelivery.latest_delivery_id,
                                                ),
                                            disabled:
                                                isLoadingReceipt &&
                                                selectedDeliveryId ===
                                                    saleDelivery.latest_delivery_id,
                                        });
                                    }

                                    return (
                                        <MobileRecordCard
                                            key={saleDelivery.id}
                                            title={saleDelivery.sale_number}
                                            subtitle={
                                                saleDelivery.delivery_count > 1
                                                    ? `${saleDelivery.delivery_count} deliveries`
                                                    : undefined
                                            }
                                            value={`${saleDelivery.total_items} item(s)`}
                                            badges={[
                                                {
                                                    label: statusLabel,
                                                    className: statusClass,
                                                },
                                            ]}
                                            footer={
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        className="h-11 flex-1"
                                                        onClick={() =>
                                                            router.visit(
                                                                `/sales/${saleDelivery.id}/delivery`,
                                                            )
                                                        }
                                                    >
                                                        View Details
                                                    </Button>
                                                    <RecordActionsSheet
                                                        title={
                                                            saleDelivery.sale_number
                                                        }
                                                        description="Delivery actions"
                                                        actions={actions}
                                                    />
                                                </div>
                                            }
                                        >
                                            <MobileRecordRow
                                                label="Delivered By"
                                                value={
                                                    saleDelivery.delivered_by
                                                        ?.name || 'Not assigned'
                                                }
                                            />
                                            <MobileRecordRow
                                                label="Delivered At"
                                                value={
                                                    saleDelivery.delivered_at
                                                        ? new Date(
                                                              saleDelivery.delivered_at,
                                                          ).toLocaleDateString(
                                                              'en-US',
                                                              {
                                                                  month: 'short',
                                                                  day: 'numeric',
                                                                  year: 'numeric',
                                                              },
                                                          )
                                                        : 'Pending'
                                                }
                                            />
                                        </MobileRecordCard>
                                    );
                                })
                            ) : (
                                <div className="rounded-xl border border-sidebar-border/70 bg-card p-8 text-center text-gray-500 dark:border-sidebar-border dark:text-gray-400">
                                    No deliveries found.
                                </div>
                            )}
                        </div>

                        <div className="hidden rounded-xl border border-sidebar-border/70 md:block dark:border-sidebar-border">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Sale Number
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Delivered By
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Delivered At
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Status
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Items
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
                                        {deliveries.data.map((saleDelivery) => (
                                            <tr
                                                key={saleDelivery.id}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-800"
                                            >
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {saleDelivery.sale_number}
                                                    {saleDelivery.delivery_count >
                                                        1 && (
                                                        <span className="ml-2 text-xs text-gray-500">
                                                            (
                                                            {
                                                                saleDelivery.delivery_count
                                                            }{' '}
                                                            deliveries)
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {saleDelivery.delivered_by
                                                        ?.name ||
                                                        'Not assigned'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {saleDelivery.delivered_at
                                                        ? new Date(
                                                              saleDelivery.delivered_at,
                                                          ).toLocaleString()
                                                        : 'Pending'}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span
                                                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                                                            saleDelivery.delivery_status ===
                                                            'delivered'
                                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                                : saleDelivery.delivery_status ===
                                                                    'partial'
                                                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                                  : saleDelivery.delivery_status ===
                                                                      'canceled'
                                                                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                        }`}
                                                    >
                                                        {
                                                            saleDelivery.delivery_status
                                                        }
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {saleDelivery.total_items}{' '}
                                                    item(s)
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        {saleDelivery.latest_delivery_id && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0"
                                                                title="Print receipt"
                                                                onClick={() =>
                                                                    handlePrintReceipt(
                                                                        saleDelivery.latest_delivery_id,
                                                                    )
                                                                }
                                                                disabled={
                                                                    isLoadingReceipt &&
                                                                    selectedDeliveryId ===
                                                                        saleDelivery.latest_delivery_id
                                                                }
                                                            >
                                                                <Printer className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            title="View details"
                                                            onClick={() =>
                                                                router.visit(
                                                                    `/sales/${saleDelivery.id}/delivery`,
                                                                )
                                                            }
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {deliveries.data.length === 0 && (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No deliveries found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="z-30 flex-shrink-0 border-t border-border bg-card shadow-sm">
                    {deliveries.data.length > 0 && (
                        <Pagination
                            currentPage={deliveries.current_page}
                            lastPage={deliveries.last_page}
                            total={deliveries.total}
                            perPage={deliveries.per_page}
                            onPageChange={handlePageChange}
                            filters={{
                                search: debouncedSearch,
                                status:
                                    statusFilter === 'all'
                                        ? undefined
                                        : statusFilter,
                            }}
                            pageSizeSelector={
                                <RowsPerPageSelector
                                    perPage={perPage}
                                    onPerPageChange={(value) =>
                                        handlePerPageChange(parseInt(value, 10))
                                    }
                                    storageKey={STORAGE_KEY}
                                />
                            }
                        />
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
