import { useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/lib/toast';

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

interface AdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    reasons: Record<string, string>;
    preselectedProductId?: string | number;
    preselectedVariantId?: string | number;
    onSuccess?: () => void;
}

export function AdjustmentModal({ isOpen, onClose, products, reasons, preselectedProductId, preselectedVariantId, onSuccess }: AdjustmentModalProps) {
    const { data, setData, post, processing, errors, reset } = useForm({
        product_id: '',
        product_variant_id: '',
        quantity: '',
        reason: '',
        notes: '',
    });

    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

    // Initialize form with preselected values from props
    useEffect(() => {
        if (!isOpen) return;
        if (products.length === 0) return;
        if (!preselectedProductId || !preselectedVariantId) {
            reset();
            setSelectedProduct(null);
            setSelectedVariant(null);
            return;
        }

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
    }, [isOpen, products, preselectedProductId, preselectedVariantId, setData, reset]);

    const isPreselected = !!preselectedProductId && !!preselectedVariantId;

    const handleProductChange = (productId: string) => {
        setData('product_id', productId);
        setData('product_variant_id', ''); // Reset variant when product changes
        const product = products.find(p => p.id.toString() === productId);
        setSelectedProduct(product || null);
        setSelectedVariant(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/inventory/adjustment', {
            preserveState: false,
            preserveScroll: false,
            onSuccess: () => {
                // Flash message will be shown automatically
                reset();
                setSelectedProduct(null);
                setSelectedVariant(null);
                onClose();
                onSuccess?.();
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

    const handleClose = () => {
        reset();
        setSelectedProduct(null);
        setSelectedVariant(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Inventory Adjustment</DialogTitle>
                    <DialogDescription>
                        Use adjustments for damage, loss, recount corrections, initial stock, or other inventory changes.
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 mb-4 dark:border-yellow-800 dark:bg-yellow-900/20">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                        <strong>Note:</strong> Quantity can be positive (add) or negative (subtract).
                    </p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                            <h3 className="text-sm font-semibold mb-3">Product Information</h3>
                            
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
                                            onValueChange={(value) => {
                                                setData('product_variant_id', value);
                                                const variant = selectedProduct?.variants.find(v => v.id.toString() === value);
                                                setSelectedVariant(variant || null);
                                            }}
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

                        <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                            <h3 className="text-sm font-semibold mb-3">Adjustment Details</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="quantity">Quantity *</Label>
                                    <Input
                                        id="quantity"
                                        type="number"
                                        step="0.01"
                                        value={data.quantity || ''}
                                        onChange={(e) => setData('quantity', e.target.value)}
                                        placeholder="Positive to add, negative to subtract"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Use positive numbers to add stock, negative numbers to subtract stock
                                    </p>
                                    {errors.quantity && (
                                        <p className="text-sm text-red-600 mt-1">{errors.quantity}</p>
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
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Processing...' : 'Apply Adjustment'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

