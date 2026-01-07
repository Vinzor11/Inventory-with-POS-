import { Head } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import { Eye, XCircle, Search, Receipt, Truck, RefreshCw, Share2 } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router, useForm } from '@inertiajs/react';
import { toast } from '@/lib/toast';
import { formatCurrency } from '@/lib/format-currency';
import { shareReceiptAsFile, canShare } from '@/lib/receipt-print';

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
    status: 'OPEN' | 'COMPLETED' | 'PARTIAL' | 'VOIDED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
    payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
    is_for_delivery: boolean;
    delivery_status: 'PENDING' | 'PARTIAL' | 'DELIVERED' | 'RETURNED' | 'CANCELED' | null;
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
    const [paymentStatusFilter, setPaymentStatusFilter] = useState(filters.payment_status || 'all');
    const [deliveryStatusFilter, setDeliveryStatusFilter] = useState(filters.delivery_status || 'all');
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
    
    // Receipt state
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
    const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
    const [showShareButton, setShowShareButton] = useState(false);

    useEffect(() => {
        setShowShareButton(canShare());
    }, []);

    const triggerFetch = useCallback((params: any = {}) => {
        const status = params.status !== undefined ? params.status : statusFilter;
        const paymentStatus = params.payment_status !== undefined ? params.payment_status : paymentStatusFilter;
        const deliveryStatus = params.delivery_status !== undefined ? params.delivery_status : deliveryStatusFilter;
        router.get('/sales', {
            page: params.page || sales?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            search: params.search !== undefined ? params.search : debouncedSearch,
            status: status === 'all' ? undefined : status,
            payment_status: paymentStatus === 'all' ? undefined : paymentStatus,
            delivery_status: deliveryStatus === 'all' ? undefined : deliveryStatus,
            date_from: params.date_from !== undefined ? params.date_from : (dateFrom || undefined),
            date_to: params.date_to !== undefined ? params.date_to : (dateTo || undefined),
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [debouncedSearch, statusFilter, paymentStatusFilter, deliveryStatusFilter, dateFrom, dateTo, perPage, sales?.current_page]);

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
            payment_status: paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
            delivery_status: deliveryStatusFilter === 'all' ? undefined : deliveryStatusFilter,
            page: 1 
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, statusFilter, paymentStatusFilter, deliveryStatusFilter]);

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
            toast.error('This sale cannot be voided. It may have deliveries, refunds, or is already voided.');
            return;
        }

        if (!confirm(`Are you sure you want to void sale ${sale.sale_number}?`)) {
            return; // User cancelled
        }

        setProcessing(true);
        router.post(`/sales/${sale.id}/void`, {
            void_reason: null,
        }, {
            onSuccess: () => {
                // Flash message will be shown automatically
                triggerFetch();
                setProcessing(false);
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                toast.error(errorMessage || 'Failed to void sale.');
                setProcessing(false);
            },
        });
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
            COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
            PARTIAL: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
            PARTIALLY_REFUNDED: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
            REFUNDED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
            VOIDED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        };
        return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
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
            FULLY_PAID: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
            PARTIALLY_PAID: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
            PARTIALLY_REFUNDED: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
            REFUNDED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
            REVERSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
            // Legacy support for old lowercase values
            PAID: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
            PARTIAL: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
            UNPAID: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        };
        return styles[normalized as keyof typeof styles] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
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
    const getDeliveryStatusBadge = (deliveryStatus: string | null, isForDelivery: boolean) => {
        if (!isForDelivery) {
            return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
        }
        const styles = {
            PENDING: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
            PARTIAL: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
            DELIVERED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
            RETURNED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
            CANCELED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        };
        return styles[deliveryStatus as keyof typeof styles] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
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
        return paymentStatus === 'FULLY_PAID' || 
               paymentStatus === 'PAID' || 
               paymentStatus === 'PARTIALLY_REFUNDED';
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
        if (sale.status === 'REFUNDED' || sale.status === 'PARTIALLY_REFUNDED') {
            return false;
        }

        // Rule 3: Check if any delivery occurred
        // We need to check items, but we don't have delivered_quantity in the index view
        // For now, we'll check delivery_status - if it's DELIVERED or PARTIAL, delivery occurred
        if (sale.delivery_status === 'DELIVERED' || sale.delivery_status === 'PARTIAL') {
            return false;
        }

        // Rule 4: Check if any refunds exist
        // We can check payment_status - if it's REFUNDED or PARTIALLY_REFUNDED, refunds exist
        if (sale.payment_status === 'REFUNDED' || sale.payment_status === 'PARTIALLY_REFUNDED') {
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
        if (!sale.delivery_status || 
            sale.delivery_status === 'DELIVERED' || 
            sale.delivery_status === 'RETURNED' || 
            sale.delivery_status === 'CANCELED') {
            return false;
        }
        // Check if there are remaining items to deliver (most important check)
        // This accounts for canceled/adjusted items
        if (sale.has_remaining_delivery === false || sale.has_remaining_delivery === undefined) {
            return false;
        }
        // Only allow if PENDING or PARTIAL AND there are remaining items
        return sale.delivery_status === 'PENDING' || sale.delivery_status === 'PARTIAL';
    };

    const handlePrintReceipt = async (saleId: number) => {
        setSelectedSaleId(saleId);
        setIsLoadingReceipt(true);
        try {
            // Share as .prn file for RawBT (preserves ESC/POS commands for bold text)
            const shared = await shareReceiptAsFile(saleId, 80);
            if (!shared) {
                toast.error('Failed to share receipt. Please try again.');
            }
        } catch (error) {
            console.error('Failed to print receipt:', error);
            toast.error('Failed to print receipt.');
        } finally {
            setIsLoadingReceipt(false);
            setSelectedSaleId(null);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Sales" />
            <div className="flex flex-col overflow-hidden bg-background" style={{ height: 'calc(100vh - 80px)' }}>
                <div className="flex-shrink-0 bg-card border-b border-border shadow-sm z-40 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">Sales</h1>
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
                        <Input
                            type="date"
                            placeholder="Date From"
                            value={dateFrom}
                            onChange={(e) => handleDateChange('date_from', e.target.value)}
                            className="w-full sm:w-[150px]"
                        />
                        <Input
                            type="date"
                            placeholder="Date To"
                            value={dateTo}
                            onChange={(e) => handleDateChange('date_to', e.target.value)}
                            className="w-full sm:w-[150px]"
                        />
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                triggerFetch({ status: e.target.value === 'all' ? undefined : e.target.value, page: 1 });
                            }}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white w-full sm:w-[180px]"
                        >
                            <option value="all">All Sales Status</option>
                            <option value="OPEN">Open</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="PARTIAL">Partial</option>
                            <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
                            <option value="REFUNDED">Refunded</option>
                            <option value="VOIDED">Voided</option>
                        </select>
                        <select
                            value={paymentStatusFilter}
                            onChange={(e) => {
                                setPaymentStatusFilter(e.target.value);
                                triggerFetch({ payment_status: e.target.value === 'all' ? undefined : e.target.value, page: 1 });
                            }}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white w-full sm:w-[180px]"
                        >
                            <option value="all">All Payment Status</option>
                            <option value="UNPAID">Unpaid</option>
                            <option value="PARTIALLY_PAID">Partially Paid</option>
                            <option value="FULLY_PAID">Fully Paid</option>
                            <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
                            <option value="REFUNDED">Refunded</option>
                            <option value="REVERSED">Reversed</option>
                        </select>
                        <select
                            value={deliveryStatusFilter}
                            onChange={(e) => {
                                setDeliveryStatusFilter(e.target.value);
                                triggerFetch({ delivery_status: e.target.value === 'all' ? undefined : e.target.value, page: 1 });
                            }}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white w-full sm:w-[180px]"
                        >
                            <option value="all">All Delivery Status</option>
                            <option value="PENDING">Pending</option>
                            <option value="PARTIAL">Partial</option>
                            <option value="DELIVERED">Delivered</option>
                            <option value="RETURNED">Returned</option>
                            <option value="CANCELED">Canceled</option>
                            <option value="WALK_IN">Walk In Sale</option>
                        </select>
                        <RowsPerPageSelector
                            perPage={perPage}
                            onPerPageChange={(value) => handlePerPageChange(parseInt(value, 10))}
                            storageKey={STORAGE_KEY}
                        />
                    </div>
                </div>

                <div className="flex-1 min-h-0 bg-background overflow-y-auto">
                    <div className="p-4">
                        {/* Sales Table */}
                        <div className="rounded-lg border border-sidebar-border/70 bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Sale Number</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Cashier</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Items</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Sales Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Payment Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold">Delivery Status</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold">Total</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/70">
                                {sales.data.length > 0 ? (
                                    sales.data.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-muted/30">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-sm">{sale.sale_number}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-muted-foreground">
                                                    {new Date(sale.created_at).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm">{sale.cashier.name}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm">{sale.items_count} item(s)</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(sale.status)}`}>
                                                    {sale.status === 'OPEN' ? 'Open' :
                                                     sale.status === 'COMPLETED' ? 'Completed' :
                                                     sale.status === 'PARTIAL' ? 'Partial' :
                                                     sale.status === 'PARTIALLY_REFUNDED' ? 'Partially Refunded' :
                                                     sale.status === 'REFUNDED' ? 'Refunded' :
                                                     sale.status === 'VOIDED' ? 'Voided' :
                                                     sale.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusBadge(sale.payment_status)}`}>
                                                    {(() => {
                                                        const status = sale.payment_status.toUpperCase();
                                                        if (status === 'FULLY_PAID' || status === 'PAID') return 'Fully Paid';
                                                        if (status === 'PARTIALLY_PAID' || status === 'PARTIAL') return 'Partially Paid';
                                                        if (status === 'PARTIALLY_REFUNDED') return 'Partially Refunded';
                                                        if (status === 'REFUNDED') return 'Refunded';
                                                        if (status === 'REVERSED') return 'Reversed';
                                                        if (status === 'UNPAID') return 'Unpaid';
                                                        return sale.payment_status;
                                                    })()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDeliveryStatusBadge(sale.delivery_status, sale.is_for_delivery)}`}>
                                                    {!sale.is_for_delivery 
                                                        ? 'Walk In Sale' 
                                                        : sale.delivery_status === 'PENDING' ? 'Pending' :
                                                        sale.delivery_status === 'PARTIAL' ? 'Partial' :
                                                        sale.delivery_status === 'DELIVERED' ? 'Delivered' :
                                                        sale.delivery_status === 'RETURNED' ? 'Returned' :
                                                        sale.delivery_status === 'CANCELED' ? 'Canceled' :
                                                        'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="font-semibold text-sm">
                                                    {sale.status === 'VOIDED' ? (
                                                        // VOIDED sales show $0.00
                                                        <span className="text-gray-500">$0.00</span>
                                                    ) : sale.refunds && sale.refunds.length > 0 ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-gray-500 line-through text-xs">
                                                                ₱{formatCurrency(sale.total)}
                                                            </span>
                                                            <span className="font-bold">
                                                                ₱{formatCurrency(sale.total - (sale.refunds.reduce((sum, r) => sum + r.refund_amount, 0)))}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span>₱{formatCurrency(sale.total)}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Only show print button if sale is not refunded or voided and share is available */}
                                                    {showShareButton && (sale.status !== 'REFUNDED' && sale.status !== 'VOIDED' && sale.payment_status !== 'REFUNDED') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                                            title="Print (RawBT)"
                                                            onClick={() => handlePrintReceipt(sale.id)}
                                                            disabled={isLoadingReceipt && selectedSaleId === sale.id}
                                                        >
                                                            <Share2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => router.visit(`/sales/${sale.id}`)}
                                                        title="View details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {/* Actions based on status rules */}
                                                    {sale.status !== 'VOIDED' && sale.status !== 'REFUNDED' && (
                                                        <>
                                                            {/* Delivery button: only for sales that require delivery and have PENDING or PARTIAL delivery status */}
                                                            {canAddDelivery(sale) && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => router.visit(`/sales/${sale.id}/delivery`)}
                                                                    title="View/Manage delivery"
                                                                    className="text-blue-600 hover:text-blue-700"
                                                                >
                                                                    <Truck className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            {/* Refund button: only if sale is eligible for refund */}
                                                            {canRefund(sale) && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => router.visit(`/sales/${sale.id}/refund`)}
                                                                    title="Process refund"
                                                                    className="text-orange-600 hover:text-orange-700"
                                                                >
                                                                    <RefreshCw className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            {/* Void button: only if sale can be voided */}
                                                            {canVoid(sale) && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleVoid(sale)}
                                                                    disabled={processing}
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
                                        <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
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

                <div className="flex-shrink-0 bg-card border-t border-border shadow-sm z-30">
                    {sales.data.length > 0 && (
                        <Pagination
                            currentPage={sales.current_page}
                            lastPage={sales.last_page}
                            total={sales.total}
                            perPage={sales.per_page}
                            onPageChange={handlePageChange}
                            filters={{
                                search: debouncedSearch,
                                status: statusFilter === 'all' ? undefined : statusFilter,
                            }}
                        />
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

