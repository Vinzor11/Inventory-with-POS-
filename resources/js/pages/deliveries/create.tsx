import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Deliveries', href: '/deliveries' },
    { title: 'Create', href: '/deliveries/create' },
];

interface Sale {
    id: number;
    sale_number: string;
}

interface User {
    id: number;
    name: string;
}

interface ProductVariant {
    id: number;
    description: string;
    unit_price: number;
}

interface Product {
    id: number;
    name: string;
    category: { id: number; name: string } | null;
    variants: ProductVariant[];
}

interface DeliveriesCreateProps {
    sales: Sale[];
    users: User[];
    products: Product[];
    preselectedSaleId?: string | number;
}

export default function DeliveriesCreate({ sales, users, products, preselectedSaleId }: DeliveriesCreateProps) {
    const { data, setData, post, processing, errors } = useForm({
        sale_id: preselectedSaleId?.toString() || '',
        delivered_by_user_id: '',
        delivered_at: new Date().toISOString().slice(0, 16),
        status: 'pending' as 'pending' | 'delivered',
        notes: '',
        items: [] as Array<{ product_variant_id: string; quantity: string }>,
    });

    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const handleAddItem = () => {
        setData('items', [
            ...data.items,
            { product_variant_id: '', quantity: '' },
        ]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = data.items.filter((_, i) => i !== index);
        setData('items', newItems);
    };

    const handleItemChange = (index: number, field: 'product_variant_id' | 'quantity', value: string) => {
        const newItems = [...data.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setData('items', newItems);

        if (field === 'product_variant_id') {
            const variant = selectedProduct?.variants.find(v => v.id.toString() === value);
            if (variant) {
                const product = products.find(p => p.variants.some(v => v.id.toString() === value));
                setSelectedProduct(product || null);
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/deliveries', {
            onSuccess: () => {
                // Flash message will be shown automatically
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                if (firstError) {
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    toast.error(errorMessage);
                } else {
                    toast.error('Failed to create delivery. Please check the form for errors.');
                }
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Delivery" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="hidden text-2xl font-bold md:block">Create Delivery</h1>
                </div>

                <div className="max-w-4xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                            <h2 className="text-lg font-semibold mb-4">Delivery Information</h2>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="sale_id">Sale *</Label>
                                    <Select value={data.sale_id || ''} onValueChange={(value) => setData('sale_id', value)}>
                                        <SelectTrigger id="sale_id">
                                            <SelectValue placeholder="Select a sale" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sales.map((sale) => (
                                                <SelectItem key={sale.id} value={sale.id.toString()}>
                                                    {sale.sale_number}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.sale_id && <p className="text-sm text-red-600 mt-1">{errors.sale_id}</p>}
                                </div>

                                <div>
                                    <Label htmlFor="delivered_by_user_id">Delivered By *</Label>
                                    <Select value={data.delivered_by_user_id || ''} onValueChange={(value) => setData('delivered_by_user_id', value)}>
                                        <SelectTrigger id="delivered_by_user_id">
                                            <SelectValue placeholder="Select a user" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users.map((user) => (
                                                <SelectItem key={user.id} value={user.id.toString()}>
                                                    {user.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.delivered_by_user_id && <p className="text-sm text-red-600 mt-1">{errors.delivered_by_user_id}</p>}
                                </div>

                                <div>
                                    <Label htmlFor="delivered_at">Delivered At *</Label>
                                    <Input
                                        id="delivered_at"
                                        type="datetime-local"
                                        value={data.delivered_at || ''}
                                        onChange={(e) => setData('delivered_at', e.target.value)}
                                        required
                                    />
                                    {errors.delivered_at && <p className="text-sm text-red-600 mt-1">{errors.delivered_at}</p>}
                                </div>

                                <div>
                                    <Label htmlFor="status">Status *</Label>
                                    <Select value={data.status} onValueChange={(value) => setData('status', value as 'pending' | 'delivered')}>
                                        <SelectTrigger id="status">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="delivered">Delivered</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.status && <p className="text-sm text-red-600 mt-1">{errors.status}</p>}
                                </div>

                                <div>
                                    <Label htmlFor="notes">Notes</Label>
                                    <Textarea
                                        id="notes"
                                        value={data.notes || ''}
                                        onChange={(e) => setData('notes', e.target.value)}
                                        rows={3}
                                    />
                                    {errors.notes && <p className="text-sm text-red-600 mt-1">{errors.notes}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Delivery Items</h2>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Item
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {data.items.map((item, index) => (
                                    <div key={index} className="flex gap-2 items-end p-4 border rounded-lg">
                                        <div className="flex-1">
                                            <Label>Product & Variant *</Label>
                                            <Select
                                                value={item.product_variant_id || ''}
                                                onValueChange={(value) => {
                                                    handleItemChange(index, 'product_variant_id', value);
                                                    const product = products.find(p => p.variants.some(v => v.id.toString() === value));
                                                    setSelectedProduct(product || null);
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select product variant" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {products.map((product) => (
                                                        <div key={product.id}>
                                                            <div className="px-2 py-1 text-xs font-semibold text-gray-500">{product.name}</div>
                                                            {product.variants.map((variant) => (
                                                                <SelectItem key={variant.id} value={variant.id.toString()}>
                                                                    {variant.description}
                                                                </SelectItem>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors[`items.${index}.product_variant_id`] && (
                                                <p className="text-sm text-red-600 mt-1">{errors[`items.${index}.product_variant_id`]}</p>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <Label>Quantity *</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                value={item.quantity || ''}
                                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                placeholder="0.00"
                                            />
                                            {errors[`items.${index}.quantity`] && (
                                                <p className="text-sm text-red-600 mt-1">{errors[`items.${index}.quantity`]}</p>
                                            )}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveItem(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {data.items.length === 0 && (
                                    <p className="text-sm text-gray-500 text-center py-4">No items added. Click "Add Item" to add delivery items.</p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => router.visit('/deliveries')}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing || data.items.length === 0}>
                                {processing ? 'Creating...' : 'Create Delivery'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}


