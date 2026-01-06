import { Head, usePage } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import { Eye, Edit, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { ProductCategoryFormModal } from '@/components/product-category-form-modal';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { toast } from '@/lib/toast';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Product Categories',
        href: '/product-categories',
    },
];

interface ProductCategory {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    products_count?: number;
}

interface ProductCategoriesIndexProps {
    categories: {
        data: ProductCategory[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        search?: string;
        per_page?: number;
    };
}

const STORAGE_KEY = 'product_categories_perPage';

export default function ProductCategoriesIndex({ categories, filters }: ProductCategoriesIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [perPage, setPerPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && PER_PAGE_OPTIONS.includes(saved as any)) {
                return saved;
            }
        }
        return String(filters?.per_page ?? 15);
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'view' | 'create' | 'edit'>('create');
    const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);

    const triggerFetch = useCallback((params: any = {}) => {
        router.get('/product-categories', {
            page: params.page || categories?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            search: params.search !== undefined ? params.search : debouncedSearch,
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [debouncedSearch, perPage, categories?.current_page]);

    // Debounced search effect - reset to page 1 when search changes
    useEffect(() => {
        triggerFetch({ search: debouncedSearch, page: 1 });
    }, [debouncedSearch]);

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
        setSelectedCategory(null);
        setModalMode('create');
        setIsModalOpen(true);
    };

    const handleView = (category: ProductCategory) => {
        setSelectedCategory(category);
        setModalMode('view');
        setIsModalOpen(true);
    };

    const handleEdit = (category: ProductCategory) => {
        setSelectedCategory(category);
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const handleToggle = (category: ProductCategory) => {
        if (confirm(`Are you sure you want to ${category.is_active ? 'deactivate' : 'activate'} this category?`)) {
            router.patch(`/product-categories/${category.id}/toggle`, {
                onSuccess: () => {
                    // Flash message will be shown automatically
                },
                onError: () => {
                    toast.error(`Failed to ${category.is_active ? 'deactivate' : 'activate'} category.`);
                },
            });
        }
    };

    const handleDelete = (category: ProductCategory) => {
        if (confirm(`Are you sure you want to delete "${category.name}"? This action cannot be undone.`)) {
            router.delete(`/product-categories/${category.id}`, {
                onSuccess: () => {
                    // Flash message will be shown automatically
                },
                onError: () => {
                    toast.error('Failed to delete category.');
                },
            });
        }
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedCategory(null);
    };

    const handleModalSuccess = () => {
        router.reload({ only: ['categories'] });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Product Categories" />
            <div className="flex flex-col overflow-hidden bg-background" style={{ height: 'calc(100vh - 80px)' }}>
                {/* Top Section - Controls (Fixed Height) */}
                <div className="flex-shrink-0 bg-card border-b border-border shadow-sm z-40 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-bold">Product Categories</h1>
                        <Button onClick={handleCreate}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Category
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            type="text"
                            placeholder="Search categories..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
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
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Description</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Products</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Created</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/70">
                                {categories.data.map((category) => (
                                    <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{category.name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                            {category.description || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                            {category.products_count || 0}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                            {category.is_active ? (
                                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                            {new Date(category.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title="View category"
                                                    onClick={() => handleView(category)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title="Edit category"
                                                    onClick={() => handleEdit(category)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title={category.is_active ? 'Deactivate' : 'Activate'}
                                                    onClick={() => handleToggle(category)}
                                                >
                                                    {category.is_active ? (
                                                        <ToggleRight className="h-4 w-4 text-green-600" />
                                                    ) : (
                                                        <ToggleLeft className="h-4 w-4 text-gray-400" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                                    title="Delete category"
                                                    onClick={() => handleDelete(category)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {categories.data.length === 0 && (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                No product categories found.
                            </div>
                        )}
                        </div>
                    </div>
                </div>

                {/* Pagination - Fixed at bottom of viewport */}
                <div className="flex-shrink-0 bg-card border-t border-border shadow-sm z-30">
                    {categories.data.length > 0 && (
                        <Pagination
                            currentPage={categories.current_page}
                            lastPage={categories.last_page}
                            total={categories.total}
                            perPage={categories.per_page}
                            onPageChange={handlePageChange}
                            filters={{ search: debouncedSearch }}
                        />
                    )}
                </div>
            </div>

            <ProductCategoryFormModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                category={selectedCategory}
                mode={modalMode}
                onSuccess={handleModalSuccess}
            />
        </AppLayout>
    );
}
