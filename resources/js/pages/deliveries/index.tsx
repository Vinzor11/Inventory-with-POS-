import { Head } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { RowsPerPageSelector, PER_PAGE_OPTIONS } from '@/components/ui/rows-per-page-selector';
import { Eye, Printer } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { ReceiptPreviewDialog } from '@/components/receipt-preview-dialog';
import { fetchDeliveryReceiptText, printDeliveryReceipt } from '@/lib/receipt-print';
import { toast } from '@/lib/toast';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Deliveries',
        href: '/deliveries',
    },
];

interface User {
    id: number;
    name: string;
}

interface SaleDelivery {
    id: number;
    sale_number: string;
    delivery_status: 'pending' | 'partial' | 'delivered' | 'canceled' | 'returned';
    delivered_at: string | null;
    delivered_by: User | null;
    total_items: number;
    delivery_count: number;
    latest_delivery_id?: number | null;
}

interface DeliveriesIndexProps {
    deliveries: {
        data: SaleDelivery[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        search?: string;
        status?: string;
        per_page?: number;
    };
}

const STORAGE_KEY = 'deliveries_perPage';

export default function DeliveriesIndex({ deliveries, filters }: DeliveriesIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const debouncedSearch = useDebounce(search, 500);
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
    const [perPage, setPerPage] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && PER_PAGE_OPTIONS.includes(saved as any)) {
                return saved;
            }
        }
        return String(filters?.per_page ?? 15);
    });

    const triggerFetch = useCallback((params: any = {}) => {
        router.get('/deliveries', {
            page: params.page || deliveries?.current_page || 1,
            per_page: params.per_page || parseInt(perPage, 10),
            search: params.search !== undefined ? params.search : debouncedSearch,
            status: params.status !== undefined ? params.status : (statusFilter === 'all' ? undefined : statusFilter),
            ...params,
        }, {
            preserveState: true,
            preserveScroll: false,
            replace: true,
        });
    }, [debouncedSearch, statusFilter, perPage, deliveries?.current_page]);

    useEffect(() => {
        triggerFetch({ search: debouncedSearch, status: statusFilter === 'all' ? undefined : statusFilter, page: 1 });
    }, [debouncedSearch, statusFilter]);

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

    // Receipt preview state
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    const [receiptText, setReceiptText] = useState('');
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
    const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null);

    const handlePrintReceipt = async (deliveryId: number | null | undefined) => {
        if (!deliveryId) {
            toast.error('No delivery found to print');
            return;
        }
        
        setSelectedDeliveryId(deliveryId);
        setIsLoadingReceipt(true);
        try {
            const text = await fetchDeliveryReceiptText(deliveryId);
            setReceiptText(text);
            setShowReceiptPreview(true);
        } catch (error) {
            console.error('Failed to fetch receipt:', error);
            toast.error('Failed to load receipt');
        } finally {
            setIsLoadingReceipt(false);
        }
    };

    const handleConfirmPrint = async () => {
        if (!selectedDeliveryId) return;
        await printDeliveryReceipt(selectedDeliveryId);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Deliveries" />
            <div className="flex flex-col overflow-hidden bg-background" style={{ height: 'calc(100vh - 80px)' }}>
                <div className="flex-shrink-0 bg-card border-b border-border shadow-sm z-40 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">Deliveries</h1>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            type="text"
                            placeholder="Search by sale number..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="partial">Partial</option>
                            <option value="delivered">Delivered</option>
                        </select>
                        <RowsPerPageSelector
                            perPage={perPage}
                            onPerPageChange={(value) => handlePerPageChange(parseInt(value, 10))}
                            storageKey={STORAGE_KEY}
                        />
                    </div>
                </div>

                <div className="flex-1 min-h-0 bg-background overflow-y-auto">
                    <div className="p-4">
                        <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-sidebar-border/70 bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Sale Number</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Delivered By</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Delivered At</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Status</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Items</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/70">
                                        {deliveries.data.map((saleDelivery) => (
                                            <tr key={saleDelivery.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {saleDelivery.sale_number}
                                                    {saleDelivery.delivery_count > 1 && (
                                                        <span className="ml-2 text-xs text-gray-500">
                                                            ({saleDelivery.delivery_count} deliveries)
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {saleDelivery.delivered_by?.name || 'Not assigned'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {saleDelivery.delivered_at ? new Date(saleDelivery.delivered_at).toLocaleString() : 'Pending'}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        saleDelivery.delivery_status === 'delivered' 
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                                            : saleDelivery.delivery_status === 'partial'
                                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                            : saleDelivery.delivery_status === 'canceled'
                                                            ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                    }`}>
                                                        {saleDelivery.delivery_status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {saleDelivery.total_items} item(s)
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            title="Print receipt"
                                                            onClick={() => handlePrintReceipt(saleDelivery.latest_delivery_id)}
                                                            disabled={isLoadingReceipt && selectedDeliveryId === saleDelivery.latest_delivery_id || !saleDelivery.latest_delivery_id}
                                                        >
                                                            <Printer className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            title="View details"
                                                            onClick={() => router.visit(`/sales/${saleDelivery.id}/delivery`)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {deliveries.data.length === 0 && (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No deliveries found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-shrink-0 bg-card border-t border-border shadow-sm z-30">
                    {deliveries.data.length > 0 && (
                        <Pagination
                            currentPage={deliveries.current_page}
                            lastPage={deliveries.last_page}
                            total={deliveries.total}
                            perPage={deliveries.per_page}
                            onPageChange={handlePageChange}
                            filters={{
                                search: debouncedSearch,
                                status: statusFilter === 'all' ? undefined : statusFilter,
                            }}
                        />
                    )}
                </div>
            </div>
            
            {/* Receipt Preview Dialog */}
            <ReceiptPreviewDialog
                isOpen={showReceiptPreview}
                onClose={() => setShowReceiptPreview(false)}
                receiptText={receiptText}
                onConfirm={handleConfirmPrint}
                title="Delivery Receipt Preview"
            />
        </AppLayout>
    );
}

