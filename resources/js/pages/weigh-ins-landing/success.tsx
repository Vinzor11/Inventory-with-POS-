import { Head, usePage } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Scale, Printer, Share2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format-currency';
import { useState, useEffect } from 'react';
import { fetchWeighInReceiptText, shareReceipt, canShare } from '@/lib/receipt-print';

interface User {
    id: number;
    name: string;
    email: string;
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
    weighed_at: string;
    weighed_by: User;
    notes: string | null;
}

interface WeighInTransaction {
    id: number;
    ref_num: string;
    weighed_by: User;
    weighed_at: string;
    total_amount: number;
    status: 'unpaid' | 'paid';
    notes: string | null;
    weigh_ins: WeighIn[];
}

interface WeighInSuccessProps {
    transaction?: WeighInTransaction;
    weighIn?: WeighIn;
}

export default function WeighInSuccess({ transaction, weighIn }: WeighInSuccessProps) {
    const { name: storeName } = usePage().props as { name?: string };
    const storeDisplayName = storeName || 'STORE NAME';
    
    // Printing state
    const [isPrinting, setIsPrinting] = useState(false);
    const [showShareButton, setShowShareButton] = useState(false);

    useEffect(() => {
        setShowShareButton(canShare());
    }, []);
    
    // Determine if we're showing a transaction or single weigh-in
    const isTransaction = !!transaction;
    const displayData = transaction || (weighIn ? { 
        id: 0, // Will use weighIn.id for single weigh-in
        ref_num: weighIn.ref_num,
        weighed_by: weighIn.weighed_by,
        weighed_at: weighIn.weighed_at,
        total_amount: weighIn.total_amount,
        status: weighIn.status,
        notes: weighIn.notes,
        weigh_ins: [weighIn]
    } : null);

    if (!displayData) {
        return null;
    }

    // Get the transaction ID for printing
    const transactionId = transaction?.id || 0;
    
    const handleNewWeighIn = () => {
        router.visit('/weigh-ins-landing');
    };

    const handlePrintClick = async () => {
        if (!transactionId) {
            // Fallback to window.print for single weigh-in without transaction
            window.print();
            return;
        }
        
        setIsPrinting(true);
        try {
            const text = await fetchWeighInReceiptText(transactionId);
            // Auto-share to RawBT if available
            if (canShare()) {
                await shareReceipt(text);
            } else {
                // Fallback to window.print
                window.print();
            }
        } catch (error) {
            console.error('Failed to print receipt:', error);
            window.print();
        } finally {
            setIsPrinting(false);
        }
    };

    const handleShareClick = async () => {
        if (!transactionId) return;
        
        setIsPrinting(true);
        try {
            const text = await fetchWeighInReceiptText(transactionId);
            await shareReceipt(text);
        } catch (error) {
            console.error('Share failed:', error);
        } finally {
            setIsPrinting(false);
        }
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

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'cooked_copra':
                return 'Cooked Copra';
            case 'uncooked_copra':
                return 'Uncooked Copra';
            case 'coconut':
                return 'Coconut';
            default:
                return type;
        }
    };

    const totalItems = displayData.weigh_ins.length;

    // Calculate total kgs (sum of all weight_kg, excluding coconut which uses count)
    const totalKgs = displayData.weigh_ins
        .filter(item => item.type !== 'coconut')
        .reduce((sum, item) => sum + (Number(item.weight_kg) || 0), 0);

    // Calculate total counted goods (coconut items)
    const totalCounted = displayData.weigh_ins
        .filter(item => item.type === 'coconut')
        .reduce((sum, item) => sum + (Number(item.count) || 0), 0);

    // Group items by type
    const groupedItems = displayData.weigh_ins.reduce((acc, item) => {
        if (!acc[item.type]) {
            acc[item.type] = {
                type: item.type,
                unitPrice: item.unit_price,
                items: [],
                totalAmount: 0,
                totalWeight: 0,
                totalCount: 0,
            };
        }
        acc[item.type].items.push(item);
        if (item.type === 'coconut') {
            acc[item.type].totalCount += Number(item.count) || 0;
        } else {
            acc[item.type].totalWeight += Number(item.weight_kg) || 0;
        }
        return acc;
    }, {} as Record<string, {
        type: string;
        unitPrice: number;
        items: WeighIn[];
        totalAmount: number;
        totalWeight: number;
        totalCount: number;
    }>);

    // Recalculate totalAmount based on total quantity × unit price
    Object.values(groupedItems).forEach((group) => {
        if (group.type === 'coconut') {
            group.totalAmount = (group.totalCount || 0) * (group.unitPrice || 0);
        } else {
            group.totalAmount = (group.totalWeight || 0) * (group.unitPrice || 0);
        }
    });

    return (
        <>
            <Head title={`Weigh-In ${displayData.ref_num}`}>
                <style>{`
                    @media print {
                        @page {
                            size: 80mm auto;
                            margin: 0;
                            padding: 0;
                        }
                        
                        body {
                            margin: 0;
                            padding: 0;
                        }
                        
                        body * {
                            visibility: hidden;
                        }
                        
                        .receipt-container,
                        .receipt-container * {
                            visibility: visible;
                        }
                        
                        .receipt-container {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 80mm;
                            max-width: 80mm;
                            padding: 0 5mm;
                            background: white;
                            font-family: 'Courier New', monospace;
                            font-size: 9pt;
                            line-height: 1.4;
                            color: #000;
                        }
                        
                        .no-print {
                            display: none !important;
                        }
                        
                        .receipt-store-name {
                            text-align: center;
                            font-size: 16pt;
                            font-weight: bold;
                            margin-bottom: 6px;
                            letter-spacing: 0.5px;
                        }
                        
                        .receipt-title {
                            text-align: center;
                            font-size: 12pt;
                            font-weight: bold;
                            margin-bottom: 8px;
                            letter-spacing: 1px;
                        }
                        
                        .receipt-disclaimer {
                            text-align: center;
                            font-weight: bold;
                            font-size: 8pt;
                            border: 2px solid #000;
                            padding: 4px 6px;
                            margin: 8px 0;
                            background: #fff;
                        }
                        
                        .receipt-info {
                            text-align: center;
                            font-size: 8pt;
                            margin-bottom: 8px;
                            padding-bottom: 6px;
                            border-bottom: 1px dashed #000;
                        }
                        
                        .receipt-info-line {
                            margin: 2px 0;
                        }
                        
                        .receipt-items-table {
                            width: 100%;
                            margin: 8px 0;
                            border-collapse: collapse;
                            font-size: 8pt;
                        }
                        
                        .receipt-items-table thead {
                            border-bottom: 1px dashed #000;
                            padding-bottom: 4px;
                        }
                        
                        .receipt-items-table th {
                            text-align: left;
                            font-weight: bold;
                            padding: 4px 0;
                            font-size: 8pt;
                        }
                        
                        .receipt-items-table th.price-col,
                        .receipt-items-table td.price-col {
                            text-align: right;
                        }
                        
                        .receipt-items-table tbody tr {
                            border-bottom: 1px dashed #ccc;
                        }
                        
                        .receipt-items-table td {
                            padding: 4px 0;
                            vertical-align: top;
                        }
                        
                        .item-name {
                            font-weight: bold;
                            margin-bottom: 2px;
                        }
                        
                        .item-description {
                            font-size: 7pt;
                            color: #000;
                            margin: 2px 0;
                            font-style: italic;
                        }
                        
                        .receipt-totals {
                            margin: 8px 0;
                            padding-top: 6px;
                            border-top: 1px dashed #000;
                        }
                        
                        .receipt-totals-row {
                            display: flex;
                            justify-content: space-between;
                            margin: 3px 0;
                            font-size: 8pt;
                        }
                        
                        .receipt-total-final {
                            display: flex;
                            justify-content: space-between;
                            margin-top: 6px;
                            padding-top: 6px;
                            border-top: 2px solid #000;
                            font-size: 11pt;
                            font-weight: bold;
                        }
                        
                        .receipt-footer {
                            text-align: center;
                            margin-top: 12px;
                            padding-top: 8px;
                            border-top: 1px dashed #000;
                            font-size: 7pt;
                        }
                        
                        .receipt-footer p {
                            margin: 3px 0;
                        }
                    }
                    
                    @media screen {
                        .receipt-container {
                            display: none;
                        }
                    }
                `}</style>
            </Head>
            
            {/* Printable Receipt - 80mm format (fallback for window.print) */}
            <div className="receipt-container">
                {/* Store Name */}
                <div className="receipt-store-name">
                    {storeDisplayName}
                </div>
                
                {/* Receipt Title */}
                <div className="receipt-title">
                    WEIGH-IN RECEIPT
                </div>
                
                {/* Disclaimer */}
                <div className="receipt-disclaimer">
                    THIS DOCUMENT IS NOT AN OFFICIAL RECEIPT
                </div>
                
                {/* Receipt Info */}
                <div className="receipt-info">
                    <div className="receipt-info-line">
                        <strong>Reference #:</strong> {displayData.ref_num}
                    </div>
                    <div className="receipt-info-line">
                        <strong>Transaction Time:</strong> {formatTransactionTime(displayData.weighed_at)}
                    </div>
                    <div className="receipt-info-line">
                        <strong>Weighed by:</strong> {displayData.weighed_by.name}
                    </div>
                </div>

                {/* Items Table */}
                {isTransaction && displayData.weigh_ins.length > 1 ? (
                    <div style={{ margin: '8px 0' }}>
                        {Object.values(groupedItems).map((group) => (
                            <div key={group.type} style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px dashed #ccc' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '9pt' }}>
                                    {getTypeLabel(group.type)}
                                </div>
                                <div style={{ marginLeft: '8px', marginBottom: '4px' }}>
                                    {group.items.map((item) => (
                                        <div key={item.id} style={{ fontSize: '8pt', marginBottom: '2px' }}>
                                            {item.type === 'coconut' 
                                                ? `${item.count || 0} pcs`
                                                : `${(Number(item.weight_kg) || 0).toFixed(2)} kg`}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', marginTop: '4px' }}>
                                    <span>Unit Price: ₱{formatCurrency(group.unitPrice)}</span>
                                    <span style={{ fontWeight: 'bold' }}>₱{formatCurrency(group.totalAmount)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ margin: '8px 0', paddingTop: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '8pt' }}>
                            <span><strong>Type:</strong></span>
                            <span>{getTypeLabel(displayData.weigh_ins[0].type)}</span>
                        </div>
                        {displayData.weigh_ins[0].type === 'coconut' ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '8pt' }}>
                                <span><strong>Quantity:</strong></span>
                                <span>{displayData.weigh_ins[0].count} pcs</span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '8pt' }}>
                                <span><strong>Weight:</strong></span>
                                <span>{displayData.weigh_ins[0].weight_kg ? Number(displayData.weigh_ins[0].weight_kg).toFixed(2) : '0.00'} kg</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '8pt' }}>
                            <span><strong>Unit Price:</strong></span>
                            <span>₱{formatCurrency(displayData.weigh_ins[0].unit_price)} {displayData.weigh_ins[0].type === 'coconut' ? '/pc' : '/kg'}</span>
                        </div>
                    </div>
                )}

                {/* Summary */}
                <div className="receipt-totals" style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed #000' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '9pt' }}>Summary:</div>
                    <div className="receipt-totals-row">
                        <span>- Items:</span>
                        <span>{totalItems}</span>
                    </div>
                    {totalKgs > 0 && (
                        <div className="receipt-totals-row">
                            <span>- Weighed Goods:</span>
                            <span>{totalKgs.toFixed(2)} kg</span>
                        </div>
                    )}
                    {totalCounted > 0 && (
                        <div className="receipt-totals-row">
                            <span>- Counted Goods:</span>
                            <span>{totalCounted} pcs</span>
                        </div>
                    )}
                    <div className="receipt-total-final" style={{ marginTop: '8px' }}>
                        <span>TOTAL:</span>
                        <span>₱{formatCurrency(displayData.total_amount)}</span>
                    </div>
                </div>

                {/* Notes */}
                {displayData.notes && (
                    <div style={{ margin: '8px 0', paddingTop: '6px', borderTop: '1px dashed #000', fontSize: '8pt' }}>
                        <div style={{ fontStyle: 'italic' }}>
                            <strong>Notes:</strong> {displayData.notes}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="receipt-footer">
                    <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>Transaction processed successfully!</p>
                    <p>{formatDateTime(new Date().toISOString())}</p>
                    <p style={{ marginTop: '4px', fontStyle: 'italic' }}>System-generated receipt</p>
                    <p style={{ marginTop: '4px', fontWeight: 'bold' }}>PRINTED</p>
                </div>
            </div>

            {/* Screen View */}
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 no-print">
                <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
                    {/* Success Header */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <div className="rounded-full bg-green-100 p-4">
                                <CheckCircle2 className="h-12 w-12 text-green-600" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">
                            {isTransaction ? 'Transaction Processed!' : 'Payment Processed!'}
                        </h1>
                        <p className="text-slate-600">
                            {isTransaction 
                                ? 'Your weigh-in transaction has been processed successfully.'
                                : 'Weigh-in payment has been processed successfully.'}
                        </p>
                    </div>

                    {/* Transaction/Weigh-In Details */}
                    <div className="border-t border-b border-slate-200 py-6 mb-6">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="text-sm text-slate-500">Reference Number</p>
                                <p className="text-lg font-semibold text-slate-900">{displayData.ref_num}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Weighed Date & Time</p>
                                <p className="text-lg font-semibold text-slate-900">
                                    {new Date(displayData.weighed_at).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Weighed By</p>
                                <p className="text-lg font-semibold text-slate-900">{displayData.weighed_by.name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Status</p>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                    displayData.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                    {displayData.status === 'paid' ? 'Paid' : 'Unpaid'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">
                            {isTransaction ? 'Weigh-In Items' : 'Weigh-In Details'}
                        </h2>
                        <div className="space-y-4">
                            {isTransaction && displayData.weigh_ins.length > 1 ? (
                                Object.values(groupedItems).map((group) => (
                                    <div key={group.type} className="border-b border-slate-200 pb-4">
                                        <p className="font-bold text-slate-900 mb-2">
                                            {getTypeLabel(group.type)}
                                        </p>
                                        <div className="ml-4 mb-2 space-y-1">
                                            {group.items.map((item) => (
                                                <p key={item.id} className="text-sm text-slate-600">
                                                    {item.type === 'coconut' 
                                                        ? `${item.count || 0} pcs`
                                                        : `${(Number(item.weight_kg) || 0).toFixed(2)} kg`}
                                                </p>
                                            ))}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-600">
                                                Unit Price: ₱{formatCurrency(group.unitPrice)}
                                            </span>
                                            <span className="font-bold text-slate-900">
                                                ₱{formatCurrency(group.totalAmount)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex justify-between items-start py-2 border-b border-slate-100">
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-900">
                                            {getTypeLabel(displayData.weigh_ins[0].type)}
                                        </p>
                                        {displayData.weigh_ins[0].type === 'coconut' ? (
                                            <p className="text-sm text-slate-600 mt-1">
                                                {displayData.weigh_ins[0].count} pcs × ₱{formatCurrency(displayData.weigh_ins[0].unit_price)}/pc
                                            </p>
                                        ) : (
                                            <p className="text-sm text-slate-600 mt-1">
                                                {displayData.weigh_ins[0].weight_kg ? Number(displayData.weigh_ins[0].weight_kg).toFixed(2) : '0.00'} kg × ₱{formatCurrency(displayData.weigh_ins[0].unit_price)}/kg
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-slate-900">
                                            ₱{formatCurrency(displayData.weigh_ins[0].total_amount)}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="border-t border-slate-200 pt-4 mb-6">
                        <h3 className="font-bold text-slate-900 mb-3">Summary:</h3>
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between">
                                <span className="text-slate-600">- Items:</span>
                                <span className="font-semibold text-slate-900">{totalItems}</span>
                            </div>
                            {totalKgs > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">- Weighed Goods:</span>
                                    <span className="font-semibold text-slate-900">{totalKgs.toFixed(2)} kg</span>
                                </div>
                            )}
                            {totalCounted > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">- Counted Goods:</span>
                                    <span className="font-semibold text-slate-900">{totalCounted} pcs</span>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between text-2xl font-bold pt-2 border-t border-slate-200">
                            <span className="text-slate-900">TOTAL:</span>
                            <span className="text-slate-900">₱{formatCurrency(displayData.total_amount)}</span>
                        </div>
                    </div>

                    {/* Notes */}
                    {displayData.notes && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                            <p className="text-sm text-slate-500 mb-1">Notes</p>
                            <p className="text-slate-900">{displayData.notes}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        {showShareButton && (
                            <Button
                                variant="outline"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white border-green-600"
                                onClick={handleShareClick}
                                disabled={isPrinting}
                            >
                                <Share2 className="h-4 w-4 mr-2" />
                                {isPrinting ? 'Printing...' : 'Print (RawBT)'}
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={handlePrintClick}
                            disabled={isPrinting}
                        >
                            <Printer className="h-4 w-4 mr-2" />
                            {isPrinting ? 'Printing...' : 'Print'}
                        </Button>
                        <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                            onClick={handleNewWeighIn}
                        >
                            <Scale className="h-4 w-4 mr-2" />
                            {isTransaction ? 'New Transaction' : 'New Payment'}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
