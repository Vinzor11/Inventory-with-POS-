import { FilterSheetButton } from '@/components/mobile/filter-sheet-button';
import {
    RecordActionsSheet,
    type RecordActionItem,
} from '@/components/mobile/record-actions-sheet';
import {
    MobileRecordCard,
    MobileRecordRow,
} from '@/components/mobile/record-card';
import { ProductFormModal } from '@/components/product-form-modal';
import { ProductImage } from '@/components/product-image';
import { Button } from '@/components/ui/button';
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
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { toast } from '@/lib/toast';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Edit,
    Eye,
    Package,
    Plus,
    ToggleLeft,
    ToggleRight,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: '/products',
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
    inventory: {
        quantity_on_hand: number;
    } | null;
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
    category: ProductCategory;
    variants: ProductVariant[];
    variants_count?: number;
}

interface ProductsIndexProps {
    products: {
        data: Product[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    categories: ProductCategory[];
    filters: {
        search?: string;
        category_id?: number;
        is_active?: boolean;
        per_page?: number;
    };
}

const STORAGE_KEY = 'products_perPage';

export default function ProductsIndex({
    products,
    categories,
    filters,
}: ProductsIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [selectedCategory, setSelectedCategory] = useState(
        filters.category_id?.toString() || '',
    );
    const [activeFilter, setActiveFilter] = useState(
        filters.is_active === undefined
            ? 'all'
            : filters.is_active
              ? 'active'
              : 'inactive',
    );
    const [perPage, setPerPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && PER_PAGE_OPTIONS.includes(saved as any)) {
                return saved;
            }
        }
        return String(filters?.per_page ?? 15);
    });
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const triggerFetch = useCallback(
        (params: any = {}) => {
            router.get(
                '/products',
                {
                    page: params.page || products?.current_page || 1,
                    per_page: params.per_page || parseInt(perPage, 10),
                    search:
                        params.search !== undefined
                            ? params.search
                            : debouncedSearch,
                    category_id:
                        params.category_id !== undefined
                            ? params.category_id
                            : selectedCategory || undefined,
                    is_active:
                        params.is_active !== undefined
                            ? params.is_active
                            : activeFilter === 'all'
                              ? undefined
                              : activeFilter === 'active',
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
            activeFilter,
            perPage,
            products?.current_page,
        ],
    );

    // Debounced search and filter effect - reset to page 1 when filters change
    useEffect(() => {
        triggerFetch({
            search: debouncedSearch,
            category_id: selectedCategory || undefined,
            is_active:
                activeFilter === 'all' ? undefined : activeFilter === 'active',
            page: 1,
        });
    }, [debouncedSearch, selectedCategory, activeFilter]);

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

    const handleCreate = () => {
        setEditingProduct(null);
        setModalMode('create');
        setIsFormModalOpen(true);
    };

    const handleView = (product: Product) => {
        router.visit(`/products/${product.id}`);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setModalMode('edit');
        setIsFormModalOpen(true);
    };

    const handleModalSuccess = () => {
        // Refresh the products list
        triggerFetch();
    };

    const handleToggleStock = (product: Product) => {
        if (
            confirm(
                `Are you sure you want to ${product.track_stock ? 'disable' : 'enable'} stock tracking for this product?`,
            )
        ) {
            router.patch(`/products/${product.id}/toggle-stock`, {
                onSuccess: () => {
                    // Flash message will be shown automatically
                },
                onError: () => {
                    toast.error(
                        `Failed to ${product.track_stock ? 'disable' : 'enable'} stock tracking.`,
                    );
                },
            });
        }
    };

    const handleToggleActive = (product: Product) => {
        if (
            confirm(
                `Are you sure you want to ${product.is_active ? 'deactivate' : 'activate'} this product?`,
            )
        ) {
            router.patch(`/products/${product.id}/toggle-active`, {
                onSuccess: () => {
                    // Flash message will be shown automatically
                },
                onError: () => {
                    toast.error(
                        `Failed to ${product.is_active ? 'deactivate' : 'activate'} product.`,
                    );
                },
            });
        }
    };

    const hasActiveFilters =
        Boolean(selectedCategory) || activeFilter !== 'all';

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
                title="Product Filters"
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
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>
            </FilterSheetButton>
        </>
    );

    return (
        <AppLayout
            breadcrumbs={breadcrumbs}
            mobileHeaderContent={mobileHeaderControls}
        >
            <Head title="Products" />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
                {/* Top Section - Controls (Fixed Height) */}
                <div className="z-40 hidden flex-shrink-0 border-b border-border bg-card px-3 py-2.5 shadow-sm md:block md:p-4">
                    <div className="hidden items-center justify-between md:mb-4 md:flex">
                        <h1 className="hidden text-2xl font-bold md:block">
                            Products
                        </h1>
                        <Button onClick={handleCreate}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Product
                        </Button>
                    </div>

                    <div className="hidden items-center gap-2 md:flex">
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none md:py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                        <div className="hidden items-center gap-2 md:flex">
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
                            <select
                                value={activeFilter}
                                onChange={(e) =>
                                    setActiveFilter(e.target.value)
                                }
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table Container - Dynamic Expansion */}
                <div className="min-h-0 flex-1 overflow-y-auto bg-background">
                    <div className="p-4">
                        <div className="space-y-3 md:hidden">
                            {products.data.length > 0 ? (
                                products.data.map((product) => {
                                    const actions: RecordActionItem[] = [
                                        {
                                            key: 'edit',
                                            label: 'Edit Product',
                                            icon: <Edit className="h-4 w-4" />,
                                            onClick: () => handleEdit(product),
                                        },
                                        {
                                            key: 'toggle-stock',
                                            label: product.track_stock
                                                ? 'Disable Stock Tracking'
                                                : 'Enable Stock Tracking',
                                            icon: (
                                                <Package className="h-4 w-4" />
                                            ),
                                            onClick: () =>
                                                handleToggleStock(product),
                                        },
                                        {
                                            key: 'toggle-active',
                                            label: product.is_active
                                                ? 'Deactivate Product'
                                                : 'Activate Product',
                                            icon: product.is_active ? (
                                                <ToggleRight className="h-4 w-4" />
                                            ) : (
                                                <ToggleLeft className="h-4 w-4" />
                                            ),
                                            onClick: () =>
                                                handleToggleActive(product),
                                        },
                                    ];

                                    return (
                                        <MobileRecordCard
                                            key={product.id}
                                            title={product.name}
                                            subtitle={
                                                product.brand ||
                                                product.category.name
                                            }
                                            value={`${product.variants.length}`}
                                            badges={[
                                                {
                                                    label: product.track_stock
                                                        ? 'Stock Tracking On'
                                                        : 'Stock Tracking Off',
                                                    className:
                                                        product.track_stock
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
                                                },
                                                {
                                                    label: product.is_active
                                                        ? 'Active'
                                                        : 'Inactive',
                                                    className: product.is_active
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                                                },
                                            ]}
                                            footer={
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        className="h-11 flex-1"
                                                        onClick={() =>
                                                            handleView(product)
                                                        }
                                                    >
                                                        View Details
                                                    </Button>
                                                    <RecordActionsSheet
                                                        title={product.name}
                                                        description="Product actions"
                                                        actions={actions}
                                                    />
                                                </div>
                                            }
                                        >
                                            <MobileRecordRow
                                                label="Category"
                                                value={product.category.name}
                                            />
                                            <MobileRecordRow
                                                label="SKU"
                                                value={product.sku || '-'}
                                            />
                                            <MobileRecordRow
                                                label="Unit"
                                                value={product.base_unit}
                                            />
                                        </MobileRecordCard>
                                    );
                                })
                            ) : (
                                <div className="rounded-xl border border-sidebar-border/70 bg-card p-8 text-center text-gray-500 dark:border-sidebar-border dark:text-gray-400">
                                    No products found.
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
                                                Category
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                SKU
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Unit
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Variants
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Stock Tracking
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Status
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
                                        {products.data.map((product) => (
                                            <tr
                                                key={product.id}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-800"
                                            >
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    <div className="flex items-center gap-3">
                                                        {/* Product Image */}
                                                        <ProductImage
                                                            src={product.image}
                                                            alt={product.name}
                                                            className="h-10 w-10 rounded-lg object-cover"
                                                        />
                                                        <div>
                                                            <div className="font-medium">
                                                                {product.name}
                                                            </div>
                                                            {product.brand && (
                                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                    {
                                                                        product.brand
                                                                    }
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {product.category.name}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {product.sku || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {product.base_unit}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {product.variants.length}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                                            product.track_stock
                                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                                        }`}
                                                    >
                                                        {product.track_stock
                                                            ? 'Enabled'
                                                            : 'Disabled'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                                            product.is_active
                                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                        }`}
                                                    >
                                                        {product.is_active
                                                            ? 'Active'
                                                            : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            title="View product details"
                                                            onClick={() =>
                                                                handleView(
                                                                    product,
                                                                )
                                                            }
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            title="Edit product"
                                                            onClick={() =>
                                                                handleEdit(
                                                                    product,
                                                                )
                                                            }
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            title={
                                                                product.track_stock
                                                                    ? 'Disable stock tracking'
                                                                    : 'Enable stock tracking'
                                                            }
                                                            onClick={() =>
                                                                handleToggleStock(
                                                                    product,
                                                                )
                                                            }
                                                        >
                                                            <Package className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            title={
                                                                product.is_active
                                                                    ? 'Deactivate'
                                                                    : 'Activate'
                                                            }
                                                            onClick={() =>
                                                                handleToggleActive(
                                                                    product,
                                                                )
                                                            }
                                                        >
                                                            {product.is_active ? (
                                                                <ToggleRight className="h-4 w-4 text-green-600" />
                                                            ) : (
                                                                <ToggleLeft className="h-4 w-4 text-gray-400" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {products.data.length === 0 && (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No products found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pagination - Fixed at bottom of viewport */}
                <div className="z-30 flex-shrink-0 border-t border-border bg-card shadow-sm">
                    {products.data.length > 0 && (
                        <Pagination
                            currentPage={products.current_page}
                            lastPage={products.last_page}
                            total={products.total}
                            perPage={products.per_page}
                            onPageChange={handlePageChange}
                            filters={{
                                search: debouncedSearch,
                                category_id: selectedCategory || undefined,
                                is_active:
                                    activeFilter === 'all'
                                        ? undefined
                                        : activeFilter === 'active',
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

            {!isFormModalOpen && (
                <button
                    type="button"
                    className="mobile-fab fixed right-4 bottom-20 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-xl hover:bg-green-700 active:bg-green-700 lg:hidden"
                    onClick={handleCreate}
                    aria-label="Create product"
                >
                    <Plus className="h-6 w-6" />
                </button>
            )}

            <ProductFormModal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                product={editingProduct}
                mode={modalMode}
                categories={categories}
                onSuccess={handleModalSuccess}
            />
        </AppLayout>
    );
}
