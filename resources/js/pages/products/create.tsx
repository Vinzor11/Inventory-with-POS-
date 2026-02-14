import { Head, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { toast } from '@/lib/toast';

interface ProductCategory {
    id: number;
    name: string;
}

interface ProductsCreateProps {
    categories: ProductCategory[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: '/products',
    },
    {
        title: 'Create',
        href: '/products/create',
    },
];

export default function ProductsCreate({ categories }: ProductsCreateProps) {
    const { data, setData, post, processing, errors } = useForm({
        category_id: '',
        name: '',
        brand: '',
        sku: '',
        base_unit: 'pcs',
        track_stock: true,
        is_active: true,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/products', {
            onSuccess: () => {
                // Flash message will be shown automatically
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                if (firstError) {
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    toast.error(errorMessage);
                } else {
                    toast.error('Failed to create product. Please check the form for errors.');
                }
            },
        });
    };

    const baseUnits = ['pcs', 'bag', 'sheet', 'kg', 'length', 'meter', 'liter', 'box'];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Product" />

            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex items-center">
                    <h1 className="hidden text-2xl font-bold md:block">Create Product</h1>
                </div>

                <div className="max-w-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="category_id">Category *</Label>
                            <select
                                id="category_id"
                                value={data.category_id || ''}
                                onChange={(e) => setData('category_id', e.target.value)}
                                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
                                required
                            >
                                <option value="">Select a category</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                            {errors.category_id && (
                                <p className="text-sm text-red-600">{errors.category_id}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="name">Product Name *</Label>
                            <Input
                                id="name"
                                value={data.name || ''}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Enter product name"
                                required
                            />
                            {errors.name && (
                                <p className="text-sm text-red-600">{errors.name}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="brand">Brand</Label>
                            <Input
                                id="brand"
                                value={data.brand || ''}
                                onChange={(e) => setData('brand', e.target.value)}
                                placeholder="Enter brand name (optional)"
                            />
                            {errors.brand && (
                                <p className="text-sm text-red-600">{errors.brand}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="sku">SKU</Label>
                            <Input
                                id="sku"
                                value={data.sku || ''}
                                onChange={(e) => setData('sku', e.target.value)}
                                placeholder="Enter SKU (optional)"
                            />
                            {errors.sku && (
                                <p className="text-sm text-red-600">{errors.sku}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="base_unit">Base Unit *</Label>
                            <select
                                id="base_unit"
                                value={data.base_unit || ''}
                                onChange={(e) => setData('base_unit', e.target.value)}
                                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
                                required
                            >
                                {baseUnits.map((unit) => (
                                    <option key={unit} value={unit}>
                                        {unit}
                                    </option>
                                ))}
                            </select>
                            {errors.base_unit && (
                                <p className="text-sm text-red-600">{errors.base_unit}</p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="track_stock"
                                    checked={data.track_stock}
                                    onCheckedChange={(checked) => setData('track_stock', !!checked)}
                                />
                                <Label htmlFor="track_stock">Track Stock</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="is_active"
                                    checked={data.is_active}
                                    onCheckedChange={(checked) => setData('is_active', !!checked)}
                                />
                                <Label htmlFor="is_active">Active</Label>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Creating...' : 'Create Product'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

