import { Head } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import { Eye, Plus, Check, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { ManagePricesModal } from '@/components/manage-prices-modal';
import { NewWeighInModal } from '@/components/new-weigh-in-modal';
import { formatCurrency } from '@/lib/format-currency';
import { ReceiptPreviewDialog } from '@/components/receipt-preview-dialog';
import { fetchWeighInReceiptText, printWeighInReceipt } from '@/lib/receipt-print';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Weigh-Ins', href: '/weigh-ins' }];

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

export default function WeighInsIndex({ transactions, standaloneWeighIns, filters, users = [], prices = { cooked_copra: null, uncooked_copra: null, coconut: null } }: WeighInsIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [perPage, setPerPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && PER_PAGE_OPTIONS.includes(saved as any)) return saved;
        }
        return String(filters?.per_page ?? 15);
    });
    const [isManagePricesModalOpen, setIsManagePricesModalOpen] = useState(false);
    const [isNewWeighInModalOpen, setIsNewWeighInModalOpen] = useState(false);
    const [expandedTransactions, setExpandedTransactions] = useState<Set<number>>(new Set());
    
    // Receipt preview state
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    const [receiptText, setReceiptText] = useState('');
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);

    const triggerFetch = useCallback((params: any = {}) => {
        router.get('/weigh-ins', {
            page: params.page || transactions?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            search: params.search !== undefined ? params.search : debouncedSearch,
            type: params.type !== undefined ? params.type : filters?.type,
            ...params,
        }, { preserveState: true, preserveScroll: false, replace: true });
    }, [debouncedSearch, perPage, transactions?.current_page, filters?.type]);

    useEffect(() => {
        if (debouncedSearch !== (filters?.search || '')) {
            triggerFetch({ search: debouncedSearch, page: 1 });
        }
    }, [debouncedSearch, filters?.search, triggerFetch]);

    const handlePerPageChange = (value: number) => {
        const valueStr = String(value);
        setPerPage(valueStr);
        if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, valueStr);
        triggerFetch({ per_page: value, page: 1 });
    };

    const handleMarkAsPaid = (id: number, type: 'transaction' | 'weigh_in') => {
        router.put(`/weigh-ins/${id}/status`, { status: 'paid', type }, {
            preserveScroll: true,
            onSuccess: () => {
                router.reload();
            },
        });
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
            const text = await fetchWeighInReceiptText(transactionId);
            setReceiptText(text);
            setShowReceiptPreview(true);
        } catch (error) {
            console.error('Failed to fetch receipt:', error);
        } finally {
            setIsLoadingReceipt(false);
        }
    };

    const handleConfirmPrint = async () => {
        if (!selectedTransactionId) return;
        
        setIsPrinting(true);
        try {
            await printWeighInReceipt(selectedTransactionId);
            setShowReceiptPreview(false);
        } catch (error) {
            console.error('Print failed:', error);
        } finally {
            setIsPrinting(false);
        }
    };

    const allItems = [
        ...transactions.data.map(t => ({ type: 'transaction' as const, data: t })),
        ...standaloneWeighIns.map(w => ({ type: 'weigh_in' as const, data: w })),
    ].sort((a, b) => {
        const dateA = new Date(a.data.weighed_at).getTime();
        const dateB = new Date(b.data.weighed_at).getTime();
        return dateB - dateA;
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Weigh-Ins" />
            <div className="flex flex-col overflow-hidden bg-background" style={{ height: 'calc(100vh - 80px)' }}>
                <div className="flex-shrink-0 bg-card border-b border-border shadow-sm z-40 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">Weigh-Ins</h1>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsManagePricesModalOpen(true)}>
                                Manage Prices
                            </Button>
                            <Button onClick={() => setIsNewWeighInModalOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                New Weigh-In
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            type="text"
                            placeholder="Search by ref number or weigher name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                        <RowsPerPageSelector perPage={perPage} onPerPageChange={(value) => handlePerPageChange(parseInt(value, 10))} storageKey={STORAGE_KEY} />
                    </div>
                </div>
                <div className="flex-1 min-h-0 bg-background overflow-y-auto">
                    <div className="p-4">
                        <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium w-8"></th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">Ref #</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">Type/Items</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">Total Amount</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">Weighed By</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">Weighed At</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
                                        {allItems.map((item) => {
                                            if (item.type === 'transaction') {
                                                const transaction = item.data as WeighInTransaction;
                                                const isExpanded = expandedTransactions.has(transaction.id);
                                                return (
                                                    <>
                                                        <tr key={`tx-${transaction.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 bg-blue-50/30 dark:bg-blue-900/10">
                                                            <td className="px-4 py-3">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => toggleTransaction(transaction.id)}
                                                                >
                                                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                </Button>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm font-mono font-semibold">{transaction.ref_num}</td>
                                                            <td className="px-4 py-3 text-sm">
                                                                <span className="font-medium">{transaction.weigh_ins.length} item{transaction.weigh_ins.length !== 1 ? 's' : ''}</span>
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    {transaction.weigh_ins.map(w => w.type.replace('_', ' ')).join(', ')}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm font-semibold">₱{formatCurrency(transaction.total_amount)}</td>
                                                            <td className="px-4 py-3 text-sm">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                                    transaction.status === 'paid' 
                                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                                }`}>
                                                                    {transaction.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm">{transaction.weighed_by.name}</td>
                                                            <td className="px-4 py-3 text-sm">{new Date(transaction.weighed_at).toLocaleDateString()}</td>
                                                            <td className="px-4 py-3 text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="h-8 w-8 p-0" 
                                                                        title="Print receipt"
                                                                        onClick={() => handlePrintReceipt(transaction.id)}
                                                                        disabled={isLoadingReceipt && selectedTransactionId === transaction.id}
                                                                    >
                                                                        <Printer className="h-4 w-4" />
                                                                    </Button>
                                                                    {transaction.status === 'unpaid' && (
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="sm" 
                                                                            className="h-8 w-8 p-0" 
                                                                            title="Mark as paid"
                                                                            onClick={() => handleMarkAsPaid(transaction.id, 'transaction')}
                                                                        >
                                                                            <Check className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && transaction.weigh_ins.map((weighIn) => (
                                                            <tr key={`wi-${weighIn.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                                                                <td className="px-4 py-2"></td>
                                                                <td className="px-4 py-2 text-sm font-mono text-xs pl-8">└─ {weighIn.ref_num}</td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <span className="capitalize">{weighIn.type.replace('_', ' ')}</span>
                                                                    <div className="text-xs text-gray-500">
                                                                        {(weighIn.type === 'cooked_copra' || weighIn.type === 'uncooked_copra')
                                                                            ? `${weighIn.weight_kg} kg`
                                                                            : `${weighIn.count} pieces`}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2 text-sm">₱{formatCurrency(weighIn.total_amount)}</td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                                                                        weighIn.status === 'paid' 
                                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                                    }`}>
                                                                        {weighIn.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-2 text-sm"></td>
                                                                <td className="px-4 py-2 text-sm"></td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => router.visit(`/weigh-ins/${weighIn.id}`)}>
                                                                        <Eye className="h-4 w-4" />
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </>
                                                );
                                            } else {
                                                const weighIn = item.data as WeighIn;
                                                return (
                                                    <tr key={`wi-${weighIn.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                        <td className="px-4 py-3"></td>
                                                        <td className="px-4 py-3 text-sm font-mono">{weighIn.ref_num}</td>
                                                        <td className="px-4 py-3 text-sm">
                                                            <span className="capitalize">{weighIn.type.replace('_', ' ')}</span>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                {(weighIn.type === 'cooked_copra' || weighIn.type === 'uncooked_copra')
                                                                    ? `${weighIn.weight_kg} kg`
                                                                    : `${weighIn.count} pieces`}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-semibold">₱{formatCurrency(weighIn.total_amount)}</td>
                                                        <td className="px-4 py-3 text-sm">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                                weighIn.status === 'paid' 
                                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                            }`}>
                                                                {weighIn.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm">{weighIn.weighed_by.name}</td>
                                                        <td className="px-4 py-3 text-sm">{new Date(weighIn.weighed_at).toLocaleDateString()}</td>
                                                        <td className="px-4 py-3 text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => router.visit(`/weigh-ins/${weighIn.id}`)}>
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                                {weighIn.status === 'unpaid' && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="h-8 w-8 p-0" 
                                                                        title="Mark as paid"
                                                                        onClick={() => handleMarkAsPaid(weighIn.id, 'weigh_in')}
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
                            {allItems.length === 0 && <div className="p-8 text-center text-gray-500">No weigh-ins found.</div>}
                        </div>
                    </div>
                </div>
                <div className="flex-shrink-0 bg-card border-t border-border shadow-sm z-30">
                    {transactions.data.length > 0 && (
                        <Pagination
                            currentPage={transactions.current_page}
                            lastPage={transactions.last_page}
                            total={transactions.total}
                            perPage={transactions.per_page}
                            onPageChange={(page) => triggerFetch({ page })}
                            filters={{ search: debouncedSearch }}
                        />
                    )}
                </div>
            </div>

            <ManagePricesModal
                isOpen={isManagePricesModalOpen}
                onClose={() => setIsManagePricesModalOpen(false)}
                prices={prices}
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

            <ReceiptPreviewDialog
                isOpen={showReceiptPreview}
                onClose={() => setShowReceiptPreview(false)}
                receiptText={receiptText}
                onConfirm={handleConfirmPrint}
                title="Weigh-In Receipt Preview"
            />
        </AppLayout>
    );
}
