import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit, Plus, Trash2, Package } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { toast } from '@/lib/toast';
import { formatCurrency } from '@/lib/format-currency';
import { ProductImage } from '@/components/product-image';

interface ProductCategory {
    id: number;
    name: string;
}

interface InventoryMovement {
    id: number;
    quantity: number;
    type: 'IN' | 'OUT';
    reason: string;
    created_at: string;
    recorded_by: {
        id: number;
        name: string;
        email: string;
    };
}

interface ProductVariant {
    id: number;
    size: string | null;
    thickness: string | null;
    diameter: string | null;
    description: string;
    unit_price: number;
    purchase_price: number | null;
    inventory: {
        quantity_on_hand: number;
    } | null;
    inventory_movements: InventoryMovement[];
}

interface Product {
    id: number;
    name: string;
    brand: string | null;
    sku: string | null;
    image: string | null;
    base_unit: string;
    track_stock: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    category: ProductCategory;
    variants: ProductVariant[];
}

interface ProductsShowProps {
    product: Product;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: '/products',
    },
    {
        title: 'View',
        href: '/products/{id}',
    },
];

export default function ProductsShow({ product }: ProductsShowProps) {
    const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
    const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);

    const { data: variantData, setData: setVariantData, post, put, processing, errors, reset } = useForm({
        size: '',
        thickness: '',
        diameter: '',
        description: '',
        unit_price: '',
        purchase_price: '',
    });

    const handleCreateVariant = () => {
        reset();
        setEditingVariant(null);
        setIsVariantModalOpen(true);
    };

    const handleEditVariant = (variant: ProductVariant) => {
        setVariantData({
            size: variant.size || '',
            thickness: variant.thickness || '',
            diameter: variant.diameter || '',
            description: variant.description,
            unit_price: variant.unit_price.toString(),
            purchase_price: variant.purchase_price?.toString() || '',
        });
        setEditingVariant(variant);
        setIsVariantModalOpen(true);
    };

    const handleDeleteVariant = (variant: ProductVariant) => {
        if (confirm(`Are you sure you want to delete this variant? This action cannot be undone.`)) {
            router.delete(`/variants/${variant.id}`, {
                onSuccess: () => {
                    // Flash message will be shown automatically
                },
                onError: () => {
                    toast.error('Failed to delete variant.');
                },
            });
        }
    };

    const handleVariantSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingVariant) {
            put(`/variants/${editingVariant.id}`, {
                onSuccess: () => {
                    // Flash message will be shown automatically
                    setIsVariantModalOpen(false);
                    reset();
                },
                onError: (errors) => {
                    const firstError = Object.values(errors)[0];
                    if (firstError) {
                        const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                        toast.error(errorMessage);
                    } else {
                        toast.error('Failed to update variant. Please check the form for errors.');
                    }
                },
            });
        } else {
            post(`/products/${product.id}/variants`, {
                onSuccess: () => {
                    // Flash message will be shown automatically
                    setIsVariantModalOpen(false);
                    reset();
                },
                onError: (errors) => {
                    const firstError = Object.values(errors)[0];
                    if (firstError) {
                        const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                        toast.error(errorMessage);
                    } else {
                        toast.error('Failed to create variant. Please check the form for errors.');
                    }
                },
            });
        }
    };

    const handleViewInventory = (variant: ProductVariant) => {
        router.visit(`/inventory/${variant.id}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Product: ${product.name}`} />

            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="hidden text-2xl font-bold md:block">{product.name}</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Product Details & Variants Management
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        {/* Product Image */}
                        <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                            <h3 className="text-lg font-semibold mb-3">Product Image</h3>
                            <div className="w-full aspect-square max-w-[200px] rounded-lg overflow-hidden">
                                <ProductImage
                                    src={product.image}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    fallbackClassName="w-full h-full"
                                />
                            </div>
                        </div>

                        <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                            <h3 className="text-lg font-semibold mb-3">Product Information</h3>
                            <dl className="space-y-2">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                                    <dd className="text-sm">{product.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Brand</dt>
                                    <dd className="text-sm">{product.brand || 'No brand'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">SKU</dt>
                                    <dd className="text-sm">{product.sku || 'No SKU'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</dt>
                                    <dd className="text-sm">{product.category.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Base Unit</dt>
                                    <dd className="text-sm">{product.base_unit}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Stock Tracking</dt>
                                    <dd className="text-sm">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                            product.track_stock
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                        }`}>
                                            {product.track_stock ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                                    <dd className="text-sm">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                            product.is_active
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                        }`}>
                                            {product.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-semibold">Product Variants ({product.variants.length})</h3>
                                <Button size="sm" onClick={handleCreateVariant}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Variant
                                </Button>
                            </div>

                            {product.variants.length > 0 ? (
                                <div className="space-y-3">
                                    {product.variants.map((variant) => (
                                        <div key={variant.id} className="border border-sidebar-border/50 rounded-md p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="font-medium">{variant.description}</div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() => handleViewInventory(variant)}
                                                        title="View inventory"
                                                    >
                                                        <Package className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() => handleEditVariant(variant)}
                                                        title="Edit variant"
                                                    >
                                                        <Edit className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                                        onClick={() => handleDeleteVariant(variant)}
                                                        title="Delete variant"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                <div>Selling Price: ₱{formatCurrency(variant.unit_price)}</div>
                                                {variant.purchase_price && (
                                                    <div>Purchase Price: ₱{formatCurrency(variant.purchase_price)}</div>
                                                )}
                                                {variant.purchase_price && (
                                                    <div className="font-medium text-green-600 dark:text-green-400">
                                                        Profit: ₱{formatCurrency(variant.unit_price - variant.purchase_price)} 
                                                        ({variant.purchase_price > 0 ? Math.round(((variant.unit_price - variant.purchase_price) / variant.purchase_price) * 100) : 0}%)
                                                    </div>
                                                )}
                                                <div>Stock: {variant.inventory?.quantity_on_hand ?? 0} {product.base_unit}</div>
                                                {variant.size && <div>Size: {variant.size}</div>}
                                                {variant.thickness && <div>Thickness: {variant.thickness}</div>}
                                                {variant.diameter && <div>Diameter: {variant.diameter}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No variants created yet.</p>
                                    <p className="text-sm">Create variants to track different sizes, thicknesses, etc.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Variant Modal */}
                <Dialog open={isVariantModalOpen} onOpenChange={setIsVariantModalOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>
                                {editingVariant ? 'Edit Variant' : 'Create New Variant'}
                            </DialogTitle>
                            <DialogDescription>
                                {editingVariant
                                    ? 'Update the variant details below.'
                                    : 'Add a new variant for this product. At least one physical attribute is required.'
                                }
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleVariantSubmit}>
                            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="size">Size</Label>
                                        <Input
                                            id="size"
                                            value={variantData.size || ''}
                                            onChange={(e) => setVariantData('size', e.target.value)}
                                            placeholder="e.g., 8ft"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="thickness">Thickness</Label>
                                        <Input
                                            id="thickness"
                                            value={variantData.thickness || ''}
                                            onChange={(e) => setVariantData('thickness', e.target.value)}
                                            placeholder="e.g., 0.30mm"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="diameter">Diameter</Label>
                                        <Input
                                            id="diameter"
                                            value={variantData.diameter || ''}
                                            onChange={(e) => setVariantData('diameter', e.target.value)}
                                            placeholder="e.g., 12mm"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="description">Description *</Label>
                                    <Input
                                        id="description"
                                        value={variantData.description || ''}
                                        onChange={(e) => setVariantData('description', e.target.value)}
                                        placeholder="e.g., 8ft .30mm thickness"
                                        required
                                    />
                                    {errors.description && (
                                        <p className="text-sm text-red-600">{errors.description}</p>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="unit_price">Selling Price *</Label>
                                    <Input
                                        id="unit_price"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={variantData.unit_price || ''}
                                        onChange={(e) => setVariantData('unit_price', e.target.value)}
                                        placeholder="0.00"
                                        required
                                    />
                                    {errors.unit_price && (
                                        <p className="text-sm text-red-600">{errors.unit_price}</p>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="purchase_price">Purchase Price (Optional)</Label>
                                    <Input
                                        id="purchase_price"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={variantData.purchase_price || ''}
                                        onChange={(e) => setVariantData('purchase_price', e.target.value)}
                                        placeholder="0.00"
                                    />
                                    {errors.purchase_price && (
                                        <p className="text-sm text-red-600">{errors.purchase_price}</p>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsVariantModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Saving...' : (editingVariant ? 'Update Variant' : 'Create Variant')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
