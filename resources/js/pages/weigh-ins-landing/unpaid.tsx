import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, CreditCard, Check, X, Scale } from 'lucide-react';
import { formatCurrency } from '@/lib/format-currency';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { toast } from '@/lib/toast';
import { MobileRecordCard, MobileRecordRow } from '@/components/mobile/record-card';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Weigh-Ins',
        href: '/weigh-ins-landing',
    },
    {
        title: 'Unpaid Weigh-Ins',
        href: '/weigh-ins-landing/unpaid',
    },
];

interface User {
    id: number;
    name: string;
}

interface WeighIn {
    id: number;
    type: string;
    weight_kg: number | null;
    count: number | null;
    unit_price: number;
    total_amount: number;
    status: 'unpaid' | 'paid';
}

interface WeighInTransaction {
    id: number;
    ref_num: string;
    total_amount: number;
    status: 'unpaid' | 'paid';
    weighed_at: string;
    notes: string | null;
    weighed_by: User | null;
    paid_by: User | null;
    paid_at: string | null;
    weigh_ins: WeighIn[];
}

interface UnpaidWeighInsProps {
    transactions: WeighInTransaction[];
}

export default function UnpaidWeighIns({ transactions }: UnpaidWeighInsProps) {
    const [selectedTransaction, setSelectedTransaction] = useState<WeighInTransaction | null>(null);
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const { post, processing } = useForm({});

    const handleMarkAsPaid = (transaction: WeighInTransaction) => {
        setSelectedTransaction(transaction);
        setIsPinDialogOpen(true);
        setPin('');
        setPinError('');
    };

    const handlePinSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (isProcessing || processing) {
            return;
        }

        if (!pin) {
            setPinError('PIN is required');
            return;
        }

        if (!selectedTransaction) {
            return;
        }

        setIsProcessing(true);
        setPinError('');

        post(`/weigh-ins-landing/${selectedTransaction.id}/mark-as-paid`, {
            pin,
            preserveScroll: true,
            onSuccess: () => {
                setIsProcessing(false);
                setIsPinDialogOpen(false);
                setPin('');
                setSelectedTransaction(null);
                toast.success('Weigh-in transaction marked as paid successfully.');
            },
            onError: (errors) => {
                setIsProcessing(false);
                if (errors.pin) {
                    const pinError = Array.isArray(errors.pin) ? errors.pin[0] : errors.pin;
                    setPinError(pinError);
                } else {
                    const firstError = Object.values(errors)[0];
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    setPinError(errorMessage || 'Failed to mark as paid. Please try again.');
                }
            },
        });
    };

    const formatWeighInType = (type: string): string => {
        return type
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Unpaid Weigh-Ins" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="hidden text-2xl font-bold md:block">Unpaid Weigh-Ins</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            View and mark unpaid weigh-in transactions as paid
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => router.visit('/weigh-ins-landing')}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Weigh-Ins
                    </Button>
                </div>

                {transactions.length > 0 ? (
                    <div className="rounded-lg border">
                        <div className="space-y-3 p-4 md:hidden">
                            {transactions.map((transaction) => (
                                <MobileRecordCard
                                    key={transaction.id}
                                    title={transaction.ref_num}
                                    subtitle={transaction.weighed_by?.name || 'N/A'}
                                    value={formatCurrency(transaction.total_amount)}
                                    badges={[{ label: 'Unpaid', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' }]}
                                    footer={
                                        <Button
                                            type="button"
                                            className="h-11 w-full bg-green-600 hover:bg-green-700"
                                            onClick={() => handleMarkAsPaid(transaction)}
                                        >
                                            <Check className="mr-1 h-4 w-4" />
                                            Mark as Paid
                                        </Button>
                                    }
                                >
                                    <MobileRecordRow label="Weighed At" value={formatDate(transaction.weighed_at)} />
                                    <MobileRecordRow label="Items" value={`${transaction.weigh_ins.length}`} />
                                </MobileRecordCard>
                            ))}
                        </div>

                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="px-4 py-3 text-left text-sm font-medium">Ref Number</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium">Weighed At</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium">Weighed By</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium">Items</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium">Total Amount</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((transaction) => (
                                        <tr key={transaction.id} className="border-b hover:bg-accent">
                                            <td className="px-4 py-3 text-sm font-medium">{transaction.ref_num}</td>
                                            <td className="px-4 py-3 text-sm">{formatDate(transaction.weighed_at)}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {transaction.weighed_by?.name || 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="space-y-1">
                                                    {transaction.weigh_ins.map((weighIn) => (
                                                        <div key={weighIn.id} className="text-xs">
                                                            {formatWeighInType(weighIn.type)}: {' '}
                                                            {weighIn.count !== null
                                                                ? `${weighIn.count} pcs`
                                                                : `${weighIn.weight_kg ? Number(weighIn.weight_kg).toFixed(2) : '0.00'} kg`}
                                                            {' '}@ {formatCurrency(weighIn.unit_price)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-medium">
                                                {formatCurrency(transaction.total_amount)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    onClick={() => handleMarkAsPaid(transaction)}
                                                    className="bg-green-600 hover:bg-green-700"
                                                >
                                                    <Check className="h-4 w-4 mr-1" />
                                                    Mark as Paid
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <Scale className="h-16 w-16 mb-4 opacity-50" />
                        <p className="text-lg">No unpaid weigh-ins</p>
                        <p className="text-sm">All weigh-in transactions have been paid</p>
                    </div>
                )}

                {/* PIN Dialog */}
                <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Mark as Paid</DialogTitle>
                            <DialogDescription>
                                Enter your PIN to mark this weigh-in transaction as paid.
                                {selectedTransaction && (
                                    <div className="mt-2 p-2 bg-slate-50 rounded text-sm">
                                        <div className="font-medium">Ref: {selectedTransaction.ref_num}</div>
                                        <div>Amount: {formatCurrency(selectedTransaction.total_amount)}</div>
                                    </div>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">
                                    PIN
                                </label>
                                <Input
                                    type="password"
                                    placeholder="Enter PIN"
                                    value={pin}
                                    onChange={(e) => {
                                        setPin(e.target.value);
                                        setPinError('');
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handlePinSubmit(e);
                                        }
                                    }}
                                    className={pinError ? 'border-red-500' : ''}
                                    autoFocus
                                />
                                {pinError && (
                                    <p className="text-sm text-red-600 mt-2">{pinError}</p>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsPinDialogOpen(false);
                                    setPin('');
                                    setPinError('');
                                    setSelectedTransaction(null);
                                }}
                                disabled={isProcessing || processing}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handlePinSubmit}
                                disabled={isProcessing || processing || !pin}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isProcessing || processing ? 'Processing...' : 'Mark as Paid'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}


