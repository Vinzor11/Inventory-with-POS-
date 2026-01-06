import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Truck, CheckCircle2, Clock, AlertCircle, Plus, Minus } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { toast } from '@/lib/toast';
import { formatNumber } from '@/lib/format-currency';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Sales',
        href: '/sales',
    },
    {
        title: 'Delivery',
        href: '/sales/{id}/delivery',
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
    product_variant_id: number;
    quantity: number;
    unit_price: number;
    line_total: number;
    delivered_quantity: number;
    refunded_quantity: number;
    canceled_quantity?: number;
    item_status?: 'ACTIVE' | 'CANCELED' | 'PARTIAL_ADJUSTED';
    remaining_quantity: number;
    product_variant: ProductVariant;
}

interface Sale {
    id: number;
    sale_number: string;
    delivery_status: 'PENDING' | 'PARTIAL' | 'DELIVERED' | 'RETURNED' | 'CANCELED' | null;
    cashier: User;
}

interface Delivery {
    id: number;
    status: 'pending' | 'partial' | 'delivered';
    delivered_by_user_id: number | null;
    delivered_at: string | null;
    notes: string | null;
    items: Array<{
        id: number;
        quantity: number;
        product_variant: ProductVariant;
    }>;
    delivered_by: User | null;
}

interface Sale {
    id: number;
    sale_number: string;
    delivery_status: 'PENDING' | 'PARTIAL' | 'DELIVERED' | 'RETURNED' | 'CANCELED' | null;
    cashier: User;
}

interface DeliveryForSaleProps {
    sale: Sale;
    deliveries: Delivery[];
    saleItems: SaleItem[];
    users: User[];
}

export default function DeliveryForSale({ sale, deliveries, saleItems, users }: DeliveryForSaleProps) {
    const [deliveryQuantities, setDeliveryQuantities] = useState<Record<number, number>>(() => {
        const initial: Record<number, number> = {};
        saleItems.forEach(item => {
            if (item.remaining_quantity > 0) {
                initial[item.product_variant_id] = 0;
            }
        });
        return initial;
    });

    const { data, setData, post, processing, errors } = useForm({
        items: [] as Array<{ product_variant_id: number; quantity: number }>,
        delivered_by_user_id: '',
        delivered_at: new Date().toISOString().slice(0, 16),
        notes: '',
    });

    const updateQuantity = (variantId: number, delta: number) => {
        const item = saleItems.find(i => i.product_variant_id === variantId);
        if (!item || !item.product_variant) return; // Skip if product variant is missing

        const current = deliveryQuantities[variantId] || 0;
        const newQuantity = Math.max(0, Math.min(item.remaining_quantity, current + delta));
        setDeliveryQuantities({ ...deliveryQuantities, [variantId]: newQuantity });
    };

    const handleQuantityChange = (variantId: number, value: string) => {
        const item = saleItems.find(i => i.product_variant_id === variantId);
        if (!item || !item.product_variant) return; // Skip if product variant is missing

        const numValue = parseFloat(value) || 0;
        const newQuantity = Math.max(0, Math.min(item.remaining_quantity, numValue));
        setDeliveryQuantities({ ...deliveryQuantities, [variantId]: newQuantity });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Prepare items with quantity > 0
        const items = Object.entries(deliveryQuantities)
            .filter(([_, qty]) => qty > 0)
            .map(([variantId, qty]) => ({
                product_variant_id: parseInt(variantId),
                quantity: qty,
            }));

        if (items.length === 0) {
            toast.error('Please enter quantities for at least one item');
            return;
        }

        if (!data.delivered_by_user_id) {
            toast.error('Please select who will deliver');
            return;
        }

        // Submit using router.post to ensure data is sent correctly
        router.post(`/sales/${sale.id}/deliveries`, {
            items,
            delivered_by_user_id: parseInt(data.delivered_by_user_id),
            delivered_at: data.delivered_at,
            notes: data.notes,
        }, {
            onSuccess: () => {
                // Redirect back to sales page
                router.visit('/sales');
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                toast.error(errorMessage || 'Failed to add delivery items');
            },
        });
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            pending: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-700 dark:text-yellow-200', icon: Clock },
            partial: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-200', icon: AlertCircle },
            delivered: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-700 dark:text-green-200', icon: CheckCircle2 },
        };
        const style = styles[status as keyof typeof styles] || styles.pending;
        const Icon = style.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                <Icon className="h-3 w-3" />
                {status.toUpperCase()}
            </span>
        );
    };

    const getSaleDeliveryStatusBadge = (status: string | null) => {
        if (!status) return null;
        const styles = {
            PENDING: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', label: 'Pending' },
            PARTIAL: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-700 dark:text-yellow-200', label: 'Partial' },
            DELIVERED: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-700 dark:text-green-200', label: 'Delivered' },
            RETURNED: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-700 dark:text-red-200', label: 'Returned' },
            CANCELED: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', label: 'Canceled' },
        };
        const style = styles[status as keyof typeof styles] || styles.PENDING;
        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                {style.label}
            </span>
        );
    };

    // Check if there are any items that can actually be delivered
    // An item can be delivered if:
    // 1. It has remaining_quantity > 0
    // 2. It's not fully canceled (item_status !== 'CANCELED')
    // 3. It has a valid product variant
    const hasRemainingItems = saleItems.some(item => {
        const itemStatus = item.item_status ?? 'ACTIVE';
        const isCanceled = itemStatus === 'CANCELED';
        return item.remaining_quantity > 0 && !isCanceled && item.product_variant;
    });
    const canAddItems = sale.delivery_status === 'PENDING' || sale.delivery_status === 'PARTIAL';
    
    // Check if we should show Refunded and Canceled columns
    const hasRefundedItems = saleItems.some(item => (item.refunded_quantity || 0) > 0);
    const hasCanceledItems = saleItems.some(item => (item.canceled_quantity || 0) > 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Delivery - Sale ${sale.sale_number}`} />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold">Delivery - Sale {sale.sale_number}</h1>
                            <p className="text-sm text-muted-foreground">Cashier: {sale.cashier.name}</p>
                        </div>
                    </div>
                    <div>
                        {getSaleDeliveryStatusBadge(sale.delivery_status)}
                    </div>
                </div>

                {/* Delivery Information */}
                <div className="rounded-lg border border-sidebar-border/70 p-6">
                    <h2 className="text-lg font-semibold mb-4">Delivery Information</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm text-muted-foreground">Sale Delivery Status</Label>
                            <div className="mt-1">{getSaleDeliveryStatusBadge(sale.delivery_status)}</div>
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground">Total Deliveries</Label>
                            <div className="mt-1 text-sm font-medium">{deliveries?.length || 0}</div>
                        </div>
                    </div>
                </div>

                {/* Existing Deliveries */}
                {deliveries && deliveries.length > 0 && (
                    <div className="rounded-lg border border-sidebar-border/70">
                        <div className="p-6 border-b border-sidebar-border/70">
                            <h2 className="text-lg font-semibold">Delivery History</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                All deliveries for this sale
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Delivery #</th>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Delivered By</th>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Delivered At</th>
                                        <th className="px-6 py-3 text-right text-sm font-semibold">Items</th>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/70">
                                    {deliveries.map((delivery, index) => (
                                        <tr key={delivery.id} className="hover:bg-muted/30">
                                            <td className="px-6 py-4 text-sm font-medium">
                                                #{deliveries.length - index}
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(delivery.status)}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {delivery.delivered_by?.name || 'Not assigned'}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleString() : 'Pending'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm">
                                                {delivery.items?.length || 0} item(s)
                                            </td>
                                            <td className="px-6 py-4">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => router.visit(`/deliveries/${delivery.id}`)}
                                                >
                                                    View Details
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Sale Items with Delivery Quantities */}
                <div className="rounded-lg border border-sidebar-border/70">
                    <div className="p-6 border-b border-sidebar-border/70">
                        <h2 className="text-lg font-semibold">Items to Deliver</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Enter quantities for items to deliver. Remaining quantities are read-only.
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-sm font-semibold">Product</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold">Variant</th>
                                    <th className="px-6 py-3 text-right text-sm font-semibold">Sold</th>
                                    {hasRefundedItems && (
                                        <th className="px-6 py-3 text-right text-sm font-semibold">Refunded</th>
                                    )}
                                    <th className="px-6 py-3 text-right text-sm font-semibold">Delivered</th>
                                    {hasCanceledItems && (
                                        <th className="px-6 py-3 text-right text-sm font-semibold">Canceled</th>
                                    )}
                                    <th className="px-6 py-3 text-right text-sm font-semibold">Remaining</th>
                                    <th className="px-6 py-3 text-center text-sm font-semibold">Status</th>
                                    <th className="px-6 py-3 text-right text-sm font-semibold">Deliver Qty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/70">
                                {saleItems.map((item) => {
                                    const canceledQty = Number(item.canceled_quantity ?? 0);
                                    const itemStatus = item.item_status ?? 'ACTIVE';
                                    const isCanceled = itemStatus === 'CANCELED';
                                    const isPartiallyAdjusted = itemStatus === 'PARTIAL_ADJUSTED';
                                    
                                    return (
                                    <tr key={item.id} className={`hover:bg-muted/30 ${isCanceled ? 'opacity-60' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-sm">
                                                {item.product_variant?.product?.name || 'Product Not Found'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {item.product_variant?.product?.category?.name || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm">
                                                {item.product_variant?.description || 'Variant Not Found'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-sm">{formatNumber(item.quantity)}</div>
                                        </td>
                                        {hasRefundedItems && (
                                            <td className="px-6 py-4 text-right">
                                                <div className={`text-sm font-medium ${
                                                    item.refunded_quantity > 0 ? 'text-red-600' : 'text-gray-600'
                                                }`}>
                                                    {formatNumber(item.refunded_quantity || 0)}
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-right">
                                            <div className={`text-sm font-medium ${
                                                item.delivered_quantity > 0 ? 'text-green-600' : 'text-gray-600'
                                            }`}>
                                                {formatNumber(item.delivered_quantity)}
                                            </div>
                                        </td>
                                        {hasCanceledItems && (
                                            <td className="px-6 py-4 text-right">
                                                <div className={`text-sm font-medium ${
                                                    canceledQty > 0 ? 'text-red-600' : 'text-gray-600'
                                                }`}>
                                                    {canceledQty.toFixed(2)}
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-right">
                                            <div className={`text-sm font-medium ${
                                                item.remaining_quantity > 0 ? 'text-orange-600' : 'text-gray-600'
                                            }`}>
                                                {formatNumber(item.remaining_quantity)}
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
                                        <td className="px-6 py-4">
                                            {item.product_variant && item.remaining_quantity > 0 && canAddItems && itemStatus !== 'CANCELED' ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => updateQuantity(item.product_variant_id, -0.50)}
                                                        disabled={(deliveryQuantities[item.product_variant_id] || 0) <= 0}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        step="0.50"
                                                        min="0"
                                                        max={item.remaining_quantity}
                                                        value={(deliveryQuantities[item.product_variant_id] || 0).toFixed(2)}
                                                        onChange={(e) => handleQuantityChange(item.product_variant_id, e.target.value)}
                                                        className="w-20 text-center"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => updateQuantity(item.product_variant_id, 0.50)}
                                                        disabled={(deliveryQuantities[item.product_variant_id] || 0) >= item.remaining_quantity}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground text-right">
                                                    {!item.product_variant ? 'Product Unavailable' :
                                                     itemStatus === 'CANCELED' ? 'Canceled' :
                                                     isCanceled ? 'Canceled' :
                                                     item.remaining_quantity === 0 && canceledQty > 0 ? 'Canceled' :
                                                     item.remaining_quantity === 0 ? 'Fully Delivered' : 'N/A'}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Add Delivery Items Form */}
                {hasRemainingItems && canAddItems && (
                    <form onSubmit={handleSubmit} className="rounded-lg border border-sidebar-border/70 p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Confirm Delivery</h2>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="delivered_by_user_id">Delivered By *</Label>
                                <Select
                                    value={data.delivered_by_user_id}
                                    onValueChange={(value) => setData('delivered_by_user_id', value)}
                                >
                                    <SelectTrigger id="delivered_by_user_id">
                                        <SelectValue placeholder="Select person" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map((user) => (
                                            <SelectItem key={user.id} value={String(user.id)}>
                                                {user.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.delivered_by_user_id && (
                                    <p className="text-sm text-destructive">{errors.delivered_by_user_id}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="delivered_at">Delivery Date & Time *</Label>
                                <Input
                                    id="delivered_at"
                                    type="datetime-local"
                                    value={data.delivered_at}
                                    onChange={(e) => setData('delivered_at', e.target.value)}
                                    required
                                />
                                {errors.delivered_at && (
                                    <p className="text-sm text-destructive">{errors.delivered_at}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes (Optional)</Label>
                            <Textarea
                                id="notes"
                                placeholder="Add delivery notes..."
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                rows={3}
                            />
                            {errors.notes && (
                                <p className="text-sm text-destructive">{errors.notes}</p>
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.visit('/sales')}
                                disabled={processing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={processing || Object.values(deliveryQuantities).every(qty => qty === 0)}
                            >
                                <Truck className="h-4 w-4 mr-2" />
                                {processing ? 'Processing...' : 'Confirm Delivery'}
                            </Button>
                        </div>
                    </form>
                )}

                {!hasRemainingItems && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
                        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
                        <p className="text-lg font-semibold text-green-900">All items have been delivered</p>
                        <p className="text-sm text-green-700 mt-1">This delivery is complete.</p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

