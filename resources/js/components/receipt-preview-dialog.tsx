import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';

interface ReceiptPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    receiptText: string;
    onConfirm: () => Promise<void>;
    title?: string;
}

export function ReceiptPreviewDialog({
    isOpen,
    onClose,
    receiptText,
    onConfirm,
    title = 'Receipt Preview',
}: ReceiptPreviewDialogProps) {
    const [isPrinting, setIsPrinting] = useState(false);

    const handleConfirm = async () => {
        setIsPrinting(true);
        try {
            await onConfirm();
            onClose();
        } catch (error) {
            console.error('Print failed:', error);
            alert('Failed to print receipt. Please try again or contact support.');
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Review the receipt before printing. Click "Print" to send to printer or "Cancel" to close.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto border rounded-lg bg-slate-50 p-4 my-4">
                    <div className="font-mono text-xs whitespace-pre break-words" style={{ maxWidth: '80mm', margin: '0 auto' }}>
                        {receiptText.split('\n').map((line, index) => {
                            // Check if this line contains the store name (JOSHUA TRADING)
                            const trimmedLine = line.trim();
                            if (trimmedLine === 'JOSHUA TRADING') {
                                // Center it properly using CSS, ignoring original padding (which was for double-size)
                                return (
                                    <div key={index} className="font-bold text-base mb-1 w-full text-center" style={{ 
                                        letterSpacing: '0.5px',
                                        display: 'block'
                                    }}>
                                        {trimmedLine}
                                    </div>
                                );
                            }
                            return <div key={index} className="whitespace-pre">{line || '\u00A0'}</div>;
                        })}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isPrinting}
                    >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isPrinting}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <Printer className="h-4 w-4 mr-2" />
                        {isPrinting ? 'Printing...' : 'Print'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

