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

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Inventory',
        href: '/inventory',
    },
    {
        title: 'Adjustment',
        href: '/inventory/adjustment',
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
    current_stock?: number;
    unit?: string;
}

interface Product {
    id: number;
    name: string;
    category: ProductCategory;
    variants: ProductVariant[];
}

interface AdjustmentProps {
    products: Product[];
    reasons: Record<string, string>;
    preselectedProductId?: string | number;
    preselectedVariantId?: string | number;
}

export default function InventoryAdjustment({ products, reasons, preselectedProductId, preselectedVariantId }: AdjustmentProps) {
    const { data, setData, post, processing, errors, reset } = useForm({
        product_id: '',
        product_variant_id: '',
        actual_quantity: '',
        reason: '',
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
        post('/inventory/adjustment', {
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
                    toast.error('Failed to apply adjustment. Please check the form for errors.');
                }
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Inventory Adjustment" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="hidden text-2xl font-bold md:block">Inventory Adjustment</h1>
                </div>

                <div className="max-w-2xl">
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 mb-6 dark:border-yellow-800 dark:bg-yellow-900/20">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>Note:</strong> Use this only for physical count corrections. The system computes
                            stock difference automatically and records the adjustment reason.
                        </p>
                    </div>

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
                                            {selectedVariant.description}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Current stock: {selectedVariant.current_stock ?? 0} {selectedVariant.unit ?? ''}
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
                                                        {variant.description}
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
                            <h2 className="text-lg font-semibold mb-4">Adjustment Details</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="actual_quantity">Actual Count *</Label>
                                    <Input
                                        id="actual_quantity"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.actual_quantity || ''}
                                        onChange={(e) => setData('actual_quantity', e.target.value)}
                                        placeholder="Enter physically counted stock"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        System computes the difference from current stock and records adjustment movement.
                                    </p>
                                    {errors.actual_quantity && (
                                        <p className="text-sm text-red-600 mt-1">{errors.actual_quantity}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="reason">Reason *</Label>
                                    <Select
                                        value={data.reason || ''}
                                        onValueChange={(value) => setData('reason', value)}
                                    >
                                        <SelectTrigger id="reason">
                                            <SelectValue placeholder="Select a reason" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(reasons).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.reason && (
                                        <p className="text-sm text-red-600 mt-1">{errors.reason}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="notes">Notes *</Label>
                                    <Textarea
                                        id="notes"
                                        value={data.notes || ''}
                                        onChange={(e) => setData('notes', e.target.value)}
                                        placeholder="Required: Provide details about this adjustment..."
                                        rows={4}
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Notes are required for audit trail
                                    </p>
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
                                {processing ? 'Processing...' : 'Apply Adjustment'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

