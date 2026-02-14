import { Head, useForm } from '@inertiajs/react';
import { useState, useMemo } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, AlertCircle } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { toast } from '@/lib/toast';
import { formatCurrency, formatNumber } from '@/lib/format-currency';
import { MobileRecordCard, MobileRecordRow } from '@/components/mobile/record-card';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Sales',
        href: '/sales',
    },
    {
        title: 'Refund',
        href: '/sales/{id}/refund',
    },
];

interface User {
    id: number;
    name: string;
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
    product_variant_id: number;
    quantity: number;
    unit_price: number;
    line_total: number;
    refunded_quantity: number;
    canceled_quantity?: number;
    item_status?: 'ACTIVE' | 'CANCELED' | 'PARTIAL_ADJUSTED';
    refundable_quantity: number;
    product_variant: ProductVariant;
}

interface Sale {
    id: number;
    sale_number: string;
    total: number;
    cashier: User;
}

interface RefundShowProps {
    sale: Sale;
    saleItems: SaleItem[];
    totalRefunded: number;
    remainingRefundable: number;
}

export default function RefundShow({ sale, saleItems, totalRefunded, remainingRefundable }: RefundShowProps) {
    const [refundQuantities, setRefundQuantities] = useState<Record<number, number>>(() => {
        const initial: Record<number, number> = {};
        saleItems.forEach(item => {
            if (item.refundable_quantity > 0) {
                initial[item.id] = 0;
            }
        });
        return initial;
    });

    const [restoreInventory, setRestoreInventory] = useState<Record<number, boolean>>(() => {
        const initial: Record<number, boolean> = {};
        saleItems.forEach(item => {
            initial[item.id] = true; // Default to restoring inventory
        });
        return initial;
    });

    const { data, setData, errors } = useForm({
        items: [] as Array<{
            sale_item_id: number;
            quantity: number;
            restore_inventory: boolean;
        }>,
        reason: '',
        payment_method: 'cash',
    });

    const [processing, setProcessing] = useState(false);

    // Calculate total refund amount
    const totalRefundAmount = useMemo(() => {
        let total = 0;
        Object.entries(refundQuantities).forEach(([itemId, qty]) => {
            if (qty > 0) {
                const item = saleItems.find(i => i.id === parseInt(itemId));
                if (item) {
                    const itemRefundAmount = (qty / item.quantity) * item.line_total;
                    total += itemRefundAmount;
                }
            }
        });
        return total;
    }, [refundQuantities, saleItems]);

    const updateQuantity = (itemId: number, delta: number) => {
        const item = saleItems.find(i => i.id === itemId);
        if (!item) return;

        const current = refundQuantities[itemId] || 0;
        const newQuantity = Math.max(0, Math.min(item.refundable_quantity, current + delta));
        setRefundQuantities({ ...refundQuantities, [itemId]: newQuantity });
    };

    const handleQuantityChange = (itemId: number, value: string) => {
        const item = saleItems.find(i => i.id === itemId);
        if (!item) return;

        const numValue = parseFloat(value) || 0;
        const newQuantity = Math.max(0, Math.min(item.refundable_quantity, numValue));
        setRefundQuantities({ ...refundQuantities, [itemId]: newQuantity });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Prepare items with quantity > 0
        const items = Object.entries(refundQuantities)
            .filter(([_, qty]) => qty > 0)
            .map(([itemId, qty]) => ({
                sale_item_id: parseInt(itemId),
                quantity: qty,
                restore_inventory: restoreInventory[parseInt(itemId)] ?? true,
            }));

        if (items.length === 0) {
            toast.error('Please enter quantities for at least one item to refund');
            return;
        }

        if (totalRefundAmount > remainingRefundable) {
            toast.error(`Refund amount (₱${formatCurrency(totalRefundAmount)}) exceeds remaining refundable amount (₱${formatCurrency(remainingRefundable)})`);
            return;
        }

        // Submit using router.post to ensure data is sent correctly
        setProcessing(true);
        router.post(`/sales/${sale.id}/refund`, {
            items,
            reason: data.reason,
            payment_method: data.payment_method,
        }, {
            onSuccess: () => {
                // Flash message will be shown automatically
                router.visit(`/sales/${sale.id}`);
            },
            onError: (errors) => {
                setProcessing(false);
                const firstError = Object.values(errors)[0];
                const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                toast.error(errorMessage || 'Failed to process refund');
            },
            onFinish: () => {
                setProcessing(false);
            },
        });
    };

    const isFullRefund = totalRefundAmount >= remainingRefundable;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Refund - Sale ${sale.sale_number}`} />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="hidden text-2xl font-bold md:block">Process Refund - Sale {sale.sale_number}</h1>
                            <p className="text-sm text-muted-foreground">Cashier: {sale.cashier.name}</p>
                        </div>
                    </div>
                </div>

                {/* Refund Summary */}
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-lg border border-sidebar-border/70 p-6">
                        <h2 className="text-lg font-semibold mb-4">Refund Summary</h2>
                        <dl className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div>
                                    <dt className="text-sm font-medium text-muted-foreground">Adjusted Sale Total</dt>
                                    <dd className="text-xs text-muted-foreground">(after cancellations)</dd>
                                </div>
                                <dd className="text-sm font-semibold">₱{formatCurrency(sale.total)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-sm font-medium text-muted-foreground">Already Refunded</dt>
                                <dd className="text-sm font-semibold text-orange-600">₱{formatCurrency(totalRefunded)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-sm font-medium text-muted-foreground">Remaining Refundable</dt>
                                <dd className="text-sm font-semibold text-green-600">₱{formatCurrency(remainingRefundable)}</dd>
                            </div>
                            <div className="flex justify-between pt-3 border-t border-sidebar-border/70">
                                <dt className="text-sm font-medium text-muted-foreground">This Refund Amount</dt>
                                <dd className={`text-sm font-bold ${totalRefundAmount > 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                                    ₱{formatCurrency(totalRefundAmount)}
                                </dd>
                            </div>
                            {isFullRefund && (
                                <div className="flex items-center gap-2 text-sm text-blue-600">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>This will be a full refund</span>
                                </div>
                            )}
                        </dl>
                    </div>

                    <div className="rounded-lg border border-sidebar-border/70 p-6">
                        <h2 className="text-lg font-semibold mb-4">Refund Details</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="reason">Reason for Refund</Label>
                                <Textarea
                                    id="reason"
                                    value={data.reason}
                                    onChange={(e) => setData('reason', e.target.value)}
                                    placeholder="Enter reason for refund (optional)"
                                    rows={3}
                                />
                                {errors.reason && (
                                    <p className="text-sm text-destructive mt-1">{errors.reason}</p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="payment_method">Refund Method</Label>
                                <select
                                    id="payment_method"
                                    value={data.payment_method}
                                    onChange={(e) => setData('payment_method', e.target.value)}
                                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                >
                                    <option value="cash">Cash</option>
                                    <option value="gcash">GCash</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="credit">Credit</option>
                                </select>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Refund Items */}
                <div className="rounded-lg border border-sidebar-border/70">
                    <div className="p-6 border-b border-sidebar-border/70">
                        <h2 className="text-lg font-semibold">Select Items to Refund</h2>
                    </div>
                    <div className="space-y-3 p-4 md:hidden">
                        {saleItems.map((item) => {
                            const refundQty = refundQuantities[item.id] || 0;
                            const itemRefundAmount = refundQty > 0
                                ? (refundQty / item.quantity) * item.line_total
                                : 0;
                            const canceledQty = item.canceled_quantity ?? 0;
                            const itemStatus = item.item_status ?? 'ACTIVE';
                            const isCanceled = itemStatus === 'CANCELED';
                            const canRefund = item.refundable_quantity > 0 && !isCanceled;

                            return (
                                <MobileRecordCard
                                    key={`m-refund-item-${item.id}`}
                                    title={item.product_variant.product.name}
                                    subtitle={item.product_variant.description}
                                    value={`₱${formatCurrency(itemRefundAmount)}`}
                                    badges={[
                                        isCanceled
                                            ? { label: 'Canceled', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' }
                                            : item.item_status === 'PARTIAL_ADJUSTED'
                                              ? { label: 'Partial Adjusted', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' }
                                              : { label: 'Active', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' },
                                    ]}
                                >
                                    <MobileRecordRow label="Sold Qty" value={formatNumber(item.quantity)} />
                                    <MobileRecordRow label="Refunded" value={formatNumber(item.refunded_quantity)} />
                                    <MobileRecordRow label="Canceled" value={formatNumber(canceledQty)} />
                                    <MobileRecordRow label="Refundable" value={formatNumber(item.refundable_quantity)} />

                                    {canRefund ? (
                                        <>
                                            <div className="pt-1 text-sm text-muted-foreground">Refund Qty</div>
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => updateQuantity(item.id, -0.5)}
                                                    disabled={refundQty <= 0}
                                                >
                                                    -
                                                </Button>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max={item.refundable_quantity}
                                                    step="0.5"
                                                    value={refundQty}
                                                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                    className="w-24 text-center"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => updateQuantity(item.id, 0.5)}
                                                    disabled={refundQty >= item.refundable_quantity}
                                                >
                                                    +
                                                </Button>
                                            </div>

                                            <div className="flex items-center justify-between pt-2">
                                                <span className="text-sm text-muted-foreground">Restore Inventory</span>
                                                <Checkbox
                                                    checked={restoreInventory[item.id] ?? true}
                                                    onCheckedChange={(checked) =>
                                                        setRestoreInventory({ ...restoreInventory, [item.id]: checked === true })
                                                    }
                                                    disabled={refundQty === 0}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <MobileRecordRow
                                            label="Refund Qty"
                                            value={isCanceled ? 'Canceled - Cannot refund' : 'Not refundable'}
                                        />
                                    )}
                                </MobileRecordCard>
                            );
                        })}

                        <div className="rounded-lg border border-sidebar-border/70 bg-muted/50 p-4">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold">Total Refund Amount</span>
                                <span className="text-lg font-bold text-blue-600">₱{formatCurrency(totalRefundAmount)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-sm font-semibold">Product</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold">Variant</th>
                                    <th className="px-6 py-3 text-right text-sm font-semibold">Sold Qty</th>
                                    <th className="px-6 py-3 text-right text-sm font-semibold">Refunded</th>
                                    <th className="px-6 py-3 text-right text-sm font-semibold">Canceled</th>
                                    <th className="px-6 py-3 text-right text-sm font-semibold">Refundable</th>
                                    <th className="px-6 py-3 text-center text-sm font-semibold">Status</th>
                                    <th className="px-6 py-3 text-right text-sm font-semibold">Refund Qty</th>
                                    <th className="px-6 py-3 text-right text-sm font-semibold">Refund Amount</th>
                                    <th className="px-6 py-3 text-center text-sm font-semibold">Restore Inventory</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/70">
                                {saleItems.map((item) => {
                                    const refundQty = refundQuantities[item.id] || 0;
                                    const itemRefundAmount = refundQty > 0 
                                        ? (refundQty / item.quantity) * item.line_total 
                                        : 0;
                                    const canceledQty = item.canceled_quantity ?? 0;
                                    const itemStatus = item.item_status ?? 'ACTIVE';
                                    const isCanceled = itemStatus === 'CANCELED';
                                    const canRefund = item.refundable_quantity > 0 && !isCanceled;

                                    return (
                                        <tr key={item.id} className={canRefund ? '' : 'opacity-50'}>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium">{item.product_variant.product.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {item.product_variant.product.category.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm">{item.product_variant.description}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-sm">{formatNumber(item.quantity)}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-sm text-orange-600">{formatNumber(item.refunded_quantity)}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className={`text-sm font-medium ${Number(canceledQty) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                    {formatNumber(canceledQty)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className={`text-sm ${canRefund ? 'text-green-600' : 'text-gray-400'}`}>
                                                    {formatNumber(item.refundable_quantity)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {isCanceled ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                                                        Canceled
                                                    </span>
                                                ) : item.item_status === 'PARTIAL_ADJUSTED' ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200">
                                                        Partial Adjusted
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                                                        Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {canRefund ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => updateQuantity(item.id, -0.5)}
                                                            disabled={refundQty <= 0}
                                                        >
                                                            -
                                                        </Button>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max={item.refundable_quantity}
                                                            step="0.5"
                                                            value={refundQty}
                                                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                            className="w-20 text-center"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => updateQuantity(item.id, 0.5)}
                                                            disabled={refundQty >= item.refundable_quantity}
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-muted-foreground text-right">
                                                        {isCanceled ? 'Canceled - Cannot refund' : 'Not refundable'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-sm font-semibold">
                                                    ₱{formatCurrency(itemRefundAmount)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Checkbox
                                                    checked={restoreInventory[item.id] ?? true}
                                                    onCheckedChange={(checked) => 
                                                        setRestoreInventory({ ...restoreInventory, [item.id]: checked === true })
                                                    }
                                                    disabled={!canRefund || refundQty === 0}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-muted/50">
                                <tr>
                                    <td colSpan={8} className="px-6 py-4 text-right font-semibold">
                                        Total Refund Amount:
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-lg font-bold text-blue-600">
                                            ₱{formatCurrency(totalRefundAmount)}
                                        </div>
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => router.visit(`/sales/${sale.id}`)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={processing || totalRefundAmount === 0}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {processing ? (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Process Refund
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}


