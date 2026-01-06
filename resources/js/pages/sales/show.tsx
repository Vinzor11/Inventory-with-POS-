import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { XCircle, Printer, Plus, DollarSign, CreditCard, RefreshCw, X } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { toast } from '@/lib/toast';
import { AddPaymentModal } from '@/components/add-payment-modal';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { formatCurrency as formatCurrencyUtil, formatNumber } from '@/lib/format-currency';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Sales',
        href: '/sales',
    },
    {
        title: 'Details',
        href: '/sales/{id}',
    },
];

interface User {
    id: number;
    name: string;
    email: string;
    role?: string;
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
    delivered_quantity?: number;
    canceled_quantity?: number;
    item_status?: 'ACTIVE' | 'CANCELED' | 'PARTIAL_ADJUSTED';
    product_variant: ProductVariant;
}

interface Payment {
    id: number;
    amount: number;
    payment_method: 'cash' | 'gcash' | 'cheque' | 'credit';
    received_at: string;
    notes: string | null;
    received_by: User;
}

interface Refund {
    id: number;
    refund_amount: number;
    reason: string | null;
    type: 'full' | 'partial';
    processed_by: User;
    created_at: string;
}

interface Sale {
    id: number;
    sale_number: string;
    status: 'OPEN' | 'COMPLETED' | 'PARTIAL' | 'VOIDED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
    payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'REVERSED';
    is_for_delivery: boolean;
    delivery_status: 'PENDING' | 'PARTIAL' | 'DELIVERED' | 'RETURNED' | 'CANCELED' | null;
    subtotal: number;
    total: number;
    notes: string | null;
    created_at: string;
    cashier: User;
    items: SaleItem[];
    payments: Payment[];
    refunds?: Refund[];
    voided_by?: User | null;
    voided_at?: string | null;
    void_reason?: string | null;
}

interface SalesShowProps {
    sale: Sale;
    paymentSummary: {
        total_paid: number;
        total_refunded: number;
        net_total: number; // Total after refunds
        balance: number;
        change: number;
    };
}

export default function SalesShow({ sale, paymentSummary }: SalesShowProps) {
    const { auth } = usePage<SharedData>().props;
    const [processing, setProcessing] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [cancelItemModal, setCancelItemModal] = useState<{
        isOpen: boolean;
        item: SaleItem | null;
    }>({ isOpen: false, item: null });
    const { data: cancelFormData, setData: setCancelFormData, post: postCancel, processing: cancelProcessing, errors: cancelErrors } = useForm({
        sale_item_id: 0,
        quantity_to_cancel: 0,
        reason: '',
    });

    // Check if user is admin
    const isAdmin = (auth.user as any)?.role === 'admin';

    // Helper function to safely format numbers and prevent NaN
    const safeNumber = (value: any, defaultValue: number = 0): number => {
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
    };

    const formatCurrency = (value: any, defaultValue: number = 0): string => {
        return `₱${formatCurrencyUtil(safeNumber(value, defaultValue))}`;
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
     */
    const canVoid = (): boolean => {
        // Rule 1: Sale must not be already VOIDED
        if (sale.status === 'VOIDED') {
            return false;
        }

        // Rule 2: Sale must not be REFUNDED or PARTIALLY_REFUNDED
        if (sale.status === 'REFUNDED' || sale.status === 'PARTIALLY_REFUNDED') {
            return false;
        }

        // Rule 3: Check if any delivery occurred
        const totalDelivered = sale.items.reduce((sum, item) => {
            return sum + (Number(item.delivered_quantity ?? 0));
        }, 0);
        if (totalDelivered > 0) {
            return false;
        }

        // Rule 4: Check if any refunds exist
        const totalRefunded = sale.refunds?.reduce((sum, refund) => sum + refund.refund_amount, 0) ?? 0;
        if (totalRefunded > 0) {
            return false;
        }

        // All conditions met - sale can be voided
        return true;
    };

    const handleVoid = () => {
        if (!canVoid()) {
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
                router.reload();
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

    const handlePrint = () => {
        window.print();
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
     * - UNPAID: gray (no payment received)
     * - PARTIALLY_PAID: yellow (partial payment received)
     * - FULLY_PAID: green (full payment received)
     * - PARTIALLY_REFUNDED: orange (refund issued for part of the sale)
     * - REFUNDED: red (full refund issued)
     * - REVERSED: gray (payment reversed due to void)
     */
    const getPaymentStatusBadge = (status: string) => {
        const styles = {
            UNPAID: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
            PARTIALLY_PAID: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
            FULLY_PAID: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
            PARTIALLY_REFUNDED: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
            REFUNDED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
            REVERSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        };
        return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    };

    /**
     * Get badge styling for delivery_status
     * 
     * Business Rules:
     * - PENDING: yellow (delivery not started)
     * - PARTIAL: blue (partial delivery completed)
     * - DELIVERED: green (all items delivered)
     * - RETURNED: red (items returned)
     * - CANCELED: gray (delivery canceled, e.g., due to void)
     */
    const getDeliveryStatusBadge = (status: string | null, isForDelivery: boolean) => {
        if (!isForDelivery) {
            return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
        }
        if (!status) {
            return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
        }
        const styles = {
            PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
            PARTIAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
            DELIVERED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
            RETURNED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
            CANCELED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        };
        return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    };

    const getPaymentMethodLabel = (method: string) => {
        const labels = {
            cash: 'Cash',
            gcash: 'GCash',
            cheque: 'Cheque',
            credit: 'Credit',
        };
        return labels[method as keyof typeof labels] || method;
    };

    const handleCancelItem = (item: SaleItem) => {
        setCancelItemModal({ isOpen: true, item });
        const maxCancelable = calculateMaxCancelable(item);
        setCancelFormData({
            sale_item_id: item.id,
            quantity_to_cancel: maxCancelable,
            reason: '',
        });
    };

    const calculateMaxCancelable = (item: SaleItem): number => {
        const deliveredQty = Number(item.delivered_quantity ?? item.deliveredQuantity ?? 0);
        const canceledQty = Number(item.canceled_quantity ?? item.canceledQuantity ?? 0);
        const totalQty = Number(item.quantity);
        return Math.max(0, totalQty - deliveredQty - canceledQty);
    };

    const handleCancelItemConfirm = () => {
        if (!cancelItemModal.item) return;

        postCancel(`/sales/${sale.id}/cancel-item`, {
            onSuccess: () => {
                // Flash message will be shown automatically
                setCancelItemModal({ isOpen: false, item: null });
                router.reload();
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                toast.error(errorMessage || 'Failed to cancel item.');
            },
        });
    };

    const canCancelItem = (item: SaleItem): boolean => {
        // Handle both snake_case and camelCase from API
        const deliveredQty = Number(item.delivered_quantity ?? item.deliveredQuantity ?? 0);
        const canceledQty = Number(item.canceled_quantity ?? item.canceledQuantity ?? 0);
        const totalQty = Number(item.quantity);
        const itemStatus = (item.item_status ?? item.itemStatus ?? 'ACTIVE');
        
        // Item cannot be canceled if status is CANCELED
        if (itemStatus === 'CANCELED') {
            return false;
        }
        
        // Calculate undelivered quantity available to cancel
        const undeliveredQty = totalQty - deliveredQty - canceledQty;
        
        // Item can be canceled if: has undelivered quantity available
        return undeliveredQty > 0;
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Sale ${sale.sale_number}`} />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold">Sale {sale.sale_number}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {sale.status === 'VOIDED' ? (
                            // VOIDED sales: Show void info, no actions
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                {sale.voided_by && sale.voided_at && (
                                    <span>
                                        Voided by {sale.voided_by.name} on {new Date(sale.voided_at).toLocaleString()}
                                        {sale.void_reason && ` - ${sale.void_reason}`}
                                    </span>
                                )}
                            </div>
                        ) : sale.status !== 'REFUNDED' && (
                            <>
                                {/* Only show Add Payment button if not fully paid */}
                                {sale.payment_status !== 'FULLY_PAID' && sale.payment_status !== 'REFUNDED' && (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => setIsPaymentModalOpen(true)}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Payment
                                    </Button>
                                )}
                                {/* Show Refund button if sale is paid or partially refunded, but not fully refunded, and not voided */}
                                {sale.status !== 'VOIDED' && (sale.payment_status === 'FULLY_PAID' || sale.payment_status === 'PARTIALLY_REFUNDED') && sale.payment_status !== 'REFUNDED' && (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => router.visit(`/sales/${sale.id}/refund`)}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Process Refund
                                    </Button>
                                )}
                                {/* Void button: only if sale can be voided */}
                                {canVoid() && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleVoid}
                                        disabled={processing}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Void Sale
                                    </Button>
                                )}
                            </>
                        )}
                        {/* Only show print button if sale is not refunded or voided */}
                        {(sale.status !== 'REFUNDED' && sale.status !== 'VOIDED' && sale.payment_status !== 'REFUNDED') && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrint}
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                Print
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Sale Information */}
                    <div className="rounded-lg border border-sidebar-border/70 p-6">
                        <h2 className="text-lg font-semibold mb-4">Sale Information</h2>
                        <dl className="space-y-3">
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Sale Number</dt>
                                <dd className="text-sm font-semibold">{sale.sale_number}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Date & Time</dt>
                                <dd className="text-sm">{new Date(sale.created_at).toLocaleString()}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Cashier</dt>
                                <dd className="text-sm">{sale.cashier.name}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Sale Status</dt>
                                <dd className="text-sm">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(sale.status)}`}>
                                        {sale.status === 'OPEN' ? 'Open' :
                                         sale.status === 'COMPLETED' ? 'Completed' :
                                         sale.status === 'PARTIAL' ? 'Partial' :
                                         sale.status === 'PARTIALLY_REFUNDED' ? 'Partially Refunded' :
                                         sale.status === 'REFUNDED' ? 'Refunded' :
                                         sale.status === 'VOIDED' ? 'Voided' :
                                         sale.status}
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Payment Status</dt>
                                <dd className="text-sm">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusBadge(sale.payment_status)}`}>
                                        {sale.payment_status === 'UNPAID' ? 'Unpaid' :
                                         sale.payment_status === 'PARTIALLY_PAID' ? 'Partially Paid' :
                                         sale.payment_status === 'FULLY_PAID' ? 'Fully Paid' :
                                         sale.payment_status === 'PARTIALLY_REFUNDED' ? 'Partially Refunded' :
                                         sale.payment_status === 'REFUNDED' ? 'Refunded' :
                                         sale.payment_status === 'REVERSED' ? 'Reversed' :
                                         sale.payment_status}
                                    </span>
                                </dd>
                            </div>
                            {sale.is_for_delivery && (
                                <div>
                                    <dt className="text-sm font-medium text-muted-foreground">Delivery Status</dt>
                                    <dd className="text-sm">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDeliveryStatusBadge(sale.delivery_status, sale.is_for_delivery)}`}>
                                            {!sale.delivery_status ? 'N/A' :
                                             sale.delivery_status === 'PENDING' ? 'Pending' :
                                             sale.delivery_status === 'PARTIAL' ? 'Partial' :
                                             sale.delivery_status === 'DELIVERED' ? 'Delivered' :
                                             sale.delivery_status === 'RETURNED' ? 'Returned' :
                                             sale.delivery_status === 'CANCELED' ? 'Canceled' :
                                             sale.delivery_status}
                                        </span>
                                    </dd>
                                </div>
                            )}
                            {sale.notes && (
                                <div>
                                    <dt className="text-sm font-medium text-muted-foreground">Notes</dt>
                                    <dd className="text-sm">{sale.notes}</dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    {/* Payment Summary */}
                    <div className="rounded-lg border border-sidebar-border/70 p-6">
                        <h2 className="text-lg font-semibold mb-4">Payment Summary</h2>
                        <dl className="space-y-3">
                            <div className="flex justify-between">
                                <dt className="text-sm font-medium text-muted-foreground">
                                    {sale.status === 'VOIDED' ? 'Sale Total' : paymentSummary.total_refunded > 0 ? 'Original Total' : 'Sale Total'}
                                </dt>
                                <dd className="text-sm font-semibold">
                                    {sale.status === 'VOIDED' ? formatCurrency(0) : formatCurrency(sale.total)}
                                </dd>
                            </div>
                            {paymentSummary.total_refunded > 0 && (
                                <>
                                    <div className="flex justify-between">
                                        <dt className="text-sm font-medium text-muted-foreground">Total Refunded</dt>
                                        <dd className="text-sm font-semibold text-red-600">
                                            -{formatCurrency(paymentSummary.total_refunded)}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between border-t border-sidebar-border/70 pt-2 mt-2">
                                        <dt className="text-sm font-medium font-semibold">Net Total</dt>
                                        <dd className="text-sm font-bold">{formatCurrency(paymentSummary.net_total)}</dd>
                                    </div>
                                </>
                            )}
                            <div className="flex justify-between">
                                <dt className="text-sm font-medium text-muted-foreground">Total Paid</dt>
                                <dd className={`text-sm font-semibold ${
                                    sale.status === 'VOIDED' || sale.payment_status === 'REVERSED' ? 'text-gray-600' :
                                    paymentSummary.total_paid > 0 ? 'text-green-600' : 'text-gray-600'
                                }`}>
                                    {sale.status === 'VOIDED' || sale.payment_status === 'REVERSED' ? formatCurrency(0) : formatCurrency(paymentSummary.total_paid)}
                                </dd>
                            </div>
                            {sale.status !== 'VOIDED' && paymentSummary.balance > 0 && sale.payment_status !== 'REFUNDED' && (
                                <div className="flex justify-between">
                                    <dt className="text-sm font-medium text-muted-foreground">Balance Remaining</dt>
                                    <dd className="text-sm font-semibold text-orange-600">
                                        {formatCurrency(paymentSummary.balance)}
                                    </dd>
                                </div>
                            )}
                            {sale.status !== 'VOIDED' && paymentSummary.change > 0 && (
                                <div className="flex justify-between">
                                    <dt className="text-sm font-medium text-muted-foreground">Change</dt>
                                    <dd className="text-sm font-semibold text-blue-600">
                                        {formatCurrency(paymentSummary.change)}
                                    </dd>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold pt-3 border-t border-sidebar-border/70">
                                <dt className={
                                    sale.status === 'VOIDED' ? 'text-gray-600' :
                                    sale.payment_status === 'REVERSED' ? 'text-gray-600' :
                                    sale.payment_status === 'REFUNDED' ? 'text-red-600' :
                                    sale.payment_status === 'PARTIALLY_REFUNDED' ? 'text-orange-600' :
                                    paymentSummary.balance > 0 ? 'text-orange-600' : 
                                    paymentSummary.change > 0 ? 'text-blue-600' : 
                                    'text-green-600'
                                }>
                                    {sale.status === 'VOIDED' ? 'Voided' :
                                     sale.payment_status === 'REVERSED' ? 'Reversed' :
                                     sale.payment_status === 'REFUNDED' ? 'Refunded' :
                                     sale.payment_status === 'PARTIALLY_REFUNDED' ? 'Partially Refunded' :
                                     paymentSummary.balance > 0 ? 'Payment Pending' : 
                                     paymentSummary.change > 0 ? 'Change Due' : 
                                     'Fully Paid'}
                                </dt>
                                <dd className={
                                    sale.status === 'VOIDED' ? 'text-gray-600' :
                                    sale.payment_status === 'REVERSED' ? 'text-gray-600' :
                                    sale.payment_status === 'REFUNDED' ? 'text-red-600' :
                                    sale.payment_status === 'PARTIALLY_REFUNDED' ? 'text-orange-600' :
                                    paymentSummary.balance > 0 ? 'text-orange-600' : 
                                    paymentSummary.change > 0 ? 'text-blue-600' : 
                                    'text-green-600'
                                }>
                                    {sale.status === 'VOIDED' ? '$0.00' :
                                     sale.payment_status === 'REVERSED' ? '$0.00' :
                                     sale.payment_status === 'REFUNDED' ? '✓' :
                                     sale.payment_status === 'PARTIALLY_REFUNDED' ? formatCurrency(paymentSummary.total_refunded) :
                                     paymentSummary.balance > 0 ? formatCurrency(paymentSummary.balance) : 
                                     paymentSummary.change > 0 ? formatCurrency(paymentSummary.change) : 
                                     '✓'}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>

                {/* Items */}
                <div className="rounded-lg border border-sidebar-border/70">
                    <div className="p-6 border-b border-sidebar-border/70">
                        <h2 className="text-lg font-semibold">Items ({sale.items.length})</h2>
                    </div>
                    <div className="overflow-x-auto">
                        {(() => {
                            // Check if any item can be canceled (to show/hide Actions column)
                            const hasCancelableItems = sale.items.some((item) => {
                                const deliveredQty = Number(item.delivered_quantity ?? item.deliveredQuantity ?? 0);
                                const canceledQty = Number(item.canceled_quantity ?? item.canceledQuantity ?? 0);
                                const totalQty = Number(item.quantity);
                                const itemStatus = (item.item_status ?? item.itemStatus ?? 'ACTIVE');
                                
                                // Item cannot be canceled if status is CANCELED
                                if (itemStatus === 'CANCELED') {
                                    return false;
                                }
                                
                                const undeliveredQty = totalQty - deliveredQty - canceledQty;
                                const canCancelItem = undeliveredQty > 0;
                                return canCancelItem && sale.status !== 'VOIDED' && sale.status !== 'REFUNDED' && sale.status !== 'PARTIALLY_REFUNDED';
                            });

                            return (
                                <table className="w-full">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-sm font-semibold">Product</th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold">Variant</th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold">Quantity</th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold">Delivered</th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold">Canceled</th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold">Unit Price</th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold">Line Total</th>
                                            <th className="px-6 py-3 text-center text-sm font-semibold">Status</th>
                                            {hasCancelableItems && (
                                                <th className="px-6 py-3 text-center text-sm font-semibold">Actions</th>
                                            )}
                                        </tr>
                                    </thead>
                            <tbody className="divide-y divide-sidebar-border/70">
                                {sale.items.map((item) => {
                                    // Handle both camelCase (from API) and snake_case formats
                                    const productVariant = item.product_variant || item.productVariant;
                                    const product = productVariant?.product;
                                    const category = product?.category;
                                    
                                    if (!productVariant || !product) {
                                        return null; // Skip items with missing data
                                    }
                                    
                                    // Handle both snake_case and camelCase from API
                                    const deliveredQty = Number(item.delivered_quantity ?? item.deliveredQuantity ?? 0);
                                    const canceledQty = Number(item.canceled_quantity ?? item.canceledQuantity ?? 0);
                                    const itemStatus = (item.item_status ?? item.itemStatus ?? 'ACTIVE');
                                    const isCanceled = itemStatus === 'CANCELED';
                                    const isPartiallyAdjusted = itemStatus === 'PARTIAL_ADJUSTED';
                                    const canCancel = canCancelItem(item);
                                    
                                    return (
                                    <tr key={item.id} className={`hover:bg-muted/30 ${isCanceled ? 'opacity-60' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-sm">{product.name}</div>
                                            {category && (
                                                <div className="text-xs text-muted-foreground">
                                                    {category.name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm">{productVariant.description}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-sm">{formatNumber(safeNumber(item.quantity))}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-sm">{formatNumber(safeNumber(deliveredQty))}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={`text-sm ${canceledQty > 0 ? 'text-red-600 font-medium' : ''}`}>
                                                {formatNumber(safeNumber(canceledQty))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-sm">{formatCurrency(item.unit_price)}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={`font-semibold text-sm ${isCanceled ? 'line-through text-muted-foreground' : ''}`}>
                                                {formatCurrency(item.line_total)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {isCanceled ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                                                    Canceled
                                                </span>
                                            ) : isPartiallyAdjusted ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200">
                                                    Partial Adjusted
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                                                    Active
                                                </span>
                                            )}
                                        </td>
                                        {hasCancelableItems && (
                                            <td className="px-6 py-4 text-center">
                                                {canCancel && sale.status !== 'VOIDED' && sale.status !== 'REFUNDED' && sale.status !== 'PARTIALLY_REFUNDED' ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleCancelItem(item)}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <X className="h-4 w-4 mr-1" />
                                                        Cancel
                                                    </Button>
                                                ) : null}
                                            </td>
                                        )}
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                            );
                        })()}
                    </div>
                </div>

                {/* Refunds Section - Show if there are refunds */}
                {sale.refunds && sale.refunds.length > 0 && (
                    <div className="rounded-lg border border-sidebar-border/70">
                        <div className="p-6 border-b border-sidebar-border/70 flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Refunds</h2>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.visit('/refunds')}
                            >
                                View All Refunds
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Amount</th>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Processed By</th>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Reason</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/70">
                                    {sale.refunds.map((refund) => {
                                        // Handle missing processed_by relationship
                                        const processedBy = refund.processed_by || refund.processedBy;
                                        const refundAmount = Number(refund.refund_amount) || 0;
                                        
                                        return (
                                        <tr key={refund.id} className="hover:bg-muted/30">
                                            <td className="px-6 py-4">
                                                <div className="text-sm">
                                                    {refund.created_at ? new Date(refund.created_at).toLocaleString() : '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-semibold text-red-600">
                                                    {formatCurrency(refundAmount)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    refund.type === 'full'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-orange-100 text-orange-800'
                                                }`}>
                                                    {refund.type === 'full' ? 'Full' : 'Partial'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm">{processedBy?.name || 'Unknown'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-muted-foreground">
                                                    {refund.reason || '-'}
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Payment History - Only show if payment is partial (multiple payments or partial status) */}
                {sale.payments && sale.payments.length > 0 && (sale.payment_status === 'PARTIALLY_PAID' || sale.payments.length > 1) && (
                    <div className="rounded-lg border border-sidebar-border/70">
                        <div className="p-6 border-b border-sidebar-border/70 flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Payment History</h2>
                            {/* Only show Add Payment button if not fully paid, not voided, and not refunded */}
                            {sale.status !== 'VOIDED' && 
                             sale.status !== 'REFUNDED' && 
                             sale.payment_status !== 'FULLY_PAID' && 
                             sale.payment_status !== 'REFUNDED' && (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => setIsPaymentModalOpen(true)}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Payment
                                </Button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            {sale.payments && sale.payments.length > 0 ? (
                                <table className="w-full">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-sm font-semibold">Date & Time</th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold">Amount</th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold">Method</th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold">Received By</th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
                                        {sale.payments.map((payment) => {
                                            // Handle missing received_by relationship
                                            const receivedBy = payment.received_by || payment.receivedBy;
                                            const amount = Number(payment.amount) || 0;
                                            
                                            return (
                                            <tr key={payment.id} className="hover:bg-muted/30">
                                                <td className="px-6 py-4">
                                                    <div className="text-sm">
                                                        {payment.received_at ? new Date(payment.received_at).toLocaleString() : '-'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={`text-sm font-semibold ${
                                                        amount < 0 ? 'text-red-600' : 'text-green-600'
                                                    }`}>
                                                        {amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(amount))}
                                                    </div>
                                                    {amount < 0 && (
                                                        <div className="text-xs text-red-600">Refund</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm">{getPaymentMethodLabel(payment.payment_method || 'cash')}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm">{receivedBy?.name || 'Unknown'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-muted-foreground">
                                                        {payment.notes || '-'}
                                                    </div>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-12 text-center text-muted-foreground">
                                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No payments recorded yet</p>
                                    {/* Only show Add Payment button if not fully paid, not voided, and not refunded */}
                                    {sale.status !== 'VOIDED' && 
                                     sale.status !== 'REFUNDED' && 
                                     sale.payment_status !== 'FULLY_PAID' && 
                                     sale.payment_status !== 'REFUNDED' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-4"
                                            onClick={() => setIsPaymentModalOpen(true)}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add First Payment
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Add Payment Modal */}
            <AddPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                saleId={sale.id}
                balance={paymentSummary.balance}
                totalPaid={paymentSummary.total_paid}
                isAdmin={isAdmin}
            />

            {/* Cancel Item Confirmation Modal */}
            <Dialog open={cancelItemModal.isOpen} onOpenChange={(open) => setCancelItemModal({ isOpen: open, item: cancelItemModal.item })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Sale Item</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to cancel this item? This will adjust the sale total and cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {cancelItemModal.item && (() => {
                        const item = cancelItemModal.item;
                        const totalQty = safeNumber(item.quantity);
                        const deliveredQty = Number(item.delivered_quantity ?? item.deliveredQuantity ?? 0);
                        const canceledQty = Number(item.canceled_quantity ?? item.canceledQuantity ?? 0);
                        const maxCancelable = calculateMaxCancelable(item);
                        const quantityToCancel = Number(cancelFormData.quantity_to_cancel) || maxCancelable;
                        
                        // Calculate proportional amount to remove
                        const canceledAmount = (quantityToCancel / totalQty) * item.line_total;
                        const newSaleTotal = sale.total - canceledAmount;
                        const newBalance = Math.max(0, newSaleTotal - paymentSummary.total_paid);
                        const newChange = Math.max(0, paymentSummary.total_paid - newSaleTotal);
                        
                        return (
                            <div className="space-y-4 py-4">
                                <div className="rounded-lg border border-sidebar-border/70 p-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">Product:</span>
                                            <span className="text-sm">
                                                {item.product_variant?.product?.name || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">Variant:</span>
                                            <span className="text-sm">
                                                {item.product_variant?.description || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">Total Quantity:</span>
                                            <span className="text-sm">{totalQty.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">Delivered:</span>
                                            <span className="text-sm">{deliveredQty.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">Already Canceled:</span>
                                            <span className="text-sm text-red-600">{canceledQty.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">Available to Cancel:</span>
                                            <span className="text-sm font-semibold text-green-600">{maxCancelable.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="quantity_to_cancel">Quantity to Cancel</Label>
                                    <Input
                                        id="quantity_to_cancel"
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max={maxCancelable}
                                        value={cancelFormData.quantity_to_cancel}
                                        onChange={(e) => {
                                            const value = Math.min(Math.max(0.01, parseFloat(e.target.value) || 0), maxCancelable);
                                            setCancelFormData('quantity_to_cancel', value);
                                        }}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Maximum: {maxCancelable.toFixed(2)} units
                                    </p>
                                    {cancelErrors.quantity_to_cancel && (
                                        <p className="text-sm text-red-600">{cancelErrors.quantity_to_cancel}</p>
                                    )}
                                </div>
                                <div className="rounded-lg border border-sidebar-border/70 p-4 bg-muted/30">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">Amount to Remove:</span>
                                            <span className="text-sm font-semibold text-red-600">
                                                {formatCurrency(canceledAmount)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-t border-sidebar-border/70 pt-2 mt-2">
                                            <span className="text-sm font-medium">Current Sale Total:</span>
                                            <span className="text-sm font-semibold">
                                                {sale.status === 'VOIDED' ? formatCurrency(0) : formatCurrency(sale.total)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium">New Sale Total:</span>
                                            <span className="text-sm font-semibold text-green-600">
                                                {formatCurrency(newSaleTotal)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium">Current Balance:</span>
                                            <span className="text-sm font-semibold">{formatCurrency(paymentSummary.balance)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium">New Balance:</span>
                                            <span className="text-sm font-semibold">
                                                {formatCurrency(newBalance)}
                                            </span>
                                        </div>
                                        {newChange > 0 && (
                                            <div className="flex justify-between border-t border-sidebar-border/70 pt-2 mt-2">
                                                <span className="text-sm font-medium text-blue-600">Change to Return:</span>
                                                <span className="text-sm font-semibold text-blue-600">
                                                    {formatCurrency(newChange)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reason">Reason for Cancellation (Optional)</Label>
                                    <Textarea
                                        id="reason"
                                        value={cancelFormData.reason}
                                        onChange={(e) => setCancelFormData('reason', e.target.value)}
                                        placeholder="Enter reason for canceling this item..."
                                        rows={3}
                                    />
                                    {cancelErrors.reason && (
                                        <p className="text-sm text-red-600">{cancelErrors.reason}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCancelItemModal({ isOpen: false, item: null })}
                            disabled={cancelProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleCancelItemConfirm}
                            disabled={cancelProcessing}
                        >
                            {cancelProcessing ? 'Processing...' : 'Confirm Cancellation'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
