import { useState } from 'react';
import { useForm, router } from '@inertiajs/react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, AlertCircle } from 'lucide-react';
import { toast } from '@/lib/toast';

interface AddPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    saleId: number;
    balance: number;
    totalPaid: number;
    isAdmin: boolean;
}

export function AddPaymentModal({ isOpen, onClose, saleId, balance, totalPaid, isAdmin }: AddPaymentModalProps) {
    const [isRefund, setIsRefund] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        amount: '',
        payment_method: 'cash',
        notes: '',
    });

    const handleClose = () => {
        reset();
        setIsRefund(false);
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Convert amount to number (handle negative input for refunds)
        const inputAmount = parseFloat(data.amount);
        const absoluteAmount = Math.abs(inputAmount);
        
        // Validate amount
        if (!absoluteAmount || absoluteAmount === 0 || isNaN(absoluteAmount)) {
            toast.error('Please enter a valid payment amount');
            return;
        }

        // Debug: Log the refund state
        console.log('Refund state:', isRefund, 'Amount:', absoluteAmount, 'Total Paid:', totalPaid, 'Balance:', balance);

        // Validate payment limits based on refund status - check refund FIRST
        if (isRefund === true) {
            // Refund validation: cannot exceed total paid
            if (absoluteAmount > totalPaid) {
                toast.error(`Refund cannot exceed total paid of $${totalPaid.toFixed(2)}`);
                return;
            }
            // For refunds, make amount negative
            const finalAmount = -absoluteAmount;
            
            // Use router.post directly to ensure negative amount is sent
            router.post(`/sales/${saleId}/payments`, {
                amount: finalAmount,
                payment_method: data.payment_method,
                notes: data.notes,
            }, {
                onSuccess: () => {
                    // Flash message will be shown automatically
                    handleClose();
                },
                onError: (errors) => {
                    const firstError = Object.values(errors)[0];
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    toast.error(errorMessage || 'Failed to record refund');
                },
            });
            return;
        }

        // Payment validation: cannot exceed remaining balance
        if (absoluteAmount > balance) {
            toast.error(`Payment cannot exceed remaining balance of $${balance.toFixed(2)}`);
            return;
        }

        // For payments, keep positive
        const finalAmount = absoluteAmount;

        post(`/sales/${saleId}/payments`, {
            amount: finalAmount,
            payment_method: data.payment_method,
            notes: data.notes,
            onSuccess: () => {
                // Flash message will be shown automatically
                handleClose();
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                toast.error(errorMessage || 'Failed to record payment');
            },
        });
    };

    const maxAmount = isRefund ? totalPaid : balance;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isRefund ? 'Record Refund' : 'Add Payment'}</DialogTitle>
                    <DialogDescription>
                        {isRefund 
                            ? 'Record a refund for this sale. Refunds are recorded as negative payments.'
                            : 'Record a payment received for this sale. Partial payments are supported.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Payment Type Toggle (Admin only) */}
                    {isAdmin && (
                        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                            <Label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isRefund}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        console.log('Checkbox changed to:', checked);
                                        setIsRefund(checked);
                                    }}
                                    className="rounded"
                                />
                                <span className="text-sm font-medium">
                                    This is a refund {isRefund && '(✓ Active)'}
                                </span>
                            </Label>
                        </div>
                    )}

                    {/* Amount */}
                    <div className="space-y-2">
                        <Label htmlFor="amount">
                            {isRefund ? 'Refund Amount' : 'Payment Amount'} *
                        </Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={maxAmount}
                                placeholder="0.00"
                                value={data.amount}
                                onChange={(e) => {
                                    // Only allow positive numbers (sign is handled by refund checkbox)
                                    const value = e.target.value.replace(/[^0-9.]/g, '');
                                    if (value === '' || parseFloat(value) >= 0) {
                                        setData('amount', value);
                                    }
                                }}
                                className="pl-10"
                                required
                            />
                        </div>
                        {errors.amount && (
                            <p className="text-sm text-destructive">{errors.amount}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <AlertCircle className="h-3 w-3" />
                            <span>
                                Maximum: ${maxAmount.toFixed(2)} 
                                {isRefund ? ' (total paid)' : ' (remaining balance)'}
                            </span>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                        <Label htmlFor="payment_method">Payment Method *</Label>
                        <Select
                            value={data.payment_method}
                            onValueChange={(value) => setData('payment_method', value)}
                        >
                            <SelectTrigger id="payment_method">
                                <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="gcash">GCash</SelectItem>
                                <SelectItem value="cheque">Cheque</SelectItem>
                                <SelectItem value="credit">Credit</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.payment_method && (
                            <p className="text-sm text-destructive">{errors.payment_method}</p>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Add notes about this payment..."
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                            rows={3}
                        />
                        {errors.notes && (
                            <p className="text-sm text-destructive">{errors.notes}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={processing}
                            className={isRefund ? 'bg-orange-600 hover:bg-orange-700' : ''}
                        >
                            {processing ? 'Processing...' : isRefund ? 'Record Refund' : 'Record Payment'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

