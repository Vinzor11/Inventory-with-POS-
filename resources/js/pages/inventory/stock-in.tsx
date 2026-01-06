import { Head, useForm } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { toast } from '@/lib/toast';
import { formatCurrency } from '@/lib/format-currency';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Inventory',
        href: '/inventory',
    },
    {
        title: 'Stock-In',
        href: '/inventory/stock-in',
    },
];

interface ProductCategory {
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
    category: ProductCategory;
    variants: ProductVariant[];
}

interface StockInProps {
    products: Product[];
    preselectedProductId?: string | number;
    preselectedVariantId?: string | number;
}

export default function StockIn({ products, preselectedProductId, preselectedVariantId }: StockInProps) {
    const { data, setData, post, processing, errors, reset } = useForm({
        product_id: '',
        product_variant_id: '',
        quantity: '',
        unit_cost: '',
        notes: '',
    });

    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

    // Initialize form with preselected values from props
    useEffect(() => {
        if (products.length === 0) return;
        if (!preselectedProductId || !preselectedVariantId) return;

        const productId = preselectedProductId.toString();
        const variantId = preselectedVariantId.toString();
        
        // Find the product and variant
        const product = products.find(p => p.id.toString() === productId);
        if (product) {
            const variant = product.variants.find(v => v.id.toString() === variantId);
            if (variant) {
                setSelectedProduct(product);
                setSelectedVariant(variant);
                setData('product_id', productId);
                setData('product_variant_id', variantId);
            }
        }
    }, [products, preselectedProductId, preselectedVariantId, setData]);

    const isPreselected = !!preselectedProductId && !!preselectedVariantId;

    const handleProductChange = (productId: string) => {
        setData('product_id', productId);
        setData('product_variant_id', ''); // Reset variant when product changes
        const product = products.find(p => p.id.toString() === productId);
        setSelectedProduct(product || null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/inventory/stock-in', {
            onSuccess: () => {
                // Flash message will be shown automatically
                reset();
                setSelectedProduct(null);
                setSelectedVariant(null);
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                if (firstError) {
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    toast.error(errorMessage);
                } else {
                    toast.error('Failed to receive stock. Please check the form for errors.');
                }
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Stock-In" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Stock-In (Receiving / Purchase)</h1>
                </div>

                <div className="max-w-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                            <h2 className="text-lg font-semibold mb-4">Product Information</h2>
                            
                            {isPreselected && selectedProduct && selectedVariant ? (
                                <div className="space-y-2">
                                    <div>
                                        <Label>Product</Label>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {selectedProduct.name} ({selectedProduct.category.name})
                                        </p>
                                    </div>
                                    <div>
                                        <Label>Variant</Label>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {selectedVariant.description} - ₱{formatCurrency(selectedVariant.unit_price)}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="product_id">Product *</Label>
                                        <Select
                                            value={data.product_id || ''}
                                            onValueChange={handleProductChange}
                                        >
                                            <SelectTrigger id="product_id">
                                                <SelectValue placeholder="Select a product" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {products.map((product) => (
                                                    <SelectItem key={product.id} value={product.id.toString()}>
                                                        {product.name} ({product.category.name})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.product_id && (
                                            <p className="text-sm text-red-600 mt-1">{errors.product_id}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="product_variant_id">Variant *</Label>
                                        <Select
                                            value={data.product_variant_id || ''}
                                            onValueChange={(value) => setData('product_variant_id', value)}
                                            disabled={!selectedProduct}
                                        >
                                            <SelectTrigger id="product_variant_id">
                                                <SelectValue placeholder={selectedProduct ? "Select a variant" : "Select a product first"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectedProduct?.variants.map((variant) => (
                                                    <SelectItem key={variant.id} value={variant.id.toString()}>
                                                        {variant.description} (₱{formatCurrency(variant.unit_price)})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.product_variant_id && (
                                            <p className="text-sm text-red-600 mt-1">{errors.product_variant_id}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                            <h2 className="text-lg font-semibold mb-4">Stock Details</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="quantity">Quantity *</Label>
                                    <Input
                                        id="quantity"
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={data.quantity || ''}
                                        onChange={(e) => setData('quantity', e.target.value)}
                                        placeholder="0.00"
                                        required
                                    />
                                    {errors.quantity && (
                                        <p className="text-sm text-red-600 mt-1">{errors.quantity}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="unit_cost">Unit Cost *</Label>
                                    <Input
                                        id="unit_cost"
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={data.unit_cost || ''}
                                        onChange={(e) => setData('unit_cost', e.target.value)}
                                        placeholder="0.00"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        The cost per unit when purchasing this stock
                                    </p>
                                    {errors.unit_cost && (
                                        <p className="text-sm text-red-600 mt-1">{errors.unit_cost}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="notes">Notes (Optional)</Label>
                                    <Textarea
                                        id="notes"
                                        value={data.notes || ''}
                                        onChange={(e) => setData('notes', e.target.value)}
                                        placeholder="Additional notes about this stock-in..."
                                        rows={3}
                                    />
                                    {errors.notes && (
                                        <p className="text-sm text-red-600 mt-1">{errors.notes}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.visit('/inventory')}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Processing...' : 'Receive Stock'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
