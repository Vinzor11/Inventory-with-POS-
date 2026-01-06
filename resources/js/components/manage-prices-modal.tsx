import { useState, useEffect } from 'react';
import { useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/lib/toast';
import { formatCurrency } from '@/lib/format-currency';

interface Prices {
    cooked_copra: number | null;
    uncooked_copra: number | null;
    coconut: number | null;
}

interface ManagePricesModalProps {
    isOpen: boolean;
    onClose: () => void;
    prices: Prices;
    onSuccess?: () => void;
}

type PriceType = 'cooked_copra' | 'uncooked_copra' | 'coconut';

const priceTypeLabels: Record<PriceType, string> = {
    cooked_copra: 'Cooked Copra',
    uncooked_copra: 'Uncooked Copra',
    coconut: 'Coconut',
};

const priceTypeUnits: Record<PriceType, string> = {
    cooked_copra: 'per kg',
    uncooked_copra: 'per kg',
    coconut: 'per piece',
};

export function ManagePricesModal({ isOpen, onClose, prices, onSuccess }: ManagePricesModalProps) {
    const [selectedPriceType, setSelectedPriceType] = useState<PriceType>('cooked_copra');
    
    const { data, setData, put, processing, errors, reset } = useForm({
        price: '',
    });

    // Reset form when modal opens or price type changes
    useEffect(() => {
        if (isOpen) {
            const currentPrice = prices[selectedPriceType];
            setData('price', currentPrice?.toString() || '0.00');
        }
    }, [isOpen, selectedPriceType, prices, setData]);

    const handlePriceTypeChange = (value: string) => {
        const priceType = value as PriceType;
        setSelectedPriceType(priceType);
        const currentPrice = prices[priceType];
        setData('price', currentPrice?.toString() || '0.00');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/weigh-ins/prices/${selectedPriceType}`, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                // Flash message will be shown automatically
                reset();
                onClose();
                onSuccess?.();
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                if (firstError) {
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    toast.error(errorMessage);
                } else {
                    toast.error(`Failed to update ${priceTypeLabels[selectedPriceType]} price.`);
                }
            },
        });
    };

    const handleClose = () => {
        reset();
        setSelectedPriceType('cooked_copra');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Manage Weigh-In Prices</DialogTitle>
                    <DialogDescription>
                        Select a price type and update its value.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label htmlFor="price_type">Price Type *</Label>
                            <Select
                                value={selectedPriceType}
                                onValueChange={handlePriceTypeChange}
                            >
                                <SelectTrigger id="price_type">
                                    <SelectValue placeholder="Select price type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cooked_copra">Cooked Copra</SelectItem>
                                    <SelectItem value="uncooked_copra">Uncooked Copra</SelectItem>
                                    <SelectItem value="coconut">Coconut</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="price">
                                Price ({priceTypeUnits[selectedPriceType]}) (₱) *
                            </Label>
                            <Input
                                id="price"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={data.price}
                                onChange={(e) => setData('price', e.target.value)}
                                placeholder="0.00"
                                required
                            />
                            {errors.price && (
                                <p className="text-sm text-red-600 mt-1">{errors.price}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                                Current price: ₱{formatCurrency(prices[selectedPriceType] || 0)}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Updating...' : `Update ${priceTypeLabels[selectedPriceType]} Price`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

