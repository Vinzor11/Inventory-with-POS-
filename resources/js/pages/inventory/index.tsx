import { AdjustmentModal } from '@/components/adjustment-modal';
import { FilterSheetButton } from '@/components/mobile/filter-sheet-button';
import {
    RecordActionsSheet,
    type RecordActionItem,
} from '@/components/mobile/record-actions-sheet';
import {
    MobileRecordCard,
    MobileRecordRow,
} from '@/components/mobile/record-card';
import { StockInModal } from '@/components/stock-in-modal';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import {
    PER_PAGE_OPTIONS,
    RowsPerPageSelector,
} from '@/components/ui/rows-per-page-selector';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { formatCurrency, formatNumber } from '@/lib/format-currency';
import { toast } from '@/lib/toast';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Edit,
    Eye,
    History,
    Package,
    Plus,
    Scale,
    TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

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

interface CookedCopraStockSummary {
    total_stock: number;
    unit: string;
    average_cost: number;
    variant: {
        variant_id: number;
        product_id: number;
        name: string;
        description: string;
        unit: string;
        stock: number;
        unit_price: number;
        average_cost: number;
    } | null;
    variants: Array<{
        id: number;
        name: string;
        description: string;
        unit_price: number;
        base_unit: string;
        stock: number;
        average_cost: number;
    }>;
}

const STORAGE_KEY = 'inventory_perPage';
const STORAGE_KEY_DASHBOARD = 'inventory_dashboardOpen';
const STORAGE_KEY_LOW_STOCK = 'inventory_lowStockOnly';

// Helper to safely get localStorage value (works during SSR)
const getStoredValue = (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

// Helper to safely set localStorage value
const setStoredValue = (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, value);
    } catch {
        // Ignore localStorage errors
    }
};

export default function InventoryIndex({
    inventory,
    categories,
    filters,
    dashboard,
    products: initialProducts = [],
    adjustmentReasons: initialAdjustmentReasons = {},
}: InventoryIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [selectedCategory, setSelectedCategory] = useState(
        filters.category_id?.toString() || '',
    );

    // Initialize from localStorage synchronously
    const [lowStockOnly, setLowStockOnly] = useState(() => {
        const saved = getStoredValue(STORAGE_KEY_LOW_STOCK);
        return saved !== null ? saved === 'true' : filters.low_stock || false;
    });

    const [isDashboardOpen, setIsDashboardOpen] = useState(() => {
        const saved = getStoredValue(STORAGE_KEY_DASHBOARD);
        return saved !== null ? saved === 'true' : true;
    });

    const [perPage, setPerPage] = useState(() => {
        const saved = getStoredValue(STORAGE_KEY);
        return saved && PER_PAGE_OPTIONS.includes(saved as any)
            ? saved
            : String(filters?.per_page ?? 20);
    });

    const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [isSellModalOpen, setIsSellModalOpen] = useState(false);
    const [selectedVariantForStockIn, setSelectedVariantForStockIn] = useState<{
        productId: number;
        variantId: number;
    } | null>(null);
    const [selectedVariantForAdjustment, setSelectedVariantForAdjustment] =
        useState<{ productId: number; variantId: number } | null>(null);
    const [products, setProducts] = useState<any[]>(initialProducts);
    const [adjustmentReasons, setAdjustmentReasons] = useState<
        Record<string, string>
    >(initialAdjustmentReasons);
    const [agriculturalStock, setAgriculturalStock] =
        useState<CookedCopraStockSummary | null>(null);
    const [sellQuantity, setSellQuantity] = useState('');
    const [sellUnitPrice, setSellUnitPrice] = useState('');
    const [sellDate, setSellDate] = useState(() =>
        new Date().toISOString().slice(0, 10),
    );
    const [sellCustomerName, setSellCustomerName] = useState('');
    const [sellNotes, setSellNotes] = useState('');

    const resetSellForm = () => {
        setSellQuantity('');
        setSellUnitPrice('');
        setSellDate(new Date().toISOString().slice(0, 10));
        setSellCustomerName('');
        setSellNotes('');
    };

    // Track previous values to detect actual user changes (not initial mount)
    const prevSearch = useRef(debouncedSearch);
    const prevCategory = useRef(selectedCategory);
    const prevLowStock = useRef(lowStockOnly);

    const triggerFetch = useCallback(
        (params: any = {}) => {
            router.get(
                '/inventory',
                {
                    page: params.page || inventory?.current_page || 1,
                    per_page: params.per_page || parseInt(perPage, 10),
                    search:
                        params.search !== undefined
                            ? params.search
                            : debouncedSearch,
                    category_id:
                        params.category_id !== undefined
                            ? params.category_id
                            : selectedCategory || undefined,
                    low_stock:
                        params.low_stock !== undefined
                            ? params.low_stock
                            : lowStockOnly
                              ? 1
                              : undefined,
                    ...params,
                },
                {
                    preserveState: true,
                    preserveScroll: false,
                    replace: true,
                },
            );
        },
        [
            debouncedSearch,
            selectedCategory,
            lowStockOnly,
            perPage,
            inventory?.current_page,
        ],
    );

    // Save dashboard state to localStorage when it changes
    useEffect(() => {
        setStoredValue(STORAGE_KEY_DASHBOARD, String(isDashboardOpen));
    }, [isDashboardOpen]);

    // Save low stock filter state to localStorage when it changes
    useEffect(() => {
        setStoredValue(STORAGE_KEY_LOW_STOCK, String(lowStockOnly));
    }, [lowStockOnly]);

    // Debounced search and filter effect - only fetch when values ACTUALLY change from user interaction
    useEffect(() => {
        const searchChanged = prevSearch.current !== debouncedSearch;
        const categoryChanged = prevCategory.current !== selectedCategory;
        const lowStockChanged = prevLowStock.current !== lowStockOnly;

        // Update refs
        prevSearch.current = debouncedSearch;
        prevCategory.current = selectedCategory;
        prevLowStock.current = lowStockOnly;

        // Only fetch if something actually changed (not on initial mount)
        if (searchChanged || categoryChanged || lowStockChanged) {
            triggerFetch({
                search: debouncedSearch,
                category_id: selectedCategory || undefined,
                low_stock: lowStockOnly ? 1 : undefined,
                page: 1,
            });
        }
    }, [debouncedSearch, selectedCategory, lowStockOnly, triggerFetch]);

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
            if (data?.variant?.unit_price) {
                setSellUnitPrice((current) =>
                    current ? current : String(data.variant.unit_price),
                );
            }
        } catch (error) {
            console.error('Failed to fetch agricultural stock:', error);
            toast.error('Failed to load cooked copra stock');
        }
    }, []);

    // Fetch stock when modal opens
    useEffect(() => {
        if (isSellModalOpen) {
            setSellDate(new Date().toISOString().slice(0, 10));
            fetchAgriculturalStock();
        }
    }, [isSellModalOpen, fetchAgriculturalStock]);

    // Handle sell
    const handleSell = () => {
        if (!sellQuantity || parseFloat(sellQuantity) <= 0) {
            toast.error('Please enter a valid quantity');
            return;
        }

        if (!sellUnitPrice || parseFloat(sellUnitPrice) <= 0) {
            toast.error('Please enter a valid selling price');
            return;
        }

        if (
            agriculturalStock &&
            parseFloat(sellQuantity) > agriculturalStock.total_stock
        ) {
            toast.error(
                `Insufficient stock. Available: ${agriculturalStock.total_stock}`,
            );
            return;
        }

        router.post(
            '/agricultural-sales/checkout',
            {
                quantity: parseFloat(sellQuantity),
                unit_price: parseFloat(sellUnitPrice),
                sale_date: sellDate,
                customer_name: sellCustomerName || undefined,
                notes: sellNotes,
            },
            {
                onSuccess: () => {
                    setIsSellModalOpen(false);
                    resetSellForm();
                    fetchAgriculturalStock();
                    triggerFetch(); // Refresh inventory list
                },
                onError: (errors) => {
                    const firstError = Object.values(errors)[0];
                    const errorMessage = Array.isArray(firstError)
                        ? firstError[0]
                        : firstError;
                    toast.error(errorMessage || 'Failed to process sale');
                },
            },
        );
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

    const parsedSellQuantity = parseFloat(sellQuantity) || 0;
    const parsedSellUnitPrice = parseFloat(sellUnitPrice) || 0;
    const estimatedAverageCost = Number(
        agriculturalStock?.average_cost ??
            agriculturalStock?.variant?.average_cost ??
            0,
    );
    const estimatedRevenue = parsedSellQuantity * parsedSellUnitPrice;
    const estimatedCogs = parsedSellQuantity * estimatedAverageCost;
    const estimatedGrossProfit = estimatedRevenue - estimatedCogs;

    const hasActiveFilters = Boolean(selectedCategory) || lowStockOnly;

    const mobileHeaderControls = (
        <>
            <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="app-search-surface h-10 min-w-0 flex-1 px-3 text-sm"
            />
            <FilterSheetButton
                title="Inventory Filters"
                isActive={hasActiveFilters}
            >
                <Select
                    value={selectedCategory || 'all'}
                    onValueChange={(value) =>
                        setSelectedCategory(value === 'all' ? '' : value)
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                            <SelectItem
                                key={category.id}
                                value={String(category.id)}
                            >
                                {category.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={lowStockOnly}
                        onChange={(e) => setLowStockOnly(e.target.checked)}
                        className="rounded border-gray-300"
                    />
                    Low stock only
                </label>
            </FilterSheetButton>
        </>
    );

    return (
        <AppLayout
            breadcrumbs={breadcrumbs}
            mobileHeaderContent={mobileHeaderControls}
        >
            <Head title="Inventory Management" />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
                {/* Top Section - Controls (Fixed Height) */}
                <div className="z-40 flex-shrink-0 border-b border-border bg-card px-3 py-2.5 shadow-sm md:space-y-4 md:p-4">
                    <div className="flex items-center justify-between">
                        <h1 className="hidden text-2xl font-bold md:block">
                            Inventory Management
                        </h1>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    router.visit(
                                        '/inventory/production/coconut-to-uncooked',
                                    )
                                }
                            >
                                Production: Coconut
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    router.visit(
                                        '/inventory/production/uncooked-to-cooked',
                                    )
                                }
                            >
                                Production: Cooked
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    router.visit(
                                        '/inventory/production/coconut-to-cooked',
                                    )
                                }
                            >
                                Production: Direct
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsSellModalOpen(true)}
                            >
                                <Scale className="mr-2 h-4 w-4" />
                                Sell Cooked Copra
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    router.visit('/inventory/movements')
                                }
                            >
                                <History className="mr-2 h-4 w-4" />
                                History
                            </Button>
                        </div>
                    </div>

                    {/* Collapsible Dashboard */}
                    <Collapsible
                        open={isDashboardOpen}
                        onOpenChange={setIsDashboardOpen}
                    >
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                className="h-auto w-full justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-semibold">
                                        Dashboard
                                    </h2>
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
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Total Variants
                                            </p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {dashboard.totalVariants}
                                            </p>
                                        </div>
                                        <Package className="h-10 w-10 text-gray-400" />
                                    </div>
                                </div>
                                <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Hardware Stock
                                            </p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {formatNumber(
                                                    dashboard.hardwareStock,
                                                )}
                                            </p>
                                        </div>
                                        <TrendingUp className="h-10 w-10 text-green-500" />
                                    </div>
                                </div>
                                <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Agricultural Stock
                                            </p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {formatNumber(
                                                    dashboard.agriculturalStock,
                                                )}
                                            </p>
                                        </div>
                                        <Scale className="h-10 w-10 text-orange-500" />
                                    </div>
                                </div>
                                <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Inventory Value
                                            </p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                â‚±
                                                {formatCurrency(
                                                    dashboard.inventoryValue,
                                                )}
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
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Low Stock Items
                                            </p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {dashboard.lowStockItems.length}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                                Threshold: â‰¤{' '}
                                                {dashboard.lowStockThreshold}
                                            </p>
                                        </div>
                                        <AlertTriangle className="h-10 w-10 text-yellow-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Low stock list */}
                            <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                                <div className="border-b border-sidebar-border/70 p-3 dark:border-sidebar-border">
                                    <h2 className="text-sm font-semibold">
                                        Low Stock Items
                                    </h2>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        Items with quantity â‰¤{' '}
                                        {dashboard.lowStockThreshold}
                                    </p>
                                </div>
                                {dashboard.lowStockItems.length > 0 ? (
                                    <>
                                        <div className="space-y-2 p-3 md:hidden">
                                            {dashboard.lowStockItems.map(
                                                (item) => (
                                                    <MobileRecordCard
                                                        key={`low-${item.id}`}
                                                        title={
                                                            item.product.name
                                                        }
                                                        subtitle={
                                                            item.description
                                                        }
                                                        value={String(
                                                            item.inventory
                                                                ?.quantity_on_hand ??
                                                                0,
                                                        )}
                                                        badges={[
                                                            {
                                                                label: 'Low Stock',
                                                                className:
                                                                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                                                            },
                                                        ]}
                                                    >
                                                        <MobileRecordRow
                                                            label="Category"
                                                            value={
                                                                item.product
                                                                    .category
                                                                    .name
                                                            }
                                                        />
                                                    </MobileRecordCard>
                                                ),
                                            )}
                                        </div>

                                        <div className="hidden overflow-x-auto md:block">
                                            <table className="w-full">
                                                <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">
                                                            Product
                                                        </th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">
                                                            Variant
                                                        </th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">
                                                            Category
                                                        </th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">
                                                            Stock
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-sidebar-border/70">
                                                    {dashboard.lowStockItems.map(
                                                        (item) => (
                                                            <tr
                                                                key={item.id}
                                                                className="hover:bg-gray-50 dark:hover:bg-gray-800"
                                                            >
                                                                <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                                                                    {
                                                                        item
                                                                            .product
                                                                            .name
                                                                    }
                                                                </td>
                                                                <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                                                                    {
                                                                        item.description
                                                                    }
                                                                </td>
                                                                <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                                                                    {
                                                                        item
                                                                            .product
                                                                            .category
                                                                            .name
                                                                    }
                                                                </td>
                                                                <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                                                                    {item
                                                                        .inventory
                                                                        ?.quantity_on_hand ??
                                                                        0}
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                        No low stock items.
                                    </div>
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>

                    <div className="hidden items-center gap-2 md:flex">
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedCategory}
                                onChange={(e) =>
                                    setSelectedCategory(e.target.value)
                                }
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            >
                                <option value="">All Categories</option>
                                {categories.map((category) => (
                                    <option
                                        key={category.id}
                                        value={category.id}
                                    >
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={lowStockOnly}
                                    onChange={(e) =>
                                        setLowStockOnly(e.target.checked)
                                    }
                                    className="rounded border-gray-300"
                                />
                                Low stock only
                            </label>
                        </div>
                    </div>
                </div>

                {/* Table Container - Dynamic Expansion */}
                <div className="min-h-0 flex-1 overflow-y-auto bg-background">
                    <div className="p-4">
                        <div className="space-y-3 md:hidden">
                            {inventory.data.length > 0 ? (
                                inventory.data.map((variant) => {
                                    const stockQuantity =
                                        variant.inventory?.quantity_on_hand ??
                                        0;
                                    const stockStatus =
                                        getStockStatus(stockQuantity);
                                    const stockStatusClass =
                                        stockStatus.color === 'red'
                                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                            : stockStatus.color === 'yellow'
                                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';

                                    const actions: RecordActionItem[] = [
                                        {
                                            key: 'stock-in',
                                            label: 'Stock-In',
                                            icon: <Plus className="h-4 w-4" />,
                                            onClick: () =>
                                                handleStockIn(variant),
                                        },
                                        {
                                            key: 'adjustment',
                                            label: 'Adjustment',
                                            icon: <Edit className="h-4 w-4" />,
                                            onClick: () =>
                                                handleAdjustment(variant),
                                        },
                                    ];

                                    return (
                                        <MobileRecordCard
                                            key={variant.id}
                                            title={variant.product.name}
                                            subtitle={variant.description}
                                            value={stockQuantity}
                                            badges={[
                                                {
                                                    label: stockStatus.label,
                                                    className: stockStatusClass,
                                                },
                                            ]}
                                            footer={
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        className="h-11 flex-1"
                                                        onClick={() =>
                                                            handleViewDetails(
                                                                variant,
                                                            )
                                                        }
                                                    >
                                                        View Details
                                                    </Button>
                                                    <RecordActionsSheet
                                                        title={
                                                            variant.product.name
                                                        }
                                                        description="Inventory actions"
                                                        actions={actions}
                                                    />
                                                </div>
                                            }
                                        >
                                            <MobileRecordRow
                                                label="SKU"
                                                value={
                                                    variant.product.sku || '-'
                                                }
                                            />
                                            <MobileRecordRow
                                                label="Price"
                                                value={`â‚±${formatCurrency(variant.unit_price)}`}
                                            />
                                        </MobileRecordCard>
                                    );
                                })
                            ) : (
                                <div className="rounded-xl border border-sidebar-border/70 bg-card p-8 text-center text-gray-500 dark:border-sidebar-border dark:text-gray-400">
                                    No inventory items found.
                                </div>
                            )}
                        </div>

                        <div className="hidden rounded-xl border border-sidebar-border/70 md:block dark:border-sidebar-border">
                            <div className="overflow-x-auto">
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
                                                SKU
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Stock
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Status
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
                                        {inventory.data.map((variant) => {
                                            const stockQuantity =
                                                variant.inventory
                                                    ?.quantity_on_hand ?? 0;
                                            const stockStatus =
                                                getStockStatus(stockQuantity);

                                            return (
                                                <tr
                                                    key={variant.id}
                                                    className="hover:bg-gray-50 dark:hover:bg-gray-800"
                                                >
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        <div>
                                                            <div className="font-medium">
                                                                {
                                                                    variant
                                                                        .product
                                                                        .name
                                                                }
                                                            </div>
                                                            {variant.product
                                                                .brand && (
                                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                    {
                                                                        variant
                                                                            .product
                                                                            .brand
                                                                    }
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        {variant.description}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        {variant.product.sku ||
                                                            '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                                        {stockQuantity}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        <div className="flex items-center gap-2">
                                                            {stockStatus.icon && (
                                                                <stockStatus.icon
                                                                    className={`h-4 w-4 ${
                                                                        stockStatus.color ===
                                                                        'red'
                                                                            ? 'text-red-500'
                                                                            : stockStatus.color ===
                                                                                'yellow'
                                                                              ? 'text-yellow-500'
                                                                              : 'text-green-500'
                                                                    }`}
                                                                />
                                                            )}
                                                            <span
                                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                                    stockStatus.color ===
                                                                    'red'
                                                                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                                        : stockStatus.color ===
                                                                            'yellow'
                                                                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                                }`}
                                                            >
                                                                {
                                                                    stockStatus.label
                                                                }
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                        â‚±
                                                        {formatCurrency(
                                                            variant.unit_price,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0"
                                                                title="View inventory details"
                                                                onClick={() =>
                                                                    handleViewDetails(
                                                                        variant,
                                                                    )
                                                                }
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0"
                                                                title="Stock-In"
                                                                onClick={() =>
                                                                    handleStockIn(
                                                                        variant,
                                                                    )
                                                                }
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0"
                                                                title="Adjustment"
                                                                onClick={() =>
                                                                    handleAdjustment(
                                                                        variant,
                                                                    )
                                                                }
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
                <div className="z-30 flex-shrink-0 border-t border-border bg-card shadow-sm">
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
                            pageSizeSelector={
                                <RowsPerPageSelector
                                    perPage={perPage}
                                    onPerPageChange={(value) =>
                                        handlePerPageChange(parseInt(value, 10))
                                    }
                                    storageKey={STORAGE_KEY}
                                />
                            }
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

            <Dialog
                open={isSellModalOpen}
                onOpenChange={(open) => {
                    setIsSellModalOpen(open);
                    if (!open) {
                        resetSellForm();
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sell Cooked Copra</DialogTitle>
                        <DialogDescription>
                            Record stock-out sale for cooked copra (kg) with
                            movement and costing snapshot.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {agriculturalStock && (
                            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
                                <div className="text-sm">
                                    <div className="mb-2 font-semibold">
                                        Available Stock:
                                    </div>
                                    <div className="space-y-1">
                                        {agriculturalStock.variants.map(
                                            (variant) => (
                                                <div
                                                    key={variant.id}
                                                    className="flex justify-between"
                                                >
                                                    <span>{variant.name}:</span>
                                                    <span className="font-medium">
                                                        {variant.stock}{' '}
                                                        {variant.base_unit}
                                                    </span>
                                                </div>
                                            ),
                                        )}
                                        <div className="flex justify-between">
                                            <span>Average Cost:</span>
                                            <span className="font-medium">
                                                ₱
                                                {formatCurrency(
                                                    agriculturalStock.average_cost ||
                                                        0,
                                                )}
                                                /kg
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                                        <div className="flex justify-between font-bold">
                                            <span>Total Available:</span>
                                            <span>
                                                {agriculturalStock.total_stock}{' '}
                                                {agriculturalStock.unit || 'kg'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <Label htmlFor="sell-quantity">
                                Quantity to Sell (kg) *
                            </Label>
                            <Input
                                id="sell-quantity"
                                type="number"
                                step="0.0001"
                                min="0.0001"
                                max={agriculturalStock?.total_stock}
                                value={sellQuantity}
                                onChange={(e) =>
                                    setSellQuantity(e.target.value)
                                }
                                placeholder="Enter cooked copra kg"
                            />
                        </div>

                        <div>
                            <Label htmlFor="sell-unit-price">
                                Selling Price per kg *
                            </Label>
                            <Input
                                id="sell-unit-price"
                                type="number"
                                step="0.0001"
                                min="0.0001"
                                value={sellUnitPrice}
                                onChange={(e) =>
                                    setSellUnitPrice(e.target.value)
                                }
                                placeholder="Enter selling price"
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <Label htmlFor="sell-date">Sale Date</Label>
                                <Input
                                    id="sell-date"
                                    type="date"
                                    value={sellDate}
                                    onChange={(e) =>
                                        setSellDate(e.target.value)
                                    }
                                />
                            </div>
                            <div>
                                <Label htmlFor="sell-customer">
                                    Customer Name (Optional)
                                </Label>
                                <Input
                                    id="sell-customer"
                                    value={sellCustomerName}
                                    onChange={(e) =>
                                        setSellCustomerName(e.target.value)
                                    }
                                    placeholder="Walk-in or customer name"
                                />
                            </div>
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

                        <div className="rounded-lg border bg-slate-50 p-3 text-sm dark:bg-slate-800">
                            <div className="flex justify-between">
                                <span>Estimated Revenue</span>
                                <span className="font-medium">
                                    ₱{formatCurrency(estimatedRevenue)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Estimated COGS</span>
                                <span className="font-medium">
                                    ₱{formatCurrency(estimatedCogs)}
                                </span>
                            </div>
                            <div className="flex justify-between border-t pt-2 font-semibold">
                                <span>Estimated Gross Profit</span>
                                <span>
                                    ₱{formatCurrency(estimatedGrossProfit)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsSellModalOpen(false);
                                resetSellForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSell}
                            disabled={
                                !sellQuantity ||
                                parseFloat(sellQuantity) <= 0 ||
                                !sellUnitPrice ||
                                parseFloat(sellUnitPrice) <= 0
                            }
                        >
                            Save Sale
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
