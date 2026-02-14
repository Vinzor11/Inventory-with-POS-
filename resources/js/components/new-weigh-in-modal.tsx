import { useEffect, useMemo, useState } from 'react';
import { useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Trash2 } from 'lucide-react';

interface User {
    id: number;
    name: string;
}

interface WeighInItem {
    type: string;
    weight_kg?: string;
    count?: string;
    notes?: string;
}

interface NewWeighInModalProps {
    isOpen: boolean;
    onClose: () => void;
    users: User[];
    prices: Record<string, number | null>;
    onSuccess?: () => void;
}

export function NewWeighInModal({ isOpen, onClose, users, prices, onSuccess }: NewWeighInModalProps) {
    const availableTypes = useMemo(() => {
        const knownOrder = ['cooked_copra', 'uncooked_copra', 'bagol', 'coconut'];
        const types = Array.from(new Set(Object.keys(prices)));

        types.sort((a, b) => {
            const aIndex = knownOrder.indexOf(a);
            const bIndex = knownOrder.indexOf(b);
            const aKnown = aIndex !== -1;
            const bKnown = bIndex !== -1;

            if (aKnown && bKnown) return aIndex - bIndex;
            if (aKnown) return -1;
            if (bKnown) return 1;
            return a.localeCompare(b);
        });

        return types.length > 0 ? types : ['cooked_copra'];
    }, [prices]);

    const defaultType = availableTypes[0];
    const [items, setItems] = useState<WeighInItem[]>([{
        type: defaultType,
        weight_kg: '',
        count: '',
        notes: '',
    }]);

    const { data, setData, post, processing, errors, reset } = useForm({
        items: [] as WeighInItem[],
        weighed_by_user_id: '',
        weighed_at: new Date().toISOString().slice(0, 16),
        notes: '',
    });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setItems([{
                type: defaultType,
                weight_kg: '',
                count: '',
                notes: '',
            }]);
            reset({
                items: [],
                weighed_by_user_id: '',
                weighed_at: new Date().toISOString().slice(0, 16),
                notes: '',
            });
        }
    }, [isOpen, reset, defaultType]);

    const getPrice = (type: string) => {
        return prices[type as keyof typeof prices] ?? null;
    };

    const isKgType = (type: string) => {
        return type !== 'coconut';
    };

    const calculateItemTotal = (item: WeighInItem) => {
        const unitPrice = getPrice(item.type);
        if (unitPrice === null) return 0;
        
        if (isKgType(item.type) && item.weight_kg) {
            return parseFloat(item.weight_kg) * unitPrice;
        } else if (item.type === 'coconut' && item.count) {
            return parseInt(item.count) * unitPrice;
        }
        return 0;
    };

    const calculateGrandTotal = () => {
        return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    };

    const addItem = () => {
        setItems([...items, {
            type: defaultType,
            weight_kg: '',
            count: '',
            notes: '',
        }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        } else {
            toast.error('At least one item is required.');
        }
    };

    const updateItem = (index: number, field: keyof WeighInItem, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        
        // Clear fields when switching types
        if (field === 'type') {
            if (value === 'coconut') {
                newItems[index].weight_kg = '';
            } else {
                newItems[index].count = '';
            }
        }
        
        setItems(newItems);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate transaction-level fields first
        if (!data.weighed_by_user_id) {
            toast.error('Please select a user.');
            return;
        }

        if (!data.weighed_at) {
            toast.error('Please select a date and time.');
            return;
        }
        
        // Validate items - check for valid numeric values
        const validItems = items.filter(item => {
            if (isKgType(item.type)) {
                const weight = item.weight_kg?.trim();
                return weight && !isNaN(parseFloat(weight)) && parseFloat(weight) > 0;
            } else {
                const count = item.count?.trim();
                return count && !isNaN(parseInt(count)) && parseInt(count) > 0;
            }
        });

        if (validItems.length === 0) {
            toast.error('Please add at least one valid item with weight or count.');
            return;
        }

        // Prepare items for submission - convert strings to numbers
        const itemsToSubmit = validItems.map(item => {
            const baseItem: any = {
                type: item.type,
                notes: item.notes?.trim() || undefined,
            };

            if (isKgType(item.type)) {
                const weight = parseFloat(item.weight_kg!.trim());
                if (!isNaN(weight) && weight > 0) {
                    baseItem.weight_kg = weight.toString();
                }
            } else {
                const count = parseInt(item.count!.trim());
                if (!isNaN(count) && count > 0) {
                    baseItem.count = count.toString();
                }
            }

            return baseItem;
        }).filter(item => {
            // Final validation - ensure each item has required field
            if (isKgType(item.type)) {
                return item.weight_kg && parseFloat(item.weight_kg) > 0;
            } else {
                return item.count && parseInt(item.count) > 0;
            }
        });

        // Ensure we have valid items
        if (itemsToSubmit.length === 0) {
            toast.error('Please add at least one valid item with weight or count.');
            return;
        }

        // Convert weighed_by_user_id to number
        const weighedByUserId = parseInt(data.weighed_by_user_id);
        if (isNaN(weighedByUserId)) {
            toast.error('Please select a valid user.');
            return;
        }

        router.post('/weigh-ins', {
            items: itemsToSubmit,
            weighed_by_user_id: weighedByUserId,
            weighed_at: data.weighed_at,
            notes: data.notes?.trim() || null,
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setItems([{
                    type: defaultType,
                    weight_kg: '',
                    count: '',
                    notes: '',
                }]);
                onClose();
                onSuccess?.();
            },
            onError: (errors) => {
                console.error('Validation errors:', errors);
                const firstError = Object.values(errors)[0];
                if (firstError) {
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    toast.error(errorMessage);
                } else {
                    toast.error('Failed to create weigh-in transaction.');
                }
            },
        });
    };

    const handleClose = () => {
        reset();
        setItems([{
            type: defaultType,
            weight_kg: '',
            count: '',
            notes: '',
        }]);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Weigh-In Transaction</DialogTitle>
                    <DialogDescription>
                        Record multiple weigh-ins in a single transaction. Add items as needed.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        {/* Transaction-level fields */}
                        <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-border">
                            <h3 className="text-sm font-semibold mb-3">Transaction Information</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="weighed_by_user_id">Weighed By *</Label>
                                    <Select 
                                        value={data.weighed_by_user_id || ''} 
                                        onValueChange={(value) => setData('weighed_by_user_id', value)}
                                    >
                                        <SelectTrigger id="weighed_by_user_id">
                                            <SelectValue placeholder="Select a user" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users.map((user) => (
                                                <SelectItem key={user.id} value={user.id.toString()}>
                                                    {user.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.weighed_by_user_id && <p className="text-sm text-red-600 mt-1">{errors.weighed_by_user_id}</p>}
                                </div>

                                <div>
                                    <Label htmlFor="weighed_at">Weighed At *</Label>
                                    <Input 
                                        id="weighed_at" 
                                        type="datetime-local" 
                                        value={data.weighed_at || ''} 
                                        onChange={(e) => setData('weighed_at', e.target.value)} 
                                        required 
                                    />
                                    {errors.weighed_at && <p className="text-sm text-red-600 mt-1">{errors.weighed_at}</p>}
                                </div>

                                <div>
                                    <Label htmlFor="notes">Transaction Notes</Label>
                                    <Textarea 
                                        id="notes" 
                                        value={data.notes || ''} 
                                        onChange={(e) => setData('notes', e.target.value)} 
                                        rows={2} 
                                        placeholder="Optional notes for the entire transaction"
                                    />
                                    {errors.notes && <p className="text-sm text-red-600 mt-1">{errors.notes}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Items section */}
                        <div className="rounded-lg border border-sidebar-border/70 p-4 dark:border-border">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold">Weigh-In Items</h3>
                                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Item
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {items.map((item, index) => (
                                    <div key={index} className="border border-sidebar-border/50 rounded-lg p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium">Item {index + 1}</h4>
                                            {items.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeItem(index)}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>

                                        <div>
                                            <Label>Type *</Label>
                                            <Select 
                                                value={item.type} 
                                                onValueChange={(value) => updateItem(index, 'type', value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableTypes.map((type) => (
                                                        <SelectItem key={type} value={type}>
                                                            {type
                                                                .replace(/_/g, ' ')
                                                                .replace(/\b\w/g, (char) => char.toUpperCase())}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {isKgType(item.type) ? (
                                            <div>
                                                <Label>Weight (kg) *</Label>
                                                <Input 
                                                    type="number" 
                                                    step="0.01" 
                                                    min="0.01" 
                                                    value={item.weight_kg || ''} 
                                                    onChange={(e) => updateItem(index, 'weight_kg', e.target.value)} 
                                                    placeholder="Enter weight"
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <Label>Count (pieces) *</Label>
                                                <Input 
                                                    type="number" 
                                                    min="1" 
                                                    value={item.count || ''} 
                                                    onChange={(e) => updateItem(index, 'count', e.target.value)} 
                                                    placeholder="Enter count"
                                                />
                                            </div>
                                        )}

                                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                Unit Price: {getPrice(item.type) !== null ? `PHP ${formatCurrency(getPrice(item.type) || 0)}` : 'Not set'}
                                            </div>
                                            <div className="text-sm font-semibold">
                                                Item Total: ₱{formatCurrency(calculateItemTotal(item))}
                                            </div>
                                        </div>

                                        <div>
                                            <Label>Item Notes (Optional)</Label>
                                            <Textarea 
                                                value={item.notes || ''} 
                                                onChange={(e) => updateItem(index, 'notes', e.target.value)} 
                                                rows={2} 
                                                placeholder="Optional notes for this item"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Grand Total */}
                            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center justify-between">
                                    <span className="text-lg font-semibold">Grand Total:</span>
                                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                        ₱{formatCurrency(calculateGrandTotal())}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Creating...' : `Create Transaction (${items.length} item${items.length !== 1 ? 's' : ''})`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
