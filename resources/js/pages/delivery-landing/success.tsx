import { Head, usePage } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Truck, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/format-currency';
import { fetchDeliveryReceiptText, printDeliveryReceipt } from '@/lib/receipt-print';
import { ReceiptPreviewDialog } from '@/components/receipt-preview-dialog';
import { useState } from 'react';

interface User {
    id: number;
    name: string;
    email: string;
}

interface Product {
    id: number;
    name: string;
    base_unit: string;
}

interface ProductVariant {
    id: number;
    description: string;
    size: string | null;
    thickness: string | null;
    diameter: string | null;
    length: string | null;
    unit_price: number;
    product: Product;
}

interface DeliveryItem {
    id: number;
    quantity: number;
    product_variant: ProductVariant;
}

interface Sale {
    id: number;
    sale_number: string;
    created_at: string;
    cashier: User;
    delivery_name: string | null;
    delivery_address: string | null;
    delivery_contact: string | null;
}

interface Delivery {
    id: number;
    sale_id: number;
    delivered_at: string;
    status: string;
    notes: string | null;
    sale: Sale;
    delivered_by: User;
    items: DeliveryItem[];
}

interface DeliverySuccessProps {
    delivery: Delivery;
    deliverySummary: {
        total_items: number;
        total_value: number;
    };
}

export default function DeliverySuccess({ delivery, deliverySummary }: DeliverySuccessProps) {
    const { name: storeName } = usePage().props as { name?: string };
    const storeDisplayName = storeName || 'STORE NAME';
    const [isPrinting, setIsPrinting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [receiptText, setReceiptText] = useState<string>('');
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    
    const handleNewDelivery = () => {
        router.visit('/');
    };

    const handlePrintClick = async () => {
        setIsLoadingPreview(true);
        try {
            const text = await fetchDeliveryReceiptText(delivery.id, 80);
            setReceiptText(text);
            setShowPreview(true);
        } catch (error) {
            console.error('Failed to load receipt preview:', error);
            alert('Failed to load receipt preview. Please try again.');
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const handleConfirmPrint = async () => {
        await printDeliveryReceipt(delivery.id, { width: 80 });
    };

    const formatTransactionTime = (dateString: string) => {
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${month}/${day}/${year}, ${displayHours}:${minutes} ${ampm}`;
    };

    const generateDeliveryRef = (deliveryId: number, deliveredAt: string) => {
        const date = new Date(deliveredAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const sequence = String(deliveryId).padStart(4, '0');
        return `DR-${year}${month}${day}-${sequence}`;
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <>
            <Head title={`Delivery ${delivery.sale.sale_number}`} />
            
            {/* Screen View Only - Receipt is printed via ESC/POS service */}
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
                    {/* Success Header */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <div className="rounded-full bg-green-100 p-4">
                                <CheckCircle2 className="h-12 w-12 text-green-600" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Delivery Processed Successfully!</h1>
                        <p className="text-slate-600">Delivery receipt has been generated. You can print it below.</p>
                    </div>

                    {/* Delivery Details */}
                    <div className="border-t border-b border-slate-200 py-6 mb-6">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="text-sm text-slate-500">Delivery Ref #</p>
                                <p className="text-lg font-semibold text-slate-900">{generateDeliveryRef(delivery.id, delivery.delivered_at)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Related Sale #</p>
                                <p className="text-lg font-semibold text-slate-900">{delivery.sale.sale_number}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Txn Date & Time</p>
                                <p className="text-lg font-semibold text-slate-900">
                                    {formatTransactionTime(delivery.sale.created_at)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Delivered By</p>
                                <p className="text-lg font-semibold text-slate-900">{delivery.delivered_by.name}</p>
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Delivered Items</h2>
                        <div className="space-y-3">
                            {delivery.items.map((item) => {
                                const variant = item.product_variant;
                                const product = variant.product;
                                const variantParts = [];
                                
                                // Check if size contains length information (e.g., "8 ft")
                                if (variant.size) {
                                    // If size looks like a length measurement, use it
                                    if (variant.size.match(/\d+\s*(ft|m|cm|inch|in)/i)) {
                                        variantParts.push(variant.size);
                                    }
                                }
                                if (variant.thickness) variantParts.push(variant.thickness);
                                if (variant.diameter) variantParts.push(variant.diameter);
                                
                                // Combine variant parts with × symbol
                                const variantDetail = variantParts.length > 0 
                                    ? ` - ${variantParts.join(' × ')}`
                                    : '';
                                
                                return (
                                    <div key={item.id} className="flex justify-between items-start py-2 border-b border-slate-100">
                                        <div className="flex-1">
                                            <p className="font-medium text-slate-900">
                                                {product.name}{variantDetail}
                                            </p>
                                            <p className="text-sm text-slate-600 mt-1">
                                                {item.quantity} {product.base_unit}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Notes */}
                    {delivery.notes && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                            <p className="text-sm text-slate-500 mb-1">Notes</p>
                            <p className="text-slate-900">{delivery.notes}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={handlePrintClick}
                            disabled={isLoadingPreview || isPrinting}
                        >
                            <Printer className="h-4 w-4 mr-2" />
                            {isLoadingPreview ? 'Loading...' : isPrinting ? 'Printing...' : 'Print Delivery Receipt'}
                        </Button>
                        <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                            onClick={handleNewDelivery}
                        >
                            <Truck className="h-4 w-4 mr-2" />
                            Process New Delivery
                        </Button>
                    </div>
                </div>
            </div>

            {/* Receipt Preview Dialog with Share to RawBT button */}
            <ReceiptPreviewDialog
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                receiptText={receiptText}
                onConfirm={handleConfirmPrint}
                title="Delivery Receipt Preview"
            />
        </>
    );
}
