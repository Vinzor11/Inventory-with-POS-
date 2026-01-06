import { Head, usePage } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Eye, AlertTriangle, History, Plus, Edit, Package, TrendingUp, ChevronDown, ChevronUp, Scale } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { StockInModal } from '@/components/stock-in-modal';
import { AdjustmentModal } from '@/components/adjustment-modal';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatNumber } from '@/lib/format-currency';
import { toast } from '@/lib/toast';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Inventory',
        href: '/inventory',
    },
];

interface ProductVariant {
    id: number;
    product: {
        id: number;
        name: string;
        brand: string | null;
        sku: string | null;
    };
    description: string;
    unit_price: number;
    inventory: {
        quantity_on_hand: number;
    } | null;
    inventory_movements: Array<{
        id: number;
        quantity: number;
        type: 'IN' | 'OUT';
        reason: string;
        created_at: string;
    }>;
}

interface ProductCategory {
    id: number;
    name: string;
}

interface InventoryIndexProps {
    inventory: {
        data: ProductVariant[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    categories: ProductCategory[];
    filters: {
        search?: string;
        category_id?: number;
        low_stock?: boolean;
        per_page?: number;
    };
    dashboard: {
        totalVariants: number;
        totalStock: number;
        hardwareStock: number;
        agriculturalStock: number;
        inventoryValue: number;
        lowStockItems: Array<{
            id: number;
            description: string;
            unit_price: number;
            product: { name: string; category: { name: string } };
            inventory: { quantity_on_hand: number } | null;
        }>;
        lowStockThreshold: number;
    };
    products?: Array<{
        id: number;
        name: string;
        category: { id: number; name: string } | null;
        variants: Array<{
            id: number;
            description: string;
            unit_price: number;
        }>;
    }>;
    adjustmentReasons?: Record<string, string>;
}

const STORAGE_KEY = 'inventory_perPage';

export default function InventoryIndex({ inventory, categories, filters, dashboard, products: initialProducts = [], adjustmentReasons: initialAdjustmentReasons = {} }: InventoryIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [selectedCategory, setSelectedCategory] = useState(filters.category_id?.toString() || '');
    const [lowStockOnly, setLowStockOnly] = useState(filters.low_stock || false);
    const [isDashboardOpen, setIsDashboardOpen] = useState(true);
    const [perPage, setPerPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && PER_PAGE_OPTIONS.includes(saved as any)) {
                return saved;
            }
        }
        return String(filters?.per_page ?? 20);
    });
    const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [isSellModalOpen, setIsSellModalOpen] = useState(false);
    const [selectedVariantForStockIn, setSelectedVariantForStockIn] = useState<{ productId: number; variantId: number } | null>(null);
    const [selectedVariantForAdjustment, setSelectedVariantForAdjustment] = useState<{ productId: number; variantId: number } | null>(null);
    const [products, setProducts] = useState<any[]>(initialProducts);
    const [adjustmentReasons, setAdjustmentReasons] = useState<Record<string, string>>(initialAdjustmentReasons);
    const [agriculturalStock, setAgriculturalStock] = useState<{total_stock: number, variants: any[]} | null>(null);
    const [sellQuantity, setSellQuantity] = useState('');
    const [sellNotes, setSellNotes] = useState('');

    const triggerFetch = useCallback((params: any = {}) => {
        router.get('/inventory', {
            page: params.page || inventory?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            search: params.search !== undefined ? params.search : debouncedSearch,
            category_id: params.category_id !== undefined ? params.category_id : (selectedCategory || undefined),
            low_stock: params.low_stock !== undefined ? params.low_stock : (lowStockOnly ? 1 : undefined),
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [debouncedSearch, selectedCategory, lowStockOnly, perPage, inventory?.current_page]);

    // Debounced search and filter effect - reset to page 1 when filters change
    useEffect(() => {
        triggerFetch({ search: debouncedSearch, category_id: selectedCategory || undefined, low_stock: lowStockOnly ? 1 : undefined, page: 1 });
    }, [debouncedSearch, selectedCategory, lowStockOnly]);

    const handlePerPageChange = (value: number) => {
        const valueStr = String(value);
        setPerPage(valueStr);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, valueStr);
        }
        triggerFetch({ per_page: value, page: 1 });
    };

    const handlePageChange = (page: number) => {
        triggerFetch({ page });
    };

    const handleViewDetails = (variant: ProductVariant) => {
        router.visit(`/inventory/${variant.id}`);
    };

    const handleStockIn = (variant: ProductVariant) => {
        setSelectedVariantForStockIn({
            productId: variant.product.id,
            variantId: variant.id,
        });
        setIsStockInModalOpen(true);
    };

    const handleAdjustment = (variant: ProductVariant) => {
        setSelectedVariantForAdjustment({
            productId: variant.product.id,
            variantId: variant.id,
        });
        setIsAdjustmentModalOpen(true);
    };

    const handleModalSuccess = () => {
        // The redirect from the controller will refresh the page automatically
        // No need to manually trigger fetch as it causes duplicate flash messages
    };

    // Fetch agricultural stock summary
    const fetchAgriculturalStock = useCallback(async () => {
        try {
            const response = await fetch('/agricultural-sales/stock-summary');
            const data = await response.json();
            setAgriculturalStock(data);
        } catch (error) {
            console.error('Failed to fetch agricultural stock:', error);
            toast.error('Failed to load agricultural stock');
        }
    }, []);

    // Fetch stock when modal opens
    useEffect(() => {
        if (isSellModalOpen) {
            fetchAgriculturalStock();
        }
    }, [isSellModalOpen, fetchAgriculturalStock]);

    // Handle sell
    const handleSell = () => {
        if (!sellQuantity || parseFloat(sellQuantity) <= 0) {
            toast.error('Please enter a valid quantity');
            return;
        }

        if (agriculturalStock && parseFloat(sellQuantity) > agriculturalStock.total_stock) {
            toast.error(`Insufficient stock. Available: ${agriculturalStock.total_stock}`);
            return;
        }

        router.post('/agricultural-sales/checkout', {
            quantity: parseFloat(sellQuantity),
            notes: sellNotes,
        }, {
            onSuccess: () => {
                setIsSellModalOpen(false);
                setSellQuantity('');
                setSellNotes('');
                fetchAgriculturalStock();
                triggerFetch(); // Refresh inventory list
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                toast.error(errorMessage || 'Failed to process sale');
            },
        });
    };

    const getStockStatus = (quantity: number) => {
        if (quantity <= 0) {
            return { label: 'Out of Stock', color: 'red', icon: AlertTriangle };
        }
        if (quantity <= 5) {
            return { label: 'Low Stock', color: 'yellow', icon: AlertTriangle };
        }
        return { label: 'In Stock', color: 'green' };
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Inventory Management" />
            <div className="flex flex-col overflow-hidden bg-background" style={{ height: 'calc(100vh - 80px)' }}>
                {/* Top Section - Controls (Fixed Height) */}
                <div className="flex-shrink-0 bg-card border-b border-border shadow-sm z-40 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">Inventory Management</h1>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsSellModalOpen(true)}
                            >
                                <Scale className="h-4 w-4 mr-2" />
                                Sell Agricultural Products
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.visit('/inventory/movements')}
                            >
                                <History className="h-4 w-4 mr-2" />
                                History
                            </Button>
                        </div>
                    </div>

                    {/* Collapsible Dashboard */}
                    <Collapsible open={isDashboardOpen} onOpenChange={setIsDashboardOpen}>
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                className="w-full justify-between p-3 h-auto hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-semibold">Dashboard</h2>
                                </div>
                                {isDashboardOpen ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4">
                            {/* Dashboard summary */}
                            <div className="grid gap-4 md:grid-cols-4">
                                <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Variants</p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard.totalVariants}</p>
                                        </div>
                                        <Package className="h-10 w-10 text-gray-400" />
                                    </div>
                                </div>
                                <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Hardware Stock</p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {formatNumber(dashboard.hardwareStock)}
                                            </p>
                                        </div>
                                        <TrendingUp className="h-10 w-10 text-green-500" />
                                    </div>
                                </div>
                                <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Agricultural Stock</p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {formatNumber(dashboard.agriculturalStock)}
                                            </p>
                                        </div>
                                        <Scale className="h-10 w-10 text-orange-500" />
                                    </div>
                                </div>
                                <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Inventory Value</p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                ₱{formatCurrency(dashboard.inventoryValue)}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                                Hardware only
                                            </p>
                                        </div>
                                        <TrendingUp className="h-10 w-10 text-blue-500" />
                                    </div>
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-1">
                                <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Low Stock Items</p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {dashboard.lowStockItems.length}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                                Threshold: ≤ {dashboard.lowStockThreshold}
                                            </p>
                                        </div>
                                        <AlertTriangle className="h-10 w-10 text-yellow-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Low stock list */}
                            <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                                <div className="border-b border-sidebar-border/70 p-3 dark:border-sidebar-border">
                                    <h2 className="text-sm font-semibold">Low Stock Items</h2>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Items with quantity ≤ {dashboard.lowStockThreshold}</p>
                                </div>
                                {dashboard.lowStockItems.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">Product</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">Variant</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">Category</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">Stock</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-sidebar-border/70">
                                                {dashboard.lowStockItems.map((item) => (
                                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{item.product.name}</td>
                                                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{item.description}</td>
                                                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{item.product.category.name}</td>
                                                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                                                            {item.inventory?.quantity_on_hand ?? 0}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No low stock items.</div>
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>

                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        >
                            <option value="">All Categories</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={lowStockOnly}
                                onChange={(e) => setLowStockOnly(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            Low stock only
                        </label>

                        <RowsPerPageSelector
                            perPage={perPage}
                            onPerPageChange={(value) => handlePerPageChange(parseInt(value, 10))}
                            storageKey={STORAGE_KEY}
                        />
                    </div>
                </div>

                {/* Table Container - Dynamic Expansion */}
                <div className="flex-1 min-h-0 bg-background overflow-y-auto">
                    <div className="p-4">
                        <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                            <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Product</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Variant</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">SKU</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Stock</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Price</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/70">
                                {inventory.data.map((variant) => {
                                    const stockQuantity = variant.inventory?.quantity_on_hand ?? 0;
                                    const stockStatus = getStockStatus(stockQuantity);

                                    return (
                                        <tr key={variant.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                <div>
                                                    <div className="font-medium">{variant.product.name}</div>
                                                    {variant.product.brand && (
                                                        <div className="text-gray-500 dark:text-gray-400 text-xs">
                                                            {variant.product.brand}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                {variant.description}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                {variant.product.sku || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                                                {stockQuantity}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                <div className="flex items-center gap-2">
                                                    {stockStatus.icon && (
                                                        <stockStatus.icon className={`h-4 w-4 ${
                                                            stockStatus.color === 'red' ? 'text-red-500' :
                                                            stockStatus.color === 'yellow' ? 'text-yellow-500' :
                                                            'text-green-500'
                                                        }`} />
                                                    )}
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                        stockStatus.color === 'red'
                                                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                            : stockStatus.color === 'yellow'
                                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                    }`}>
                                                        {stockStatus.label}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                ₱{formatCurrency(variant.unit_price)}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        title="View inventory details"
                                                        onClick={() => handleViewDetails(variant)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        title="Stock-In"
                                                        onClick={() => handleStockIn(variant)}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        title="Adjustment"
                                                        onClick={() => handleAdjustment(variant)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>

                        {inventory.data.length === 0 && (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                No inventory items found.
                            </div>
                        )}
                        </div>
                    </div>
                </div>

                {/* Pagination - Fixed at bottom of viewport */}
                <div className="flex-shrink-0 bg-card border-t border-border shadow-sm z-30">
                    {inventory.data.length > 0 && (
                        <Pagination
                            currentPage={inventory.current_page}
                            lastPage={inventory.last_page}
                            total={inventory.total}
                            perPage={inventory.per_page}
                            onPageChange={handlePageChange}
                            filters={{
                                search: debouncedSearch,
                                category_id: selectedCategory || undefined,
                                low_stock: lowStockOnly ? 1 : undefined,
                            }}
                        />
                    )}
                </div>
            </div>

            <StockInModal
                isOpen={isStockInModalOpen}
                onClose={() => setIsStockInModalOpen(false)}
                products={products}
                preselectedProductId={selectedVariantForStockIn?.productId}
                preselectedVariantId={selectedVariantForStockIn?.variantId}
                onSuccess={handleModalSuccess}
            />

            <AdjustmentModal
                isOpen={isAdjustmentModalOpen}
                onClose={() => setIsAdjustmentModalOpen(false)}
                products={products}
                reasons={adjustmentReasons}
                preselectedProductId={selectedVariantForAdjustment?.productId}
                preselectedVariantId={selectedVariantForAdjustment?.variantId}
                onSuccess={handleModalSuccess}
            />

            <Dialog open={isSellModalOpen} onOpenChange={setIsSellModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sell Agricultural Products</DialogTitle>
                        <DialogDescription>
                            Sell combined agricultural products (Coconut, Cooked Copra, Uncooked Copra)
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        {agriculturalStock && (
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                                <div className="text-sm">
                                    <div className="font-semibold mb-2">Available Stock:</div>
                                    <div className="space-y-1">
                                        {agriculturalStock.variants.map((variant) => (
                                            <div key={variant.id} className="flex justify-between">
                                                <span>{variant.name}:</span>
                                                <span className="font-medium">{variant.stock} {variant.base_unit}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between font-bold">
                                            <span>Total Available:</span>
                                            <span>{agriculturalStock.total_stock}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <Label htmlFor="sell-quantity">Quantity to Sell *</Label>
                            <Input
                                id="sell-quantity"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={agriculturalStock?.total_stock}
                                value={sellQuantity}
                                onChange={(e) => setSellQuantity(e.target.value)}
                                placeholder="Enter quantity"
                            />
                        </div>

                        <div>
                            <Label htmlFor="sell-notes">Notes (Optional)</Label>
                            <Textarea
                                id="sell-notes"
                                value={sellNotes}
                                onChange={(e) => setSellNotes(e.target.value)}
                                placeholder="Additional notes..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsSellModalOpen(false);
                                setSellQuantity('');
                                setSellNotes('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSell}
                            disabled={!sellQuantity || parseFloat(sellQuantity) <= 0}
                        >
                            Sell
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
