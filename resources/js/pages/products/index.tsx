import { Head, usePage } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import { Eye, Edit, Package, ToggleLeft, ToggleRight, Plus } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { toast } from '@/lib/toast';
import { ProductFormModal } from '@/components/product-form-modal';
import { ProductImage } from '@/components/product-image';

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

export default function ProductsIndex({ products, categories, filters }: ProductsIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [selectedCategory, setSelectedCategory] = useState(filters.category_id?.toString() || '');
    const [activeFilter, setActiveFilter] = useState(
        filters.is_active === undefined ? 'all' : filters.is_active ? 'active' : 'inactive'
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

    const triggerFetch = useCallback((params: any = {}) => {
        router.get('/products', {
            page: params.page || products?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            search: params.search !== undefined ? params.search : debouncedSearch,
            category_id: params.category_id !== undefined ? params.category_id : (selectedCategory || undefined),
            is_active: params.is_active !== undefined ? params.is_active : (activeFilter === 'all' ? undefined : activeFilter === 'active'),
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [debouncedSearch, selectedCategory, activeFilter, perPage, products?.current_page]);

    // Debounced search and filter effect - reset to page 1 when filters change
    useEffect(() => {
        triggerFetch({ search: debouncedSearch, category_id: selectedCategory || undefined, is_active: activeFilter === 'all' ? undefined : activeFilter === 'active', page: 1 });
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
        if (confirm(`Are you sure you want to ${product.track_stock ? 'disable' : 'enable'} stock tracking for this product?`)) {
            router.patch(`/products/${product.id}/toggle-stock`, {
                onSuccess: () => {
                    // Flash message will be shown automatically
                },
                onError: () => {
                    toast.error(`Failed to ${product.track_stock ? 'disable' : 'enable'} stock tracking.`);
                },
            });
        }
    };

    const handleToggleActive = (product: Product) => {
        if (confirm(`Are you sure you want to ${product.is_active ? 'deactivate' : 'activate'} this product?`)) {
            router.patch(`/products/${product.id}/toggle-active`, {
                onSuccess: () => {
                    // Flash message will be shown automatically
                },
                onError: () => {
                    toast.error(`Failed to ${product.is_active ? 'deactivate' : 'activate'} product.`);
                },
            });
        }
    };


    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Products" />
            <div className="flex flex-col overflow-hidden bg-background" style={{ height: 'calc(100vh - 80px)' }}>
                {/* Top Section - Controls (Fixed Height) */}
                <div className="flex-shrink-0 bg-card border-b border-border shadow-sm z-40 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-bold">Products</h1>
                        <Button onClick={handleCreate}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Product
                        </Button>
                    </div>

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

                    <select
                        value={activeFilter}
                        onChange={(e) => setActiveFilter(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>

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
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Category</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">SKU</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Unit</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Variants</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Stock Tracking</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/70">
                                {products.data.map((product) => (
                                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                            <div className="flex items-center gap-3">
                                                {/* Product Image */}
                                                <ProductImage
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="w-10 h-10 rounded-lg object-cover"
                                                />
                                                <div>
                                                    <div className="font-medium">{product.name}</div>
                                                    {product.brand && (
                                                        <div className="text-gray-500 dark:text-gray-400 text-xs">
                                                            {product.brand}
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
                                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                                product.track_stock
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                            }`}>
                                                {product.track_stock ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                                product.is_active
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                            }`}>
                                                {product.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title="View product details"
                                                    onClick={() => handleView(product)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title="Edit product"
                                                    onClick={() => handleEdit(product)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title={product.track_stock ? 'Disable stock tracking' : 'Enable stock tracking'}
                                                    onClick={() => handleToggleStock(product)}
                                                >
                                                    <Package className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title={product.is_active ? 'Deactivate' : 'Activate'}
                                                    onClick={() => handleToggleActive(product)}
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
                <div className="flex-shrink-0 bg-card border-t border-border shadow-sm z-30">
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
                                is_active: activeFilter === 'all' ? undefined : activeFilter === 'active',
                            }}
                        />
                    )}
                </div>
            </div>

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
