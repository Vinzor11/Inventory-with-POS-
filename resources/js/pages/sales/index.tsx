import { FilterSheetButton } from '@/components/mobile/filter-sheet-button';
import { MobileRecordCard } from '@/components/mobile/record-card';
import { ProductImage } from '@/components/product-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { formatCurrency } from '@/lib/format-currency';
import { fetchSalesReceiptText, shareReceipt } from '@/lib/receipt-print';
import { toast } from '@/lib/toast';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronUp,
    Eye,
    Printer,
    Receipt,
    RefreshCw,
    Search,
    Truck,
    XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Sales',
        href: '/sales',
    },
];

interface User {
    id: number;
    name: string;
    email: string;
}

interface ProductCategory {
    id: number;
    name: string;
}

interface Product {
    id: number;
    name: string;
    image?: string | null;
    category: ProductCategory;
}

interface ProductVariant {
    id: number;
    description: string;
    product: Product;
}

interface SaleItem {
    id: number;
    quantity: number;
    unit_price: number;
    line_total: number;
    product_variant: ProductVariant;
}

interface Refund {
    id: number;
    refund_amount: number;
}

interface Sale {
    id: number;
    sale_number: string;
    status:
        | 'OPEN'
        | 'COMPLETED'
        | 'PARTIAL'
        | 'VOIDED'
        | 'REFUNDED'
        | 'PARTIALLY_REFUNDED';
    payment_status:
        | 'UNPAID'
        | 'PARTIALLY_PAID'
        | 'FULLY_PAID'
        | 'PARTIALLY_REFUNDED'
        | 'REFUNDED';
    is_for_delivery: boolean;
    delivery_status:
        | 'PENDING'
        | 'PARTIAL'
        | 'DELIVERED'
        | 'RETURNED'
        | 'CANCELED'
        | null;
    subtotal: number;
    total: number;
    notes: string | null;
    created_at: string;
    cashier: User;
    items_count: number;
    items?: SaleItem[];
    refunds?: Refund[];
    has_remaining_delivery?: boolean; // Whether there are items remaining to deliver
}

interface SalesIndexProps {
    sales: {
        data: Sale[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    users: User[];
    filters: {
        search?: string;
        status?: string;
        payment_status?: string;
        delivery_status?: string;
        date_from?: string;
        date_to?: string;
        per_page?: number;
    };
}

const STORAGE_KEY = 'sales_perPage';

export default function SalesIndex({ sales, users, filters }: SalesIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState(
        filters.payment_status || 'all',
    );
    const [deliveryStatusFilter, setDeliveryStatusFilter] = useState(
        filters.delivery_status || 'all',
    );
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters?.date_to ?? '');
    const [perPage, setPerPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && PER_PAGE_OPTIONS.includes(saved as any)) {
                return saved;
            }
        }
        return String(filters?.per_page ?? 15);
    });

    const [processing, setProcessing] = useState(false);
    const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);

    // Receipt state
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
    const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);

    const triggerFetch = useCallback(
        (params: any = {}) => {
            const status =
                params.status !== undefined ? params.status : statusFilter;
            const paymentStatus =
                params.payment_status !== undefined
                    ? params.payment_status
                    : paymentStatusFilter;
            const deliveryStatus =
                params.delivery_status !== undefined
                    ? params.delivery_status
                    : deliveryStatusFilter;
            router.get(
                '/sales',
                {
                    page: params.page || sales?.current_page || 1,
                    per_page: params.per_page || parseInt(perPage, 10),
                    search:
                        params.search !== undefined
                            ? params.search
                            : debouncedSearch,
                    status: status === 'all' ? undefined : status,
                    payment_status:
                        paymentStatus === 'all' ? undefined : paymentStatus,
                    delivery_status:
                        deliveryStatus === 'all' ? undefined : deliveryStatus,
                    date_from:
                        params.date_from !== undefined
                            ? params.date_from
                            : dateFrom || undefined,
                    date_to:
                        params.date_to !== undefined
                            ? params.date_to
                            : dateTo || undefined,
                    ...params,
                },
                {
                    preserveState: true,
                    preserveScroll: false,
                    replace: true,
                },
            );
        },
        [
            debouncedSearch,
            statusFilter,
            paymentStatusFilter,
            deliveryStatusFilter,
            dateFrom,
            dateTo,
            perPage,
            sales?.current_page,
        ],
    );

    const handleDateChange = (key: 'date_from' | 'date_to', value: string) => {
        if (key === 'date_from') {
            setDateFrom(value);
        } else {
            setDateTo(value);
        }
        triggerFetch({ [key]: value || undefined, page: 1 });
    };

    // Debounced search and filter effect
    useEffect(() => {
        triggerFetch({
            search: debouncedSearch,
            status: statusFilter === 'all' ? undefined : statusFilter,
            payment_status:
                paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
            delivery_status:
                deliveryStatusFilter === 'all'
                    ? undefined
                    : deliveryStatusFilter,
            page: 1,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        debouncedSearch,
        statusFilter,
        paymentStatusFilter,
        deliveryStatusFilter,
    ]);

    const handlePerPageChange = (value: number) => {
        const valueStr = String(value);
        setPerPage(valueStr);
        localStorage.setItem(STORAGE_KEY, valueStr);
        triggerFetch({ per_page: value, page: 1 });
    };

    const handlePageChange = (page: number) => {
        triggerFetch({ page });
    };

    const handleVoid = (sale: Sale) => {
        // Check if sale can be voided
        if (!canVoid(sale)) {
            toast.error(
                'This sale cannot be voided. It may have deliveries, refunds, or is already voided.',
            );
            return;
        }

        if (
            !confirm(`Are you sure you want to void sale ${sale.sale_number}?`)
        ) {
            return; // User cancelled
        }

        setProcessing(true);
        router.post(
            `/sales/${sale.id}/void`,
            {
                void_reason: null,
            },
            {
                onSuccess: () => {
                    // Flash message will be shown automatically
                    triggerFetch();
                    setProcessing(false);
                },
                onError: (errors) => {
                    const firstError = Object.values(errors)[0];
                    const errorMessage = Array.isArray(firstError)
                        ? firstError[0]
                        : firstError;
                    toast.error(errorMessage || 'Failed to void sale.');
                    setProcessing(false);
                },
            },
        );
    };

    /**
     * Get badge styling for sale_status
     *
     * Business Rules:
     * - OPEN: blue (UNPAID + PENDING delivery)
     * - COMPLETED: green (FULLY_PAID + DELIVERED or no delivery required)
     * - PARTIAL: yellow (PARTIALLY_PAID + PENDING, or FULLY_PAID + PARTIAL delivery, or partial refund)
     * - PARTIALLY_REFUNDED: orange (partial refund issued)
     * - REFUNDED: red (full refund issued)
     * - VOIDED: gray (sale canceled by admin)
     */
    const getStatusBadge = (status: string) => {
        const styles = {
            OPEN: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
            COMPLETED:
                'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
            PARTIAL:
                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
            PARTIALLY_REFUNDED:
                'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
            REFUNDED:
                'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
            VOIDED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        };
        return (
            styles[status as keyof typeof styles] ||
            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        );
    };

    /**
     * Get badge styling for payment_status
     *
     * Business Rules:
     * - FULLY_PAID: green (full payment received)
     * - PARTIALLY_PAID: yellow (partial payment received)
     * - PARTIALLY_REFUNDED: orange (refund issued for part of the sale)
     * - REFUNDED: red (full refund issued)
     * - REVERSED: gray (payment reversed due to void)
     */
    const getPaymentStatusBadge = (paymentStatus: string) => {
        // Normalize to uppercase for comparison (handle both old and new formats)
        const normalized = paymentStatus.toUpperCase();
        const styles = {
            FULLY_PAID:
                'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
            PARTIALLY_PAID:
                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
            PARTIALLY_REFUNDED:
                'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
            REFUNDED:
                'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
            REVERSED:
                'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
            // Legacy support for old lowercase values
            PAID: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
            PARTIAL:
                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
            UNPAID: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        };
        return (
            styles[normalized as keyof typeof styles] ||
            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        );
    };

    /**
     * Get badge styling for delivery_status
     *
     * Business Rules:
     * - PENDING: gray (delivery not started)
     * - PARTIAL: yellow (some items delivered)
     * - DELIVERED: green (all items delivered)
     * - RETURNED: red (all delivered items returned)
     * - CANCELED: gray (delivery canceled)
     */
    const getDeliveryStatusBadge = (
        deliveryStatus: string | null,
        isForDelivery: boolean,
    ) => {
        if (!isForDelivery) {
            return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
        }
        const styles = {
            PENDING:
                'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
            PARTIAL:
                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
            DELIVERED:
                'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
            RETURNED:
                'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
            CANCELED:
                'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        };
        return (
            styles[deliveryStatus as keyof typeof styles] ||
            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        );
    };

    /**
     * Check if sale is eligible for refund action
     *
     * Business Rules:
     * - Sale must be paid (FULLY_PAID, PAID, or PARTIALLY_REFUNDED)
     * - Sale cannot be VOIDED
     * - Sale cannot be already fully REFUNDED
     */
    const canRefund = (sale: Sale): boolean => {
        const saleStatus = sale.status.toUpperCase();
        const paymentStatus = sale.payment_status.toUpperCase();

        if (saleStatus === 'VOIDED' || saleStatus === 'REFUNDED') {
            return false;
        }
        if (paymentStatus === 'REFUNDED') {
            return false;
        }
        // Allow refund if fully paid or partially refunded (support both old and new formats)
        return (
            paymentStatus === 'FULLY_PAID' ||
            paymentStatus === 'PAID' ||
            paymentStatus === 'PARTIALLY_REFUNDED'
        );
    };

    /**
     * Check if sale can be voided
     *
     * VOID BUSINESS RULES:
     * A sale may be VOIDED only if ALL conditions are met:
     * - No delivery occurred: SUM(delivered_quantity) = 0
     * - No refunds exist: refund_total = 0
     * - Sale is not already VOIDED: sale_status != VOIDED
     * - Sale is not REFUNDED or PARTIALLY_REFUNDED
     * - User is authorized: Admin or Manager role only
     */
    const canVoid = (sale: Sale): boolean => {
        // Rule 1: Sale must not be already VOIDED
        if (sale.status === 'VOIDED') {
            return false;
        }

        // Rule 2: Sale must not be REFUNDED or PARTIALLY_REFUNDED
        if (
            sale.status === 'REFUNDED' ||
            sale.status === 'PARTIALLY_REFUNDED'
        ) {
            return false;
        }

        // Rule 3: Check if any delivery occurred
        // We need to check items, but we don't have delivered_quantity in the index view
        // For now, we'll check delivery_status - if it's DELIVERED or PARTIAL, delivery occurred
        if (
            sale.delivery_status === 'DELIVERED' ||
            sale.delivery_status === 'PARTIAL'
        ) {
            return false;
        }

        // Rule 4: Check if any refunds exist
        // We can check payment_status - if it's REFUNDED or PARTIALLY_REFUNDED, refunds exist
        if (
            sale.payment_status === 'REFUNDED' ||
            sale.payment_status === 'PARTIALLY_REFUNDED'
        ) {
            return false;
        }

        // All conditions met - sale can be voided
        return true;
    };

    /**
     * Check if sale can have delivery items added
     *
     * Business Rules:
     * - Sale must be for delivery
     * - There must be remaining items to deliver (not all refunded or delivered)
     * - Delivery status must be PENDING or PARTIAL (not DELIVERED, RETURNED, or CANCELED)
     * - Sale cannot be VOIDED or REFUNDED
     */
    const canAddDelivery = (sale: Sale): boolean => {
        if (!sale.is_for_delivery) {
            return false;
        }
        if (sale.status === 'VOIDED' || sale.status === 'REFUNDED') {
            return false;
        }
        // Check delivery status - block if CANCELED, DELIVERED, or RETURNED
        if (
            !sale.delivery_status ||
            sale.delivery_status === 'DELIVERED' ||
            sale.delivery_status === 'RETURNED' ||
            sale.delivery_status === 'CANCELED'
        ) {
            return false;
        }
        // Check if there are remaining items to deliver (most important check)
        // This accounts for canceled/adjusted items
        if (
            sale.has_remaining_delivery === false ||
            sale.has_remaining_delivery === undefined
        ) {
            return false;
        }
        // Only allow if PENDING or PARTIAL AND there are remaining items
        return (
            sale.delivery_status === 'PENDING' ||
            sale.delivery_status === 'PARTIAL'
        );
    };

    const handlePrintReceipt = async (saleId: number) => {
        setSelectedSaleId(saleId);
        setIsLoadingReceipt(true);
        try {
            // Fetch ESC/POS formatted receipt (has bold commands)
            const text = await fetchSalesReceiptText(saleId, 80);
            // Directly share to RawBT
            await shareReceipt(text);
        } catch (error) {
            console.error('Failed to print receipt:', error);
            toast.error('Failed to print receipt.');
        } finally {
            setIsLoadingReceipt(false);
            setSelectedSaleId(null);
        }
    };

    const toggleSaleCardExpansion = (saleId: number) => {
        setExpandedSaleId((current) => (current === saleId ? null : saleId));
    };

    const formatItemQuantity = (quantity: number) => {
        const value = Number(quantity);
        if (!Number.isFinite(value)) {
            return '0';
        }
        if (Number.isInteger(value)) {
            return value.toString();
        }
        return value.toFixed(2).replace(/\.?0+$/, '');
    };

    const getTransactionDateKey = (dateValue: string) => {
        const date = new Date(dateValue);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatTransactionDateLabel = (dateKey: string) => {
        const [year, month, day] = dateKey.split('-').map(Number);
        const transactionDate = new Date(year, month - 1, day);
        const now = new Date();
        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        );
        const diffMs = today.getTime() - transactionDate.getTime();
        const diffDays = Math.round(diffMs / 86_400_000);

        if (diffDays === 0) {
            return 'Today';
        }
        if (diffDays === 1) {
            return 'Yesterday';
        }

        return transactionDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTransactionTime = (dateValue: string) =>
        new Date(dateValue)
            .toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            })
            .toLowerCase();

    const hasActiveFilters =
        statusFilter !== 'all' ||
        paymentStatusFilter !== 'all' ||
        deliveryStatusFilter !== 'all' ||
        Boolean(dateFrom) ||
        Boolean(dateTo);

    const mobileActionButtonBase =
        '!my-0 !flex !h-12 !w-full min-w-0 !flex-col !items-center !justify-center gap-1 !rounded-none border-0 border-r border-border/40 !px-1 !py-1 text-[10px] leading-none !font-medium shadow-none last:border-r-0 hover:bg-muted/25';
    const mobileActionIconChipBase =
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm';

    const mobileHeaderControls = (
        <>
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
            <FilterSheetButton
                title="Sales Filters"
                isActive={hasActiveFilters}
            >
                <Input
                    type="date"
                    placeholder="Date From"
                    value={dateFrom}
                    onChange={(e) =>
                        handleDateChange('date_from', e.target.value)
                    }
                />
                <Input
                    type="date"
                    placeholder="Date To"
                    value={dateTo}
                    onChange={(e) =>
                        handleDateChange('date_to', e.target.value)
                    }
                />
                <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                        setStatusFilter(value);
                        triggerFetch({
                            status: value === 'all' ? undefined : value,
                            page: 1,
                        });
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Sales Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Sales Status</SelectItem>
                        <SelectItem value="OPEN">Open</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="PARTIAL">Partial</SelectItem>
                        <SelectItem value="PARTIALLY_REFUNDED">
                            Partially Refunded
                        </SelectItem>
                        <SelectItem value="REFUNDED">Refunded</SelectItem>
                        <SelectItem value="VOIDED">Voided</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={paymentStatusFilter}
                    onValueChange={(value) => {
                        setPaymentStatusFilter(value);
                        triggerFetch({
                            payment_status: value === 'all' ? undefined : value,
                            page: 1,
                        });
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Payment Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Payment Status</SelectItem>
                        <SelectItem value="UNPAID">Unpaid</SelectItem>
                        <SelectItem value="PARTIALLY_PAID">
                            Partially Paid
                        </SelectItem>
                        <SelectItem value="FULLY_PAID">Fully Paid</SelectItem>
                        <SelectItem value="PARTIALLY_REFUNDED">
                            Partially Refunded
                        </SelectItem>
                        <SelectItem value="REFUNDED">Refunded</SelectItem>
                        <SelectItem value="REVERSED">Reversed</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={deliveryStatusFilter}
                    onValueChange={(value) => {
                        setDeliveryStatusFilter(value);
                        triggerFetch({
                            delivery_status:
                                value === 'all' ? undefined : value,
                            page: 1,
                        });
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Delivery Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Delivery Status</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="PARTIAL">Partial</SelectItem>
                        <SelectItem value="DELIVERED">Delivered</SelectItem>
                        <SelectItem value="RETURNED">Returned</SelectItem>
                        <SelectItem value="CANCELED">Canceled</SelectItem>
                        <SelectItem value="WALK_IN">Walk In Sale</SelectItem>
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
            <Head title="Sales" />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
                <div className="z-40 hidden flex-shrink-0 border-b border-border bg-card px-3 py-2.5 shadow-sm md:block md:space-y-4 md:p-4">
                    <div className="hidden items-center justify-between md:flex">
                        <h1 className="hidden text-2xl font-bold md:block">
                            Sales
                        </h1>
                    </div>

                    <div className="hidden items-center gap-2 md:flex">
                        <div className="relative min-w-0 flex-1">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Search by sale number..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 pl-10 md:h-10"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Input
                                type="date"
                                placeholder="Date From"
                                value={dateFrom}
                                onChange={(e) =>
                                    handleDateChange(
                                        'date_from',
                                        e.target.value,
                                    )
                                }
                                className="w-full sm:w-[150px]"
                            />
                            <Input
                                type="date"
                                placeholder="Date To"
                                value={dateTo}
                                onChange={(e) =>
                                    handleDateChange('date_to', e.target.value)
                                }
                                className="w-full sm:w-[150px]"
                            />
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    triggerFetch({
                                        status:
                                            e.target.value === 'all'
                                                ? undefined
                                                : e.target.value,
                                        page: 1,
                                    });
                                }}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:w-[180px] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            >
                                <option value="all">All Sales Status</option>
                                <option value="OPEN">Open</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="PARTIAL">Partial</option>
                                <option value="PARTIALLY_REFUNDED">
                                    Partially Refunded
                                </option>
                                <option value="REFUNDED">Refunded</option>
                                <option value="VOIDED">Voided</option>
                            </select>
                            <select
                                value={paymentStatusFilter}
                                onChange={(e) => {
                                    setPaymentStatusFilter(e.target.value);
                                    triggerFetch({
                                        payment_status:
                                            e.target.value === 'all'
                                                ? undefined
                                                : e.target.value,
                                        page: 1,
                                    });
                                }}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:w-[180px] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            >
                                <option value="all">All Payment Status</option>
                                <option value="UNPAID">Unpaid</option>
                                <option value="PARTIALLY_PAID">
                                    Partially Paid
                                </option>
                                <option value="FULLY_PAID">Fully Paid</option>
                                <option value="PARTIALLY_REFUNDED">
                                    Partially Refunded
                                </option>
                                <option value="REFUNDED">Refunded</option>
                                <option value="REVERSED">Reversed</option>
                            </select>
                            <select
                                value={deliveryStatusFilter}
                                onChange={(e) => {
                                    setDeliveryStatusFilter(e.target.value);
                                    triggerFetch({
                                        delivery_status:
                                            e.target.value === 'all'
                                                ? undefined
                                                : e.target.value,
                                        page: 1,
                                    });
                                }}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:w-[180px] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            >
                                <option value="all">All Delivery Status</option>
                                <option value="PENDING">Pending</option>
                                <option value="PARTIAL">Partial</option>
                                <option value="DELIVERED">Delivered</option>
                                <option value="RETURNED">Returned</option>
                                <option value="CANCELED">Canceled</option>
                                <option value="WALK_IN">Walk In Sale</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-background">
                    <div className="p-4">
                        <div className="space-y-3 md:hidden">
                            {sales.data.length > 0 ? (
                                sales.data.map((sale, saleIndex) => {
                                    const transactionDateKey =
                                        getTransactionDateKey(sale.created_at);
                                    const previousDateKey =
                                        saleIndex > 0
                                            ? getTransactionDateKey(
                                                  sales.data[saleIndex - 1]
                                                      .created_at,
                                              )
                                            : null;
                                    const showDateHeader =
                                        saleIndex === 0 ||
                                        transactionDateKey !== previousDateKey;
                                    const transactionDateLabel =
                                        formatTransactionDateLabel(
                                            transactionDateKey,
                                        );
                                    const transactionTimeLabel =
                                        formatTransactionTime(sale.created_at);

                                    const saleStatusLabel =
                                        sale.status === 'OPEN'
                                            ? 'Open'
                                            : sale.status === 'COMPLETED'
                                              ? 'Completed'
                                              : sale.status === 'PARTIAL'
                                                ? 'Partial'
                                                : sale.status ===
                                                    'PARTIALLY_REFUNDED'
                                                  ? 'Partially Refunded'
                                                  : sale.status === 'REFUNDED'
                                                    ? 'Refunded'
                                                    : sale.status === 'VOIDED'
                                                      ? 'Voided'
                                                      : sale.status;
                                    const saleStatusTextClass =
                                        sale.status === 'COMPLETED'
                                            ? 'text-secondary'
                                            : sale.status === 'OPEN' ||
                                                sale.status === 'PARTIAL'
                                              ? 'text-primary'
                                              : sale.status ===
                                                  'PARTIALLY_REFUNDED'
                                                ? 'text-amber-700'
                                                : 'text-destructive';

                                    const totalRefunded =
                                        sale.refunds?.reduce(
                                            (sum, refund) =>
                                                sum + refund.refund_amount,
                                            0,
                                        ) ?? 0;
                                    const adjustedTotal =
                                        sale.total - totalRefunded;
                                    const saleItems = sale.items ?? [];
                                    const firstItem = saleItems[0];
                                    const additionalItems = saleItems.slice(1);
                                    const hasAdditionalItems =
                                        additionalItems.length > 0;
                                    const isPrintable =
                                        sale.status !== 'REFUNDED' &&
                                        sale.status !== 'VOIDED' &&
                                        sale.payment_status !== 'REFUNDED';

                                    const isExpanded =
                                        expandedSaleId === sale.id;

                                    return (
                                        <div
                                            key={sale.id}
                                            className="space-y-3"
                                        >
                                            {showDateHeader ? (
                                                <div className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 py-2 text-center backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                                    <span className="text-xs font-semibold text-muted-foreground">
                                                        {transactionDateLabel}
                                                    </span>
                                                </div>
                                            ) : null}

                                            <div
                                                role="button"
                                                tabIndex={0}
                                                aria-expanded={isExpanded}
                                                className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                                                onClick={() =>
                                                    toggleSaleCardExpansion(
                                                        sale.id,
                                                    )
                                                }
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key === 'Enter' ||
                                                        event.key === ' '
                                                    ) {
                                                        event.preventDefault();
                                                        toggleSaleCardExpansion(
                                                            sale.id,
                                                        );
                                                    }
                                                }}
                                            >
                                                <MobileRecordCard
                                                    title={sale.sale_number}
                                                    className={`transition-all duration-200 ${isExpanded ? 'shadow-md ring-1 ring-primary/40' : ''}`}
                                                    value={
                                                        <span
                                                            className={`text-sm font-semibold ${saleStatusTextClass}`}
                                                        >
                                                            {saleStatusLabel}
                                                        </span>
                                                    }
                                                    footerClassName="mt-2 pt-1.5"
                                                    footer={
                                                        isExpanded ? (
                                                            <div
                                                                className="grid w-full min-w-0 auto-cols-fr grid-flow-col overflow-hidden rounded-md"
                                                                onClick={(
                                                                    event,
                                                                ) =>
                                                                    event.stopPropagation()
                                                                }
                                                            >
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className={`${mobileActionButtonBase} text-foreground hover:text-foreground`}
                                                                    title="View details"
                                                                    aria-label="View details"
                                                                    onClick={() =>
                                                                        router.visit(
                                                                            `/sales/${sale.id}`,
                                                                        )
                                                                    }
                                                                >
                                                                    <span
                                                                        className={`${mobileActionIconChipBase} text-foreground`}
                                                                    >
                                                                        <Eye className="size-[22.4px]" />
                                                                    </span>
                                                                    <span className="leading-none">
                                                                        View
                                                                    </span>
                                                                </Button>
                                                                {isPrintable && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className={`${mobileActionButtonBase} text-secondary hover:text-secondary`}
                                                                        title="Print receipt"
                                                                        aria-label="Print receipt"
                                                                        onClick={() =>
                                                                            handlePrintReceipt(
                                                                                sale.id,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            isLoadingReceipt &&
                                                                            selectedSaleId ===
                                                                                sale.id
                                                                        }
                                                                    >
                                                                        <span
                                                                            className={`${mobileActionIconChipBase} text-secondary`}
                                                                        >
                                                                            <Printer className="size-[22.4px]" />
                                                                        </span>
                                                                        <span className="leading-none">
                                                                            Print
                                                                        </span>
                                                                    </Button>
                                                                )}
                                                                {canAddDelivery(
                                                                    sale,
                                                                ) && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className={`${mobileActionButtonBase} text-primary hover:text-primary`}
                                                                        title="Manage delivery"
                                                                        aria-label="Manage delivery"
                                                                        onClick={() =>
                                                                            router.visit(
                                                                                `/sales/${sale.id}/delivery`,
                                                                            )
                                                                        }
                                                                    >
                                                                        <span
                                                                            className={`${mobileActionIconChipBase} text-primary`}
                                                                        >
                                                                            <Truck className="size-[22.4px]" />
                                                                        </span>
                                                                        <span className="leading-none">
                                                                            Deliver
                                                                        </span>
                                                                    </Button>
                                                                )}
                                                                {canRefund(
                                                                    sale,
                                                                ) && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className={`${mobileActionButtonBase} text-amber-700 hover:text-amber-700`}
                                                                        title="Process refund"
                                                                        aria-label="Process refund"
                                                                        onClick={() =>
                                                                            router.visit(
                                                                                `/sales/${sale.id}/refund`,
                                                                            )
                                                                        }
                                                                    >
                                                                        <span
                                                                            className={`${mobileActionIconChipBase} text-amber-700`}
                                                                        >
                                                                            <RefreshCw className="size-[22.4px]" />
                                                                        </span>
                                                                        <span className="leading-none">
                                                                            Refund
                                                                        </span>
                                                                    </Button>
                                                                )}
                                                                {canVoid(
                                                                    sale,
                                                                ) && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className={`${mobileActionButtonBase} text-destructive hover:text-destructive`}
                                                                        title="Void sale"
                                                                        aria-label="Void sale"
                                                                        onClick={() =>
                                                                            handleVoid(
                                                                                sale,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            processing
                                                                        }
                                                                    >
                                                                        <span
                                                                            className={`${mobileActionIconChipBase} text-destructive`}
                                                                        >
                                                                            <XCircle className="size-[22.4px]" />
                                                                        </span>
                                                                        <span className="leading-none">
                                                                            Void
                                                                        </span>
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ) : null
                                                    }
                                                >
                                                    <div className="space-y-2.5">
                                                        {firstItem ? (
                                                            <div className="flex items-start gap-3">
                                                                <ProductImage
                                                                    src={
                                                                        firstItem
                                                                            .product_variant
                                                                            .product
                                                                            .image ??
                                                                        null
                                                                    }
                                                                    alt={
                                                                        firstItem
                                                                            .product_variant
                                                                            .product
                                                                            .name
                                                                    }
                                                                    className="h-16 w-16 rounded-md border border-border/50 bg-muted/40 object-cover"
                                                                    fallbackClassName="h-16 w-16 rounded-md border border-border/50 bg-muted/40"
                                                                />
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="truncate text-sm font-semibold text-foreground">
                                                                        {
                                                                            firstItem
                                                                                .product_variant
                                                                                .product
                                                                                .name
                                                                        }
                                                                    </p>
                                                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                                        {firstItem
                                                                            .product_variant
                                                                            .description ||
                                                                            'No variant'}
                                                                    </p>
                                                                    <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                                                                        <p className="text-muted-foreground">
                                                                            Qty:{' '}
                                                                            <span className="font-medium text-foreground">
                                                                                x
                                                                                {formatItemQuantity(
                                                                                    firstItem.quantity,
                                                                                )}
                                                                            </span>
                                                                        </p>
                                                                        <span className="shrink-0 font-semibold text-foreground">
                                                                            {`\u20B1${formatCurrency(firstItem.line_total)}`}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                                                                No items found
                                                                for this sale.
                                                            </div>
                                                        )}

                                                        {isExpanded &&
                                                        hasAdditionalItems
                                                            ? additionalItems.map(
                                                                  (item) => (
                                                                      <div
                                                                          key={
                                                                              item.id
                                                                          }
                                                                          className="flex items-start gap-3 border-t border-border/60 pt-2.5"
                                                                      >
                                                                          <ProductImage
                                                                              src={
                                                                                  item
                                                                                      .product_variant
                                                                                      .product
                                                                                      .image ??
                                                                                  null
                                                                              }
                                                                              alt={
                                                                                  item
                                                                                      .product_variant
                                                                                      .product
                                                                                      .name
                                                                              }
                                                                              className="h-14 w-14 rounded-md border border-border/50 bg-muted/40 object-cover"
                                                                              fallbackClassName="h-14 w-14 rounded-md border border-border/50 bg-muted/40"
                                                                          />
                                                                          <div className="min-w-0 flex-1">
                                                                              <p className="truncate text-sm font-medium text-foreground">
                                                                                  {
                                                                                      item
                                                                                          .product_variant
                                                                                          .product
                                                                                          .name
                                                                                  }
                                                                              </p>
                                                                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                                                  {item
                                                                                      .product_variant
                                                                                      .description ||
                                                                                      'No variant'}
                                                                              </p>
                                                                              <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                                                                                  <p className="text-muted-foreground">
                                                                                      Qty:{' '}
                                                                                      <span className="font-medium text-foreground">
                                                                                          x
                                                                                          {formatItemQuantity(
                                                                                              item.quantity,
                                                                                          )}
                                                                                      </span>
                                                                                  </p>
                                                                                  <span className="shrink-0 font-semibold text-foreground">
                                                                                      {`\u20B1${formatCurrency(item.line_total)}`}
                                                                                  </span>
                                                                              </div>
                                                                          </div>
                                                                      </div>
                                                                  ),
                                                              )
                                                            : null}

                                                        {hasAdditionalItems ? (
                                                            <button
                                                                type="button"
                                                                className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                                                                onClick={(
                                                                    event,
                                                                ) => {
                                                                    event.stopPropagation();
                                                                    toggleSaleCardExpansion(
                                                                        sale.id,
                                                                    );
                                                                }}
                                                            >
                                                                {isExpanded
                                                                    ? 'View Less'
                                                                    : 'View More'}
                                                                {isExpanded ? (
                                                                    <ChevronUp className="h-4 w-4" />
                                                                ) : (
                                                                    <ChevronDown className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        ) : null}

                                                        <div className="flex items-center justify-between border-t border-border/70 pt-2 text-sm font-semibold text-foreground">
                                                            <span className="text-xs font-medium text-muted-foreground">
                                                                {
                                                                    transactionTimeLabel
                                                                }
                                                            </span>
                                                            <div className="text-right">
                                                                {`Total ${sale.items_count} ${sale.items_count === 1 ? 'item' : 'items'}: `}
                                                                <span className="text-base">
                                                                    {`\u20B1${formatCurrency(
                                                                        Math.max(
                                                                            0,
                                                                            adjustedTotal,
                                                                        ),
                                                                    )}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </MobileRecordCard>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="rounded-lg border border-sidebar-border/70 bg-card px-4 py-12 text-center text-muted-foreground">
                                    <Receipt className="mx-auto mb-4 h-12 w-12 opacity-50" />
                                    <p>No sales found</p>
                                </div>
                            )}
                        </div>

                        {/* Sales Table */}
                        <div className="hidden rounded-lg border border-sidebar-border/70 bg-card md:block">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">
                                                Sale Number
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">
                                                Date
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">
                                                Cashier
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">
                                                Items
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">
                                                Sales Status
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">
                                                Payment Status
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">
                                                Delivery Status
                                            </th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold">
                                                Total
                                            </th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
                                        {sales.data.length > 0 ? (
                                            sales.data.map((sale) => (
                                                <tr
                                                    key={sale.id}
                                                    className="hover:bg-muted/30"
                                                >
                                                    <td className="px-4 py-3">
                                                        <div className="text-sm font-medium">
                                                            {sale.sale_number}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-sm text-muted-foreground">
                                                            {new Date(
                                                                sale.created_at,
                                                            ).toLocaleString()}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-sm">
                                                            {sale.cashier.name}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-sm">
                                                            {sale.items_count}{' '}
                                                            item(s)
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusBadge(sale.status)}`}
                                                        >
                                                            {sale.status ===
                                                            'OPEN'
                                                                ? 'Open'
                                                                : sale.status ===
                                                                    'COMPLETED'
                                                                  ? 'Completed'
                                                                  : sale.status ===
                                                                      'PARTIAL'
                                                                    ? 'Partial'
                                                                    : sale.status ===
                                                                        'PARTIALLY_REFUNDED'
                                                                      ? 'Partially Refunded'
                                                                      : sale.status ===
                                                                          'REFUNDED'
                                                                        ? 'Refunded'
                                                                        : sale.status ===
                                                                            'VOIDED'
                                                                          ? 'Voided'
                                                                          : sale.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getPaymentStatusBadge(sale.payment_status)}`}
                                                        >
                                                            {(() => {
                                                                const status =
                                                                    sale.payment_status.toUpperCase();
                                                                if (
                                                                    status ===
                                                                        'FULLY_PAID' ||
                                                                    status ===
                                                                        'PAID'
                                                                )
                                                                    return 'Fully Paid';
                                                                if (
                                                                    status ===
                                                                        'PARTIALLY_PAID' ||
                                                                    status ===
                                                                        'PARTIAL'
                                                                )
                                                                    return 'Partially Paid';
                                                                if (
                                                                    status ===
                                                                    'PARTIALLY_REFUNDED'
                                                                )
                                                                    return 'Partially Refunded';
                                                                if (
                                                                    status ===
                                                                    'REFUNDED'
                                                                )
                                                                    return 'Refunded';
                                                                if (
                                                                    status ===
                                                                    'REVERSED'
                                                                )
                                                                    return 'Reversed';
                                                                if (
                                                                    status ===
                                                                    'UNPAID'
                                                                )
                                                                    return 'Unpaid';
                                                                return sale.payment_status;
                                                            })()}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getDeliveryStatusBadge(sale.delivery_status, sale.is_for_delivery)}`}
                                                        >
                                                            {!sale.is_for_delivery
                                                                ? 'Walk In Sale'
                                                                : sale.delivery_status ===
                                                                    'PENDING'
                                                                  ? 'Pending'
                                                                  : sale.delivery_status ===
                                                                      'PARTIAL'
                                                                    ? 'Partial'
                                                                    : sale.delivery_status ===
                                                                        'DELIVERED'
                                                                      ? 'Delivered'
                                                                      : sale.delivery_status ===
                                                                          'RETURNED'
                                                                        ? 'Returned'
                                                                        : sale.delivery_status ===
                                                                            'CANCELED'
                                                                          ? 'Canceled'
                                                                          : 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="text-sm font-semibold">
                                                            {sale.status ===
                                                            'VOIDED' ? (
                                                                // VOIDED sales show $0.00
                                                                <span className="text-gray-500">
                                                                    $0.00
                                                                </span>
                                                            ) : sale.refunds &&
                                                              sale.refunds
                                                                  .length >
                                                                  0 ? (
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-xs text-gray-500 line-through">
                                                                        â‚±
                                                                        {formatCurrency(
                                                                            sale.total,
                                                                        )}
                                                                    </span>
                                                                    <span className="font-bold">
                                                                        â‚±
                                                                        {formatCurrency(
                                                                            sale.total -
                                                                                sale.refunds.reduce(
                                                                                    (
                                                                                        sum,
                                                                                        r,
                                                                                    ) =>
                                                                                        sum +
                                                                                        r.refund_amount,
                                                                                    0,
                                                                                ),
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span>
                                                                    â‚±
                                                                    {formatCurrency(
                                                                        sale.total,
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {/* Only show print button if sale is not refunded or voided */}
                                                            {sale.status !==
                                                                'REFUNDED' &&
                                                                sale.status !==
                                                                    'VOIDED' &&
                                                                sale.payment_status !==
                                                                    'REFUNDED' && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0"
                                                                        title="Print receipt"
                                                                        onClick={() =>
                                                                            handlePrintReceipt(
                                                                                sale.id,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            isLoadingReceipt &&
                                                                            selectedSaleId ===
                                                                                sale.id
                                                                        }
                                                                    >
                                                                        <Printer className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    router.visit(
                                                                        `/sales/${sale.id}`,
                                                                    )
                                                                }
                                                                title="View details"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            {/* Actions based on status rules */}
                                                            {sale.status !==
                                                                'VOIDED' &&
                                                                sale.status !==
                                                                    'REFUNDED' && (
                                                                    <>
                                                                        {/* Delivery button: only for sales that require delivery and have PENDING or PARTIAL delivery status */}
                                                                        {canAddDelivery(
                                                                            sale,
                                                                        ) && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    router.visit(
                                                                                        `/sales/${sale.id}/delivery`,
                                                                                    )
                                                                                }
                                                                                title="View/Manage delivery"
                                                                                className="text-blue-600 hover:text-blue-700"
                                                                            >
                                                                                <Truck className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                        {/* Refund button: only if sale is eligible for refund */}
                                                                        {canRefund(
                                                                            sale,
                                                                        ) && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    router.visit(
                                                                                        `/sales/${sale.id}/refund`,
                                                                                    )
                                                                                }
                                                                                title="Process refund"
                                                                                className="text-orange-600 hover:text-orange-700"
                                                                            >
                                                                                <RefreshCw className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                        {/* Void button: only if sale can be voided */}
                                                                        {canVoid(
                                                                            sale,
                                                                        ) && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    handleVoid(
                                                                                        sale,
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    processing
                                                                                }
                                                                                className="text-red-600 hover:text-red-700"
                                                                                title="Void sale"
                                                                            >
                                                                                <XCircle className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                    </>
                                                                )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td
                                                    colSpan={9}
                                                    className="px-4 py-12 text-center text-muted-foreground"
                                                >
                                                    <Receipt className="mx-auto mb-4 h-12 w-12 opacity-50" />
                                                    <p>No sales found</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="z-30 flex-shrink-0 border-t border-border bg-card shadow-sm">
                    {sales.data.length > 0 && (
                        <Pagination
                            currentPage={sales.current_page}
                            lastPage={sales.last_page}
                            total={sales.total}
                            perPage={sales.per_page}
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
