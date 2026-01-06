import { Head, usePage } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ShoppingCart, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/format-currency';
import { printSalesReceipt, fetchSalesReceiptText } from '@/lib/receipt-print';
import { ReceiptPreviewDialog } from '@/components/receipt-preview-dialog';
import { useState } from 'react';

interface User {
    id: number;
    name: string;
    email: string;
}

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
    size: string | null;
    thickness: string | null;
    diameter: string | null;
    length: string | null;
    product: Product;
}

interface SaleItem {
    id: number;
    quantity: number;
    unit_price: number;
    line_total: number;
    product_variant: ProductVariant;
}

interface Payment {
    id: number;
    amount: number;
    payment_method: 'cash' | 'gcash' | 'cheque' | 'credit';
    received_at: string;
    notes: string | null;
    received_by: User;
}

interface Sale {
    id: number;
    sale_number: string;
    status: string;
    payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded' | 'partially_refunded';
    subtotal: number;
    total: number;
    notes: string | null;
    created_at: string;
    cashier: User;
    items: SaleItem[];
    payments: Payment[];
    is_for_delivery?: boolean;
    delivery_name?: string | null;
    delivery_address?: string | null;
    delivery_contact?: string | null;
    delivery_notes?: string | null;
}

interface CheckoutSuccessProps {
    sale: Sale;
    paymentSummary: {
        total_paid: number;
        balance: number;
        change: number;
    };
}

export default function CheckoutSuccess({ sale, paymentSummary }: CheckoutSuccessProps) {
    const { name: storeName } = usePage().props as { name?: string };
    const storeDisplayName = storeName || 'STORE NAME';
    const [isPrinting, setIsPrinting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [receiptText, setReceiptText] = useState<string>('');
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    
    const handleNewOrder = () => {
        router.visit('/pos');
    };

    const handlePrintClick = async () => {
        setIsLoadingPreview(true);
        try {
            const text = await fetchSalesReceiptText(sale.id, 80);
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
        await printSalesReceipt(sale.id, { width: 80 });
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
        return `${month}/${day}/${year}  ${displayHours}:${minutes} ${ampm}`;
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
            <Head title={`Sale ${sale.sale_number}`} />
            
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
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Sale Completed!</h1>
                        <p className="text-slate-600">Your transaction has been processed successfully.</p>
                    </div>

                    {/* Sale Details */}
                    <div className="border-t border-b border-slate-200 py-6 mb-6">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="text-sm text-slate-500">Sale Number</p>
                                <p className="text-lg font-semibold text-slate-900">{sale.sale_number}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Date & Time</p>
                                <p className="text-lg font-semibold text-slate-900">
                                    {new Date(sale.created_at).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Cashier</p>
                                <p className="text-lg font-semibold text-slate-900">{sale.cashier.name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Payment Status</p>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                    sale.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                                    sale.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                    sale.payment_status === 'refunded' ? 'bg-red-100 text-red-700' :
                                    sale.payment_status === 'partially_refunded' ? 'bg-orange-100 text-orange-700' :
                                    'bg-gray-100 text-gray-700'
                                }`}>
                                    {sale.payment_status === 'paid' ? 'Fully Paid' :
                                     sale.payment_status === 'partial' ? 'Partially Paid' :
                                     sale.payment_status === 'refunded' ? 'Refunded' :
                                     sale.payment_status === 'partially_refunded' ? 'Partially Refunded' :
                                     'Unpaid'}
                                </span>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Order Type</p>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                    (sale as any).is_for_delivery ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                    {(sale as any).is_for_delivery ? 'For Delivery' : 'Pickup'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Items</h2>
                        <div className="space-y-3">
                            {sale.items.map((item) => {
                                const variant = item.product_variant;
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
                                    ? variantParts.join(' × ')
                                    : variant.description || null;
                                
                                return (
                                    <div key={item.id} className="flex justify-between items-start py-2 border-b border-slate-100">
                                        <div className="flex-1">
                                            <p className="font-medium text-slate-900">
                                                {item.product_variant.product.name}
                                            </p>
                                            {variantDetail && (
                                                <p className="text-sm text-slate-500 mt-1">
                                                    {variantDetail}
                                                </p>
                                            )}
                                            <p className="text-sm text-slate-600 mt-1">
                                                {item.quantity} × ₱{formatCurrency(item.unit_price)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-slate-900">
                                                ₱{formatCurrency(item.line_total)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="border-t border-slate-200 pt-4 mb-6">
                        <div className="flex justify-between text-lg mb-2">
                            <span className="text-slate-600">Subtotal</span>
                            <span className="font-semibold text-slate-900">₱{formatCurrency(sale.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-2xl font-bold pt-2 border-t border-slate-200">
                            <span className="text-slate-900">Total</span>
                            <span className="text-slate-900">₱{formatCurrency(sale.total)}</span>
                        </div>
                    </div>

                    {/* Payment Summary */}
                    <div className="border-t border-slate-200 pt-4 mb-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment Summary</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Sale Total</span>
                                <span className="font-semibold text-slate-900">
                                    ₱{formatCurrency(sale.total)}
                                </span>
                            </div>
                            {paymentSummary.total_paid > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Amount Paid</span>
                                    <span className="font-semibold text-green-600">
                                        ₱{formatCurrency(paymentSummary.total_paid)}
                                    </span>
                                </div>
                            )}
                            {paymentSummary.change > 0 && (
                                <div className="flex justify-between text-lg bg-green-50 p-3 rounded-lg border border-green-200">
                                    <span className="text-green-800 font-medium">Change Due</span>
                                    <span className="text-green-800 font-bold">
                                        ₱{formatCurrency(paymentSummary.change)}
                                    </span>
                                </div>
                            )}
                            {paymentSummary.balance > 0 && (
                                <div className="flex justify-between text-lg">
                                    <span className="text-orange-600 font-medium">
                                        {paymentSummary.total_paid > 0 ? 'Balance Remaining' : 'Payment Due'}
                                    </span>
                                    <span className="text-orange-600 font-bold">
                                        ₱{formatCurrency(paymentSummary.balance)}
                                    </span>
                                </div>
                            )}
                            {paymentSummary.total_paid === sale.total && paymentSummary.total_paid > 0 && (
                                <div className="flex justify-between text-lg">
                                    <span className="text-green-600 font-medium">Payment Complete</span>
                                    <span className="text-green-600 font-bold">No change needed</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payment Details */}
                    {sale.payments && sale.payments.length > 0 && (
                        <div className="border-t border-slate-200 pt-4 mb-6">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment Details</h2>
                            <div className="space-y-3">
                                {sale.payments.map((payment) => (
                                    <div key={payment.id} className="bg-slate-50 rounded-lg p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-medium text-slate-900">
                                                    {payment.payment_method.charAt(0).toUpperCase() + payment.payment_method.slice(1)}
                                                </p>
                                                <p className="text-sm text-slate-500">
                                                    {new Date(payment.received_at).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-green-600">
                                                    ₱{formatCurrency(payment.amount)}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    by {payment.received_by.name}
                                                </p>
                                            </div>
                                        </div>
                                        {payment.notes && (
                                            <p className="text-sm text-slate-600 mt-2 italic">
                                                "{payment.notes}"
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {sale.notes && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                            <p className="text-sm text-slate-500 mb-1">Notes</p>
                            <p className="text-slate-900">{sale.notes}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        {/* Only show print button if sale is not refunded or voided */}
                        {(sale.status !== 'REFUNDED' && sale.status !== 'VOIDED' && sale.payment_status !== 'refunded') && (
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handlePrintClick}
                                disabled={isLoadingPreview || isPrinting}
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                {isLoadingPreview ? 'Loading Preview...' : isPrinting ? 'Printing...' : 'Print Receipt'}
                            </Button>
                        )}
                        <Button
                            className={`${(sale.status === 'REFUNDED' || sale.status === 'VOIDED' || sale.payment_status === 'refunded') ? 'flex-1' : 'flex-1'} bg-blue-600 hover:bg-blue-700`}
                            onClick={handleNewOrder}
                        >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            New Sale
                        </Button>
                    </div>
                </div>
            </div>

            {/* Receipt Preview Dialog */}
            <ReceiptPreviewDialog
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                receiptText={receiptText}
                onConfirm={handleConfirmPrint}
                title="Sales Receipt Preview"
            />
        </>
    );
}
