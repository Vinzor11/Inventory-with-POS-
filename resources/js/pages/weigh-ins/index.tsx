import { ManagePricesModal } from '@/components/manage-prices-modal';
import { FilterSheetButton } from '@/components/mobile/filter-sheet-button';
import {
    RecordActionsSheet,
    type RecordActionItem,
} from '@/components/mobile/record-actions-sheet';
import {
    MobileRecordCard,
    MobileRecordRow,
} from '@/components/mobile/record-card';
import { NewWeighInModal } from '@/components/new-weigh-in-modal';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
    PER_PAGE_OPTIONS,
    RowsPerPageSelector,
} from '@/components/ui/rows-per-page-selector';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { formatCurrency } from '@/lib/format-currency';
import { fetchWeighInReceiptText, shareReceipt } from '@/lib/receipt-print';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    Check,
    ChevronDown,
    ChevronRight,
    Eye,
    Plus,
    Printer,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Weigh-Ins', href: '/weigh-ins' },
];

interface User {
    id: number;
    name: string;
}

interface WeighIn {
    id: number;
    ref_num: string;
    type: 'cooked_copra' | 'uncooked_copra' | 'coconut';
    weight_kg: number | null;
    count: number | null;
    unit_price: number;
    total_amount: number;
    status: 'unpaid' | 'paid';
    weighed_by: User;
    weighed_at: string;
    notes: string | null;
}

interface WeighInTransaction {
    id: number;
    ref_num: string;
    total_amount: number;
    status: 'unpaid' | 'paid';
    weighed_by: User;
    weighed_at: string;
    notes: string | null;
    weigh_ins: WeighIn[];
}

interface WeighInsIndexProps {
    transactions: {
        data: WeighInTransaction[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    standaloneWeighIns: WeighIn[];
    filters: { search?: string; per_page?: number; type?: string };
    users?: User[];
    prices?: {
        cooked_copra: number | null;
        uncooked_copra: number | null;
        coconut: number | null;
    };
}

const STORAGE_KEY = 'weigh_ins_perPage';
type WeighInFetchParams = {
    page?: number;
    per_page?: number;
    search?: string;
    type?: string;
};

export default function WeighInsIndex({
    transactions,
    standaloneWeighIns,
    filters,
    users = [],
    prices = { cooked_copra: null, uncooked_copra: null, coconut: null },
}: WeighInsIndexProps) {
    const { auth } = usePage<SharedData>().props;
    const isAdmin = auth.user?.role === 'admin';
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [perPage, setPerPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (
                saved &&
                PER_PAGE_OPTIONS.includes(
                    saved as (typeof PER_PAGE_OPTIONS)[number],
                )
            ) {
                return saved;
            }
        }
        return String(filters?.per_page ?? 15);
    });
    const [isManagePricesModalOpen, setIsManagePricesModalOpen] =
        useState(false);
    const [isNewWeighInModalOpen, setIsNewWeighInModalOpen] = useState(false);
    const [expandedTransactions, setExpandedTransactions] = useState<
        Set<number>
    >(new Set());

    // Receipt state
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
    const [selectedTransactionId, setSelectedTransactionId] = useState<
        number | null
    >(null);

    const triggerFetch = useCallback(
        (params: WeighInFetchParams = {}) => {
            router.get(
                '/weigh-ins',
                {
                    page: params.page || transactions?.current_page || 1,
                    per_page: params.per_page || parseInt(perPage, 10),
                    search:
                        params.search !== undefined
                            ? params.search
                            : debouncedSearch,
                    type:
                        params.type !== undefined ? params.type : filters?.type,
                    ...params,
                },
                { preserveState: true, preserveScroll: false, replace: true },
            );
        },
        [debouncedSearch, perPage, transactions?.current_page, filters?.type],
    );

    useEffect(() => {
        if (debouncedSearch !== (filters?.search || '')) {
            triggerFetch({ search: debouncedSearch, page: 1 });
        }
    }, [debouncedSearch, filters?.search, triggerFetch]);

    const handlePerPageChange = (value: number) => {
        const valueStr = String(value);
        setPerPage(valueStr);
        if (typeof window !== 'undefined')
            localStorage.setItem(STORAGE_KEY, valueStr);
        triggerFetch({ per_page: value, page: 1 });
    };

    const handleMarkAsPaid = (id: number, type: 'transaction' | 'weigh_in') => {
        router.put(
            `/weigh-ins/${id}/status`,
            { status: 'paid', type },
            {
                preserveScroll: true,
                onSuccess: () => {
                    router.reload();
                },
            },
        );
    };

    const toggleTransaction = (transactionId: number) => {
        const newExpanded = new Set(expandedTransactions);
        if (newExpanded.has(transactionId)) {
            newExpanded.delete(transactionId);
        } else {
            newExpanded.add(transactionId);
        }
        setExpandedTransactions(newExpanded);
    };

    const handlePrintReceipt = async (transactionId: number) => {
        setSelectedTransactionId(transactionId);
        setIsLoadingReceipt(true);
        try {
            // Fetch ESC/POS formatted receipt (has bold commands)
            const text = await fetchWeighInReceiptText(transactionId, 80);
            // Directly share to RawBT
            await shareReceipt(text);
        } catch (error) {
            console.error('Failed to print receipt:', error);
        } finally {
            setIsLoadingReceipt(false);
            setSelectedTransactionId(null);
        }
    };

    const allItems = [
        ...transactions.data.map((t) => ({
            type: 'transaction' as const,
            data: t,
        })),
        ...standaloneWeighIns.map((w) => ({
            type: 'weigh_in' as const,
            data: w,
        })),
    ].sort((a, b) => {
        const dateA = new Date(a.data.weighed_at).getTime();
        const dateB = new Date(b.data.weighed_at).getTime();
        return dateB - dateA;
    });

    const mobileHeaderControls = (
        <>
            <input
                type="text"
                placeholder="Search by ref number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="app-search-surface h-10 min-w-0 flex-1 px-3 text-sm"
            />
            {isAdmin && (
                <FilterSheetButton title="Weigh-In Filters">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsManagePricesModalOpen(true)}
                    >
                        Manage Prices
                    </Button>
                </FilterSheetButton>
            )}
        </>
    );

    return (
        <AppLayout
            breadcrumbs={breadcrumbs}
            mobileHeaderContent={mobileHeaderControls}
        >
            <Head title="Weigh-Ins" />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
                <div className="z-40 hidden flex-shrink-0 border-b border-border bg-card px-3 py-2.5 shadow-sm md:block md:space-y-4 md:p-4">
                    <div className="hidden items-center justify-between md:flex">
                        <h1 className="hidden text-2xl font-bold md:block">
                            Weigh-Ins
                        </h1>
                        <div className="flex gap-2">
                            {isAdmin && (
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setIsManagePricesModalOpen(true)
                                    }
                                >
                                    Manage Prices
                                </Button>
                            )}
                            <Button
                                className="hidden md:inline-flex"
                                onClick={() => setIsNewWeighInModalOpen(true)}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                New Weigh-In
                            </Button>
                        </div>
                    </div>
                    <div className="hidden items-center gap-2 md:flex">
                        <input
                            type="text"
                            placeholder="Search by ref number or weigher name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none md:py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto bg-background">
                    <div className="p-4">
                        <div className="space-y-3 md:hidden">
                            {allItems.length > 0 ? (
                                allItems.map((item) => {
                                    if (item.type === 'transaction') {
                                        const transaction =
                                            item.data as WeighInTransaction;
                                        const actions: RecordActionItem[] = [
                                            {
                                                key: 'print',
                                                label: 'Print Receipt',
                                                icon: (
                                                    <Printer className="h-4 w-4" />
                                                ),
                                                onClick: () =>
                                                    handlePrintReceipt(
                                                        transaction.id,
                                                    ),
                                                disabled:
                                                    isLoadingReceipt &&
                                                    selectedTransactionId ===
                                                        transaction.id,
                                            },
                                        ];
                                        if (transaction.status === 'unpaid') {
                                            actions.push({
                                                key: 'paid',
                                                label: 'Mark as Paid',
                                                icon: (
                                                    <Check className="h-4 w-4" />
                                                ),
                                                onClick: () =>
                                                    handleMarkAsPaid(
                                                        transaction.id,
                                                        'transaction',
                                                    ),
                                            });
                                        }

                                        return (
                                            <MobileRecordCard
                                                key={`m-tx-${transaction.id}`}
                                                title={transaction.ref_num}
                                                subtitle={`${transaction.weigh_ins.length} item(s)`}
                                                value={`â‚±${formatCurrency(transaction.total_amount)}`}
                                                badges={[
                                                    {
                                                        label:
                                                            transaction.status ===
                                                            'paid'
                                                                ? 'Paid'
                                                                : 'Unpaid',
                                                        className:
                                                            transaction.status ===
                                                            'paid'
                                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                                                    },
                                                ]}
                                                footer={
                                                    <div className="flex items-center justify-end">
                                                        <RecordActionsSheet
                                                            title={
                                                                transaction.ref_num
                                                            }
                                                            description="Transaction actions"
                                                            actions={actions}
                                                        />
                                                    </div>
                                                }
                                            >
                                                <MobileRecordRow
                                                    label="Weighed By"
                                                    value={
                                                        transaction.weighed_by
                                                            .name
                                                    }
                                                />
                                                <MobileRecordRow
                                                    label="Date"
                                                    value={new Date(
                                                        transaction.weighed_at,
                                                    ).toLocaleDateString(
                                                        'en-US',
                                                        {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                        },
                                                    )}
                                                />
                                            </MobileRecordCard>
                                        );
                                    }

                                    const weighIn = item.data as WeighIn;
                                    const actions: RecordActionItem[] = [];
                                    if (weighIn.status === 'unpaid') {
                                        actions.push({
                                            key: 'paid',
                                            label: 'Mark as Paid',
                                            icon: <Check className="h-4 w-4" />,
                                            onClick: () =>
                                                handleMarkAsPaid(
                                                    weighIn.id,
                                                    'weigh_in',
                                                ),
                                        });
                                    }

                                    return (
                                        <MobileRecordCard
                                            key={`m-wi-${weighIn.id}`}
                                            title={weighIn.ref_num}
                                            subtitle={weighIn.type.replace(
                                                '_',
                                                ' ',
                                            )}
                                            value={`â‚±${formatCurrency(weighIn.total_amount)}`}
                                            badges={[
                                                {
                                                    label:
                                                        weighIn.status ===
                                                        'paid'
                                                            ? 'Paid'
                                                            : 'Unpaid',
                                                    className:
                                                        weighIn.status ===
                                                        'paid'
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                                                },
                                            ]}
                                            footer={
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        className="h-11 flex-1"
                                                        onClick={() =>
                                                            router.visit(
                                                                `/weigh-ins/${weighIn.id}`,
                                                            )
                                                        }
                                                    >
                                                        View Details
                                                    </Button>
                                                    <RecordActionsSheet
                                                        title={weighIn.ref_num}
                                                        description="Weigh-in actions"
                                                        actions={actions}
                                                    />
                                                </div>
                                            }
                                        >
                                            <MobileRecordRow
                                                label="Weight/Count"
                                                value={
                                                    weighIn.type ===
                                                        'cooked_copra' ||
                                                    weighIn.type ===
                                                        'uncooked_copra'
                                                        ? `${weighIn.weight_kg} kg`
                                                        : `${weighIn.count} pieces`
                                                }
                                            />
                                            <MobileRecordRow
                                                label="Weighed By"
                                                value={weighIn.weighed_by.name}
                                            />
                                            <MobileRecordRow
                                                label="Date"
                                                value={new Date(
                                                    weighIn.weighed_at,
                                                ).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                })}
                                            />
                                        </MobileRecordCard>
                                    );
                                })
                            ) : (
                                <div className="rounded-xl border border-sidebar-border/70 bg-card p-8 text-center text-gray-500 dark:border-sidebar-border">
                                    No weigh-ins found.
                                </div>
                            )}
                        </div>

                        <div className="hidden rounded-xl border border-sidebar-border/70 md:block dark:border-sidebar-border">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="w-8 px-4 py-3 text-left text-sm font-medium"></th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">
                                                Ref #
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">
                                                Type/Items
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">
                                                Total Amount
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">
                                                Status
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">
                                                Weighed By
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">
                                                Weighed At
                                            </th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
                                        {allItems.map((item) => {
                                            if (item.type === 'transaction') {
                                                const transaction =
                                                    item.data as WeighInTransaction;
                                                const isExpanded =
                                                    expandedTransactions.has(
                                                        transaction.id,
                                                    );
                                                return (
                                                    <>
                                                        <tr
                                                            key={`tx-${transaction.id}`}
                                                            className="bg-blue-50/30 hover:bg-gray-50 dark:bg-blue-900/10 dark:hover:bg-gray-800"
                                                        >
                                                            <td className="px-4 py-3">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() =>
                                                                        toggleTransaction(
                                                                            transaction.id,
                                                                        )
                                                                    }
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="h-4 w-4" />
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-sm font-semibold">
                                                                {
                                                                    transaction.ref_num
                                                                }
                                                            </td>
                                                            <td className="px-4 py-3 text-sm">
                                                                <span className="font-medium">
                                                                    {
                                                                        transaction
                                                                            .weigh_ins
                                                                            .length
                                                                    }{' '}
                                                                    item
                                                                    {transaction
                                                                        .weigh_ins
                                                                        .length !==
                                                                    1
                                                                        ? 's'
                                                                        : ''}
                                                                </span>
                                                                <div className="mt-1 text-xs text-gray-500">
                                                                    {transaction.weigh_ins
                                                                        .map(
                                                                            (
                                                                                w,
                                                                            ) =>
                                                                                w.type.replace(
                                                                                    '_',
                                                                                    ' ',
                                                                                ),
                                                                        )
                                                                        .join(
                                                                            ', ',
                                                                        )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm font-semibold">
                                                                â‚±
                                                                {formatCurrency(
                                                                    transaction.total_amount,
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm">
                                                                <span
                                                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                                        transaction.status ===
                                                                        'paid'
                                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                                    }`}
                                                                >
                                                                    {transaction.status ===
                                                                    'paid'
                                                                        ? 'Paid'
                                                                        : 'Unpaid'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm">
                                                                {
                                                                    transaction
                                                                        .weighed_by
                                                                        .name
                                                                }
                                                            </td>
                                                            <td className="px-4 py-3 text-sm">
                                                                {new Date(
                                                                    transaction.weighed_at,
                                                                ).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0"
                                                                        title="Print receipt"
                                                                        onClick={() =>
                                                                            handlePrintReceipt(
                                                                                transaction.id,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            isLoadingReceipt &&
                                                                            selectedTransactionId ===
                                                                                transaction.id
                                                                        }
                                                                    >
                                                                        <Printer className="h-4 w-4" />
                                                                    </Button>
                                                                    {transaction.status ===
                                                                        'unpaid' && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0"
                                                                            title="Mark as paid"
                                                                            onClick={() =>
                                                                                handleMarkAsPaid(
                                                                                    transaction.id,
                                                                                    'transaction',
                                                                                )
                                                                            }
                                                                        >
                                                                            <Check className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {isExpanded &&
                                                            transaction.weigh_ins.map(
                                                                (weighIn) => (
                                                                    <tr
                                                                        key={`wi-${weighIn.id}`}
                                                                        className="bg-gray-50/50 hover:bg-gray-50 dark:bg-gray-900/30 dark:hover:bg-gray-800"
                                                                    >
                                                                        <td className="px-4 py-2"></td>
                                                                        <td className="px-4 py-2 pl-8 font-mono text-sm text-xs">
                                                                            â””â”€{' '}
                                                                            {
                                                                                weighIn.ref_num
                                                                            }
                                                                        </td>
                                                                        <td className="px-4 py-2 text-sm">
                                                                            <span className="capitalize">
                                                                                {weighIn.type.replace(
                                                                                    '_',
                                                                                    ' ',
                                                                                )}
                                                                            </span>
                                                                            <div className="text-xs text-gray-500">
                                                                                {weighIn.type ===
                                                                                    'cooked_copra' ||
                                                                                weighIn.type ===
                                                                                    'uncooked_copra'
                                                                                    ? `${weighIn.weight_kg} kg`
                                                                                    : `${weighIn.count} pieces`}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-2 text-sm">
                                                                            â‚±
                                                                            {formatCurrency(
                                                                                weighIn.total_amount,
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-sm">
                                                                            <span
                                                                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                                                                                    weighIn.status ===
                                                                                    'paid'
                                                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                                                }`}
                                                                            >
                                                                                {weighIn.status ===
                                                                                'paid'
                                                                                    ? 'Paid'
                                                                                    : 'Unpaid'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-2 text-sm"></td>
                                                                        <td className="px-4 py-2 text-sm"></td>
                                                                        <td className="px-4 py-2 text-sm">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0"
                                                                                onClick={() =>
                                                                                    router.visit(
                                                                                        `/weigh-ins/${weighIn.id}`,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Eye className="h-4 w-4" />
                                                                            </Button>
                                                                        </td>
                                                                    </tr>
                                                                ),
                                                            )}
                                                    </>
                                                );
                                            } else {
                                                const weighIn =
                                                    item.data as WeighIn;
                                                return (
                                                    <tr
                                                        key={`wi-${weighIn.id}`}
                                                        className="hover:bg-gray-50 dark:hover:bg-gray-800"
                                                    >
                                                        <td className="px-4 py-3"></td>
                                                        <td className="px-4 py-3 font-mono text-sm">
                                                            {weighIn.ref_num}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm">
                                                            <span className="capitalize">
                                                                {weighIn.type.replace(
                                                                    '_',
                                                                    ' ',
                                                                )}
                                                            </span>
                                                            <div className="mt-1 text-xs text-gray-500">
                                                                {weighIn.type ===
                                                                    'cooked_copra' ||
                                                                weighIn.type ===
                                                                    'uncooked_copra'
                                                                    ? `${weighIn.weight_kg} kg`
                                                                    : `${weighIn.count} pieces`}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-semibold">
                                                            â‚±
                                                            {formatCurrency(
                                                                weighIn.total_amount,
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm">
                                                            <span
                                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                                    weighIn.status ===
                                                                    'paid'
                                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                                }`}
                                                            >
                                                                {weighIn.status ===
                                                                'paid'
                                                                    ? 'Paid'
                                                                    : 'Unpaid'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm">
                                                            {
                                                                weighIn
                                                                    .weighed_by
                                                                    .name
                                                            }
                                                        </td>
                                                        <td className="px-4 py-3 text-sm">
                                                            {new Date(
                                                                weighIn.weighed_at,
                                                            ).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0"
                                                                    onClick={() =>
                                                                        router.visit(
                                                                            `/weigh-ins/${weighIn.id}`,
                                                                        )
                                                                    }
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                                {weighIn.status ===
                                                                    'unpaid' && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0"
                                                                        title="Mark as paid"
                                                                        onClick={() =>
                                                                            handleMarkAsPaid(
                                                                                weighIn.id,
                                                                                'weigh_in',
                                                                            )
                                                                        }
                                                                    >
                                                                        <Check className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {allItems.length === 0 && (
                                <div className="p-8 text-center text-gray-500">
                                    No weigh-ins found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="z-30 flex-shrink-0 border-t border-border bg-card shadow-sm">
                    {transactions.data.length > 0 && (
                        <Pagination
                            currentPage={transactions.current_page}
                            lastPage={transactions.last_page}
                            total={transactions.total}
                            perPage={transactions.per_page}
                            onPageChange={(page) => triggerFetch({ page })}
                            filters={{ search: debouncedSearch }}
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

            {!isNewWeighInModalOpen && (
                <button
                    type="button"
                    className="mobile-fab fixed right-4 bottom-20 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-xl hover:bg-green-700 active:bg-green-700 lg:hidden"
                    onClick={() => setIsNewWeighInModalOpen(true)}
                    aria-label="Create weigh-in"
                >
                    <Plus className="h-6 w-6" />
                </button>
            )}

            <ManagePricesModal
                isOpen={isManagePricesModalOpen}
                onClose={() => setIsManagePricesModalOpen(false)}
                prices={prices}
                canEdit={isAdmin}
                onSuccess={() => {
                    router.reload({ only: ['prices'] });
                }}
            />

            <NewWeighInModal
                isOpen={isNewWeighInModalOpen}
                onClose={() => setIsNewWeighInModalOpen(false)}
                users={users}
                prices={prices}
                onSuccess={() => {
                    router.reload();
                }}
            />
        </AppLayout>
    );
}
