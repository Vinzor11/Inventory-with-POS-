import { FilterSheetButton } from '@/components/mobile/filter-sheet-button';
import {
    MobileRecordCard,
    MobileRecordRow,
} from '@/components/mobile/record-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { formatCurrency } from '@/lib/format-currency';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Inventory',
        href: '/inventory',
    },
    {
        title: 'Movement History',
        href: '/inventory/movements',
    },
];

interface ProductCategory {
    id: number;
    name: string;
}

interface Product {
    id: number;
    name: string;
    category: ProductCategory;
}

interface ProductVariant {
    id: number;
    description: string;
    product: Product;
}

interface User {
    id: number;
    name: string;
    email: string;
}

interface InventoryMovement {
    id: number;
    quantity: number;
    qty?: number;
    type: 'IN' | 'OUT';
    reason: string;
    movement_type?: string | null;
    unit?: string | null;
    unit_cost: number | null;
    total_cost?: number | null;
    reference_type?: string | null;
    notes: string | null;
    created_at: string;
    product_variant: ProductVariant;
    recorded_by: User;
}

interface MovementHistoryProps {
    movements: {
        data: InventoryMovement[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    reasons: string[];
    movementTypes: string[];
    referenceTypes: string[];
    products: Array<{
        id: number;
        name: string;
    }>;
    filters: {
        search?: string;
        product_id?: number;
        date_from?: string;
        date_to?: string;
        reason?: string;
        movement_type?: string;
        reference_type?: string;
        type?: 'IN' | 'OUT';
        per_page?: number;
    };
}

const STORAGE_KEY = 'inventory_movements_perPage';

export default function MovementHistory({
    movements,
    reasons,
    movementTypes,
    referenceTypes,
    products,
    filters,
}: MovementHistoryProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [selectedProduct, setSelectedProduct] = useState(
        filters.product_id?.toString() || '',
    );
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters?.date_to ?? '');
    const [selectedReason, setSelectedReason] = useState(filters.reason || '');
    const [selectedMovementType, setSelectedMovementType] = useState(filters.movement_type || '');
    const [selectedReferenceType, setSelectedReferenceType] = useState(filters.reference_type || '');
    const [selectedType, setSelectedType] = useState(filters.type || '');
    const [perPage, setPerPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && PER_PAGE_OPTIONS.includes(saved as any)) {
                return saved;
            }
        }
        return String(filters?.per_page ?? 20);
    });

    const triggerFetch = useCallback(
        (params: any = {}) => {
            router.get(
                '/inventory/movements',
                {
                    page: params.page || movements?.current_page || 1,
                    per_page: params.per_page || parseInt(perPage, 10),
                    search:
                        params.search !== undefined
                            ? params.search
                            : debouncedSearch,
                    product_id:
                        params.product_id !== undefined
                            ? params.product_id
                            : selectedProduct || undefined,
                    date_from:
                        params.date_from !== undefined
                            ? params.date_from
                            : dateFrom
                              ? dateFrom
                              : undefined,
                    date_to:
                        params.date_to !== undefined
                            ? params.date_to
                            : dateTo
                              ? dateTo
                              : undefined,
                    reason:
                        params.reason !== undefined
                            ? params.reason
                            : selectedReason || undefined,
                    movement_type:
                        params.movement_type !== undefined
                            ? params.movement_type
                            : selectedMovementType || undefined,
                    reference_type:
                        params.reference_type !== undefined
                            ? params.reference_type
                            : selectedReferenceType || undefined,
                    type:
                        params.type !== undefined
                            ? params.type
                            : selectedType || undefined,
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
            selectedProduct,
            dateFrom,
            dateTo,
            selectedReason,
            selectedMovementType,
            selectedReferenceType,
            selectedType,
            perPage,
            movements?.current_page,
        ],
    );

    useEffect(() => {
        triggerFetch({ page: 1 });
    }, [
        debouncedSearch,
        selectedProduct,
        dateFrom,
        dateTo,
        selectedReason,
        selectedMovementType,
        selectedReferenceType,
        selectedType,
    ]);

    const handlePerPageChange = (value: string) => {
        const valueInt = parseInt(value, 10);
        setPerPage(value);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, value);
        }
        triggerFetch({ per_page: valueInt, page: 1 });
    };

    const handlePageChange = (page: number) => {
        triggerFetch({ page });
    };

    const handleClearFilters = () => {
        setSearch('');
        setSelectedProduct('');
        setDateFrom('');
        setDateTo('');
        setSelectedReason('');
        setSelectedMovementType('');
        setSelectedReferenceType('');
        setSelectedType('');
        triggerFetch({
            search: '',
            product_id: undefined,
            date_from: undefined,
            date_to: undefined,
            reason: undefined,
            movement_type: undefined,
            reference_type: undefined,
            type: undefined,
            page: 1,
        });
    };

    const hasActiveFilters =
        Boolean(selectedProduct) ||
        Boolean(dateFrom) ||
        Boolean(dateTo) ||
        Boolean(selectedReason) ||
        Boolean(selectedMovementType) ||
        Boolean(selectedReferenceType) ||
        Boolean(selectedType);

    const resolveSignedQuantity = (movement: InventoryMovement) => {
        if (movement.qty !== undefined && movement.qty !== null) {
            return Number(movement.qty);
        }

        return movement.type === 'OUT'
            ? -Math.abs(Number(movement.quantity))
            : Math.abs(Number(movement.quantity));
    };

    const formatSignedQuantity = (movement: InventoryMovement) => {
        return resolveSignedQuantity(movement).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        });
    };

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
                title="Movement Filters"
                isActive={hasActiveFilters}
            >
                <Select
                    value={selectedProduct || 'all'}
                    onValueChange={(value) =>
                        setSelectedProduct(value === 'all' ? '' : value)
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Products" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Products</SelectItem>
                        {products.map((product) => (
                            <SelectItem
                                key={product.id}
                                value={String(product.id)}
                            >
                                {product.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                        const value = e.target.value;
                        setDateFrom(value);
                        triggerFetch({
                            date_from: value || undefined,
                            page: 1,
                        });
                    }}
                    placeholder="From Date"
                />
                <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                        const value = e.target.value;
                        setDateTo(value);
                        triggerFetch({ date_to: value || undefined, page: 1 });
                    }}
                    placeholder="To Date"
                />
                <Select
                    value={selectedReason || 'all'}
                    onValueChange={(value) =>
                        setSelectedReason(value === 'all' ? '' : value)
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Reasons" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Reasons</SelectItem>
                        {reasons.map((reason) => (
                            <SelectItem key={reason} value={reason}>
                                {reason}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={selectedMovementType || 'all'}
                    onValueChange={(value) =>
                        setSelectedMovementType(value === 'all' ? '' : value)
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Movement Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Movement Types</SelectItem>
                        {movementTypes.map((movementType) => (
                            <SelectItem key={movementType} value={movementType}>
                                {movementType}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={selectedReferenceType || 'all'}
                    onValueChange={(value) =>
                        setSelectedReferenceType(value === 'all' ? '' : value)
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Reference Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Reference Types</SelectItem>
                        {referenceTypes.map((referenceType) => (
                            <SelectItem key={referenceType} value={referenceType}>
                                {referenceType}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={selectedType || 'all'}
                    onValueChange={(value) =>
                        setSelectedType(value === 'all' ? '' : value)
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="IN">IN</SelectItem>
                        <SelectItem value="OUT">OUT</SelectItem>
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                >
                    Clear Filters
                </Button>
            </FilterSheetButton>
        </>
    );

    return (
        <AppLayout
            breadcrumbs={breadcrumbs}
            mobileHeaderContent={mobileHeaderControls}
        >
            <Head title="Inventory Movement History" />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
                {/* Top Section - Controls (Fixed Height) */}
                <div className="z-40 hidden flex-shrink-0 border-b border-border bg-card px-3 py-2.5 shadow-sm md:block md:p-4">
                    <div className="hidden items-center justify-between md:mb-4 md:flex">
                        <h1 className="hidden text-2xl font-bold md:block">
                            Inventory Movement History
                        </h1>
                    </div>

                    <div className="mb-2 hidden grid-cols-1 gap-2 md:grid md:grid-cols-2 lg:grid-cols-8">
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                        <select
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        >
                            <option value="">All Products</option>
                            {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                    {product.name}
                                </option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => {
                                const value = e.target.value;
                                setDateFrom(value);
                                triggerFetch({
                                    date_from: value || undefined,
                                    page: 1,
                                });
                            }}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            placeholder="From Date"
                        />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => {
                                const value = e.target.value;
                                setDateTo(value);
                                triggerFetch({
                                    date_to: value || undefined,
                                    page: 1,
                                });
                            }}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            placeholder="To Date"
                        />
                        <select
                            value={selectedReason}
                            onChange={(e) => setSelectedReason(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        >
                            <option value="">All Reasons</option>
                            {reasons.map((reason) => (
                                <option key={reason} value={reason}>
                                    {reason}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedMovementType}
                            onChange={(e) => setSelectedMovementType(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        >
                            <option value="">All Movement Types</option>
                            {movementTypes.map((movementType) => (
                                <option key={movementType} value={movementType}>
                                    {movementType}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedReferenceType}
                            onChange={(e) => setSelectedReferenceType(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        >
                            <option value="">All Reference Types</option>
                            {referenceTypes.map((referenceType) => (
                                <option key={referenceType} value={referenceType}>
                                    {referenceType}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        >
                            <option value="">All Types</option>
                            <option value="IN">IN</option>
                            <option value="OUT">OUT</option>
                        </select>
                    </div>
                    <div className="hidden items-center gap-2 md:flex">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearFilters}
                        >
                            Clear Filters
                        </Button>
                    </div>
                </div>

                {/* Table Container - Dynamic Expansion */}
                <div className="min-h-0 flex-1 overflow-y-auto bg-background">
                    <div className="p-4">
                        <div className="space-y-3 md:hidden">
                            {movements.data.length > 0 ? (
                                movements.data.map((movement) => (
                                    <MobileRecordCard
                                        key={movement.id}
                                        title={
                                            movement.product_variant.product
                                                .name
                                        }
                                        subtitle={
                                            movement.product_variant.description
                                        }
                                        value={formatSignedQuantity(movement)}
                                        badges={[
                                            movement.type === 'IN'
                                                ? {
                                                      label: 'IN',
                                                      className:
                                                          'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                                                  }
                                                : {
                                                      label: 'OUT',
                                                      className:
                                                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                                                  },
                                        ]}
                                    >
                                        <MobileRecordRow
                                            label="Date"
                                            value={new Date(
                                                movement.created_at,
                                            ).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        />
                                        <MobileRecordRow
                                            label="Reason"
                                            value={movement.reason}
                                        />
                                        <MobileRecordRow
                                            label="Movement Type"
                                            value={movement.movement_type || '-'}
                                        />
                                        <MobileRecordRow
                                            label="Reference Type"
                                            value={movement.reference_type || '-'}
                                        />
                                        <MobileRecordRow
                                            label="Recorded By"
                                            value={movement.recorded_by.name}
                                        />
                                        <MobileRecordRow
                                            label="Unit Cost"
                                            value={
                                                movement.unit_cost
                                                    ? `â‚±${formatCurrency(movement.unit_cost)}`
                                                    : '-'
                                            }
                                        />
                                        <MobileRecordRow
                                            label="Total Cost"
                                            value={
                                                movement.total_cost
                                                    ? `â‚±${formatCurrency(movement.total_cost)}`
                                                    : '-'
                                            }
                                        />
                                        <MobileRecordRow
                                            label="Notes"
                                            value={movement.notes || '-'}
                                        />
                                    </MobileRecordCard>
                                ))
                            ) : (
                                <div className="rounded-xl border border-sidebar-border/70 bg-card p-8 text-center text-gray-500 dark:border-sidebar-border dark:text-gray-400">
                                    No inventory movements found.
                                </div>
                            )}
                        </div>

                        <div className="hidden rounded-xl border border-sidebar-border/70 md:block dark:border-sidebar-border">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Date
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Product
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Variant
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Type
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Qty (Signed)
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Unit Cost
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Total Cost
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Reason
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Movement Type
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Reference
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Recorded By
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                                                Notes
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
                                        {movements.data.map((movement) => (
                                            <tr
                                                key={movement.id}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-800"
                                            >
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {new Date(
                                                        movement.created_at,
                                                    ).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {
                                                        movement.product_variant
                                                            .product.name
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {
                                                        movement.product_variant
                                                            .description
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {movement.type === 'IN' ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                                                            <TrendingUp className="h-3 w-3" />
                                                            IN
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
                                                            <TrendingDown className="h-3 w-3" />
                                                            OUT
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                                    {formatSignedQuantity(movement)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {movement.unit_cost
                                                        ? `â‚±${formatCurrency(movement.unit_cost)}`
                                                        : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {movement.total_cost
                                                        ? `â‚±${formatCurrency(movement.total_cost)}`
                                                        : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {movement.reason}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {movement.movement_type || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {movement.reference_type || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {movement.recorded_by.name}
                                                </td>
                                                <td
                                                    className="max-w-xs truncate px-4 py-3 text-sm text-gray-600 dark:text-gray-400"
                                                    title={movement.notes || ''}
                                                >
                                                    {movement.notes || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {movements.data.length === 0 && (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No inventory movements found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pagination - Fixed at bottom of viewport */}
                <div className="z-30 flex-shrink-0 border-t border-border bg-card shadow-sm">
                    {movements.data.length > 0 && (
                        <Pagination
                            currentPage={movements.current_page}
                            lastPage={movements.last_page}
                            total={movements.total}
                            perPage={movements.per_page}
                            onPageChange={handlePageChange}
                            filters={{
                                search: debouncedSearch,
                                product_id: selectedProduct || undefined,
                                date_from: dateFrom ? dateFrom : undefined,
                                date_to: dateTo ? dateTo : undefined,
                                reason: selectedReason || undefined,
                                movement_type: selectedMovementType || undefined,
                                reference_type: selectedReferenceType || undefined,
                                type: selectedType || undefined,
                            }}
                            pageSizeSelector={
                                <RowsPerPageSelector
                                    perPage={perPage}
                                    onPerPageChange={handlePerPageChange}
                                    storageKey={STORAGE_KEY}
                                />
                            }
                        />
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
