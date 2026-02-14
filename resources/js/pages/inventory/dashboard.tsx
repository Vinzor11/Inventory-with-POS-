import { Head } from '@inertiajs/react';
import { Package, AlertTriangle, TrendingUp } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/format-currency';
import { MobileRecordCard, MobileRecordRow } from '@/components/mobile/record-card';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Inventory',
        href: '/inventory',
    },
    {
        title: 'Dashboard',
        href: '/inventory/dashboard',
    },
];

interface Product {
    id: number;
    name: string;
    category: {
        name: string;
    };
}

interface ProductVariant {
    id: number;
    description: string;
    unit_price: number;
    product: Product;
    inventory: {
        quantity_on_hand: number;
    } | null;
}

interface InventoryDashboardProps {
    totalVariants: number;
    totalStock: number;
    inventoryValue: number;
    lowStockItems: ProductVariant[];
    lowStockThreshold: number;
}

export default function InventoryDashboard({
    totalVariants,
    totalStock,
    inventoryValue,
    lowStockItems,
    lowStockThreshold,
}: InventoryDashboardProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Inventory Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="hidden text-2xl font-bold md:block">Inventory Dashboard</h1>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => router.visit('/inventory/stock-in')}
                        >
                            Stock-In
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.visit('/inventory/adjustment')}
                        >
                            Adjustment
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.visit('/inventory/movements')}
                        >
                            Movement History
                        </Button>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total Variants</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalVariants}</p>
                            </div>
                            <Package className="h-12 w-12 text-gray-400" />
                        </div>
                    </div>

                    <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total Stock</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {formatNumber(totalStock)}
                                </p>
                            </div>
                            <TrendingUp className="h-12 w-12 text-green-500" />
                        </div>
                    </div>

                    <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Inventory Value</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    ₱{formatCurrency(inventoryValue)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                    Excludes agricultural products
                                </p>
                            </div>
                            <TrendingUp className="h-12 w-12 text-blue-500" />
                        </div>
                    </div>

                    <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Low Stock Items</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {lowStockItems.length}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                    (Threshold: ≤ {lowStockThreshold})
                                </p>
                            </div>
                            <AlertTriangle className="h-12 w-12 text-yellow-500" />
                        </div>
                    </div>
                </div>

                {/* Low Stock List */}
                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <div className="border-b border-sidebar-border/70 p-4 dark:border-sidebar-border">
                        <h2 className="text-lg font-semibold">Low Stock Items</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Items with quantity ≤ {lowStockThreshold}
                        </p>
                    </div>
                    {lowStockItems.length > 0 ? (
                        <>
                            <div className="space-y-3 p-4 md:hidden">
                                {lowStockItems.map((variant) => {
                                    const stock = variant.inventory?.quantity_on_hand ?? 0;
                                    return (
                                        <MobileRecordCard
                                            key={variant.id}
                                            title={variant.product.name}
                                            subtitle={variant.description}
                                            value={String(stock)}
                                            badges={[
                                                {
                                                    label: stock === 0 ? 'Out of Stock' : 'Low Stock',
                                                    className:
                                                        stock === 0
                                                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                                                },
                                            ]}
                                            footer={
                                                <Button
                                                    type="button"
                                                    className="h-11 w-full"
                                                    onClick={() => router.visit(`/inventory/${variant.id}`)}
                                                >
                                                    View Details
                                                </Button>
                                            }
                                        >
                                            <MobileRecordRow label="Category" value={variant.product.category.name} />
                                            <MobileRecordRow label="Price" value={`₱${formatCurrency(variant.unit_price)}`} />
                                        </MobileRecordCard>
                                    );
                                })}
                            </div>

                            <div className="hidden overflow-x-auto md:block">
                            <table className="w-full">
                                <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                            Product
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                            Variant
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                            Category
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                            Stock
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                            Price
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/70">
                                    {lowStockItems.map((variant) => {
                                        const stock = variant.inventory?.quantity_on_hand ?? 0;
                                        return (
                                            <tr key={variant.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {variant.product.name}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {variant.description}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {variant.product.category.name}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                        stock === 0
                                                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                    }`}>
                                                        {stock}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    ₱{formatCurrency(variant.unit_price)}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => router.visit(`/inventory/${variant.id}`)}
                                                    >
                                                        View Details
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </>
                    ) : (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No low stock items found.</p>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

