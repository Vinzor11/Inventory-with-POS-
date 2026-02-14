import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Package, TrendingUp, TrendingDown } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { formatCurrency } from '@/lib/format-currency';

interface ProductCategory {
    id: number;
    name: string;
}

interface Product {
    id: number;
    name: string;
    brand: string | null;
    sku: string | null;
    base_unit: string;
    category: ProductCategory;
}

interface User {
    id: number;
    name: string;
    email: string;
}

interface InventoryMovement {
    id: number;
    quantity: number;
    type: 'IN' | 'OUT';
    reason: string;
    reference_id: number | null;
    unit_cost: number;
    created_at: string;
    recorded_by: User;
}

interface Inventory {
    quantity_on_hand: number;
}

interface ProductVariant {
    id: number;
    size: string | null;
    thickness: string | null;
    diameter: string | null;
    description: string;
    unit_price: number;
    product: Product;
    inventory: Inventory | null;
    inventory_movements: InventoryMovement[];
}

interface InventoryShowProps {
    variant: ProductVariant;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Inventory',
        href: '/inventory',
    },
    {
        title: 'Details',
        href: '/inventory/{id}',
    },
];

export default function InventoryShow({ variant }: InventoryShowProps) {
    const currentStock = variant.inventory?.quantity_on_hand ?? 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Inventory: ${variant.product.name} - ${variant.description}`} />

            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="hidden text-2xl font-bold md:block">Inventory Details</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {variant.product.name} - {variant.description}
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                            <h3 className="text-lg font-semibold mb-3">Product Information</h3>
                            <dl className="space-y-2">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Product</dt>
                                    <dd className="text-sm">{variant.product.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Variant</dt>
                                    <dd className="text-sm">{variant.description}</dd>
                                </div>
                                {variant.size && (
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Size</dt>
                                        <dd className="text-sm">{variant.size}</dd>
                                    </div>
                                )}
                                {variant.thickness && (
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Thickness</dt>
                                        <dd className="text-sm">{variant.thickness}</dd>
                                    </div>
                                )}
                                {variant.diameter && (
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Diameter</dt>
                                        <dd className="text-sm">{variant.diameter}</dd>
                                    </div>
                                )}
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Unit Price</dt>
                                    <dd className="text-sm">₱{formatCurrency(variant.unit_price)}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</dt>
                                    <dd className="text-sm">{variant.product.category.name}</dd>
                                </div>
                            </dl>
                        </div>

                        <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                            <h3 className="text-lg font-semibold mb-3">Current Stock</h3>
                            <div className="flex items-center gap-3">
                                <Package className="h-8 w-8 text-gray-400" />
                                <div>
                                    <div className="text-3xl font-bold">{currentStock}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {variant.product.base_unit}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                            <h3 className="text-lg font-semibold mb-3">
                                Inventory Movement History ({variant.inventory_movements.length})
                            </h3>
                            {variant.inventory_movements.length > 0 ? (
                                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                    {variant.inventory_movements.map((movement) => (
                                        <div
                                            key={movement.id}
                                            className="border border-sidebar-border/50 rounded-md p-3"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    {movement.type === 'IN' ? (
                                                        <TrendingUp className="h-4 w-4 text-green-600" />
                                                    ) : (
                                                        <TrendingDown className="h-4 w-4 text-red-600" />
                                                    )}
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                        movement.type === 'IN'
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                    }`}>
                                                        {movement.type}
                                                    </span>
                                                    <span className="font-medium">
                                                        {movement.quantity} {variant.product.base_unit}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {new Date(movement.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div className="text-sm space-y-1">
                                                <div>
                                                    <span className="font-medium">Reason:</span> {movement.reason}
                                                </div>
                                                <div>
                                                    <span className="font-medium">Unit Cost:</span> ₱{formatCurrency(movement.unit_cost)}
                                                </div>
                                                {movement.reference_id && (
                                                    <div>
                                                        <span className="font-medium">Reference ID:</span> {movement.reference_id}
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="font-medium">Recorded by:</span> {movement.recorded_by.name} ({movement.recorded_by.email})
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No inventory movements recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

