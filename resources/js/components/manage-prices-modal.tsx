import { useState, useEffect, useMemo } from 'react';
import { useForm } from '@inertiajs/react';
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
    [key: string]: number | null;
}

interface ManagePricesModalProps {
    isOpen: boolean;
    onClose: () => void;
    prices: Prices;
    canEdit: boolean;
    onSuccess?: () => void;
}

const KNOWN_PRICE_ORDER = ['cooked_copra', 'uncooked_copra', 'bagol', 'coconut'];

const toLabel = (type: string) => {
    const known: Record<string, string> = {
        cooked_copra: 'Cooked Copra',
        uncooked_copra: 'Uncooked Copra',
        coconut: 'Coconut',
        bagol: 'Bagol',
    };

    return known[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase());
};

const toUnit = (type: string) => (type === 'coconut' ? 'per piece' : 'per kg');

export function ManagePricesModal({
    isOpen,
    onClose,
    prices,
    canEdit,
    onSuccess,
}: ManagePricesModalProps) {
    const priceTypes = useMemo(() => {
        const keys = Object.keys(prices);
        const ordered = KNOWN_PRICE_ORDER.filter((type) => keys.includes(type));
        const extras = keys.filter((type) => !KNOWN_PRICE_ORDER.includes(type)).sort();
        return [...ordered, ...extras];
    }, [prices]);

    const [selectedPriceType, setSelectedPriceType] = useState<string>(priceTypes[0] || 'cooked_copra');

    const { data, setData, put, processing, errors, reset } = useForm({
        price: '',
    });

    useEffect(() => {
        if (isOpen) {
            const initialType = priceTypes.includes(selectedPriceType)
                ? selectedPriceType
                : (priceTypes[0] || 'cooked_copra');

            if (initialType !== selectedPriceType) {
                setSelectedPriceType(initialType);
            }

            const currentPrice = prices[initialType];
            setData('price', currentPrice?.toString() || '0.00');
        }
    }, [isOpen, selectedPriceType, prices, setData, priceTypes]);

    const handlePriceTypeChange = (value: string) => {
        setSelectedPriceType(value);
        const currentPrice = prices[value];
        setData('price', currentPrice?.toString() || '0.00');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit) {
            toast.error('Only administrators can update prices.');
            return;
        }

        put(`/weigh-ins/prices/${selectedPriceType}`, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
                onSuccess?.();
            },
            onError: (formErrors) => {
                const firstError = Object.values(formErrors)[0];
                if (firstError) {
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    toast.error(errorMessage);
                } else {
                    toast.error(`Failed to update ${toLabel(selectedPriceType)} price.`);
                }
            },
        });
    };

    const handleClose = () => {
        reset();
        setSelectedPriceType(priceTypes[0] || 'cooked_copra');
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
                {!canEdit && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Prices are read-only for staff accounts.
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label htmlFor="price_type">Price Type *</Label>
                            <Select
                                value={selectedPriceType}
                                onValueChange={handlePriceTypeChange}
                                disabled={!canEdit}
                            >
                                <SelectTrigger id="price_type">
                                    <SelectValue placeholder="Select price type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {priceTypes.map((type) => (
                                        <SelectItem key={type} value={type}>{toLabel(type)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="price">
                                Price ({toUnit(selectedPriceType)}) (PHP) *
                            </Label>
                            <Input
                                id="price"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={data.price}
                                onChange={(e) => setData('price', e.target.value)}
                                placeholder="0.00"
                                disabled={!canEdit}
                                required
                            />
                            {errors.price && (
                                <p className="text-sm text-red-600 mt-1">{errors.price}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                                Current price: PHP {formatCurrency(prices[selectedPriceType] || 0)}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!canEdit || processing}>
                            {processing ? 'Updating...' : `Update ${toLabel(selectedPriceType)} Price`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
