import { useState, useEffect } from 'react';
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
import { Truck, AlertCircle, Plus, Minus } from 'lucide-react';
import { toast } from '@/lib/toast';
import { usePage } from '@inertiajs/react';
import { type SharedData } from '@/types';
import { formatNumber } from '@/lib/format-currency';

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
    product: Product;
}

interface SaleItem {
    id: number;
    quantity: number;
    unit_price: number;
    line_total: number;
    product_variant: ProductVariant;
}

interface User {
    id: number;
    name: string;
    email: string;
}

interface Sale {
    id: number;
    sale_number: string;
    items: SaleItem[];
}

interface AddDeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: Sale;
    users: User[];
}

interface DeliveryItem {
    product_variant_id: number;
    quantity: number;
    max_quantity: number;
    product_name: string;
    variant_description: string;
}

export function AddDeliveryModal({ isOpen, onClose, sale, users }: AddDeliveryModalProps) {
    const { auth } = usePage<SharedData>().props;
    const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);

    const { data, setData, post, processing, errors, reset } = useForm({
        sale_id: sale.id,
        delivered_by_user_id: auth.user.id,
        delivered_at: new Date().toISOString().slice(0, 16), // Current date/time in local format
        status: 'pending',
        notes: '',
        items: [] as Array<{ product_variant_id: number; quantity: number }>,
    });

    // Initialize delivery items from sale items
    useEffect(() => {
        if (isOpen && sale.items) {
            const items: DeliveryItem[] = sale.items.map((item) => ({
                product_variant_id: item.product_variant.id,
                quantity: Number(item.quantity) || 0, // Default to full quantity, ensure it's a number
                max_quantity: Number(item.quantity) || 0, // Ensure it's a number
                product_name: item.product_variant.product.name,
                variant_description: item.product_variant.description,
            }));
            setDeliveryItems(items);
            setData('items', items.map(item => ({
                product_variant_id: item.product_variant_id,
                quantity: item.quantity,
            })));
        }
    }, [isOpen, sale]);

    const handleClose = () => {
        reset();
        setDeliveryItems([]);
        onClose();
    };

    const updateItemQuantity = (index: number, delta: number) => {
        const newItems = [...deliveryItems];
        const item = newItems[index];
        const maxQty = Number(item.max_quantity) || 0;
        const currentQty = Number(item.quantity) || 0;
        const newQuantity = Math.max(0, Math.min(maxQty, currentQty + delta));
        
        newItems[index] = { ...item, quantity: newQuantity };
        setDeliveryItems(newItems);
        
        setData('items', newItems
            .filter(i => (Number(i.quantity) || 0) > 0)
            .map(i => ({
                product_variant_id: i.product_variant_id,
                quantity: Number(i.quantity) || 0,
            }))
        );
    };

    const handleQuantityChange = (index: number, value: string) => {
        const numValue = parseFloat(value) || 0;
        const newItems = [...deliveryItems];
        const item = newItems[index];
        const maxQty = Number(item.max_quantity) || 0;
        const newQuantity = Math.max(0, Math.min(maxQty, numValue));
        
        newItems[index] = { ...item, quantity: newQuantity };
        setDeliveryItems(newItems);
        
        setData('items', newItems
            .filter(i => i.quantity > 0)
            .map(i => ({
                product_variant_id: i.product_variant_id,
                quantity: i.quantity,
            }))
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate at least one item with quantity > 0
        const validItems = deliveryItems.filter(item => (Number(item.quantity) || 0) > 0);
        if (validItems.length === 0) {
            toast.error('Please select at least one item to deliver');
            return;
        }

        // Validate delivered_by_user_id
        if (!data.delivered_by_user_id) {
            toast.error('Please select who will deliver');
            return;
        }

        post('/deliveries', {
            onSuccess: () => {
                // Flash message will be shown automatically
                handleClose();
                router.reload();
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                toast.error(errorMessage || 'Failed to create delivery');
            },
        });
    };

    const totalItems = deliveryItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Create Delivery for Sale {sale.sale_number}
                    </DialogTitle>
                    <DialogDescription>
                        Select items to deliver. You can deliver partial quantities.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Delivery Information */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="delivered_by_user_id">Delivered By *</Label>
                            <Select
                                value={String(data.delivered_by_user_id)}
                                onValueChange={(value) => setData('delivered_by_user_id', parseInt(value))}
                            >
                                <SelectTrigger id="delivered_by_user_id">
                                    <SelectValue placeholder="Select person" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map((user) => (
                                        <SelectItem key={user.id} value={String(user.id)}>
                                            {user.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.delivered_by_user_id && (
                                <p className="text-sm text-destructive">{errors.delivered_by_user_id}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="delivered_at">Delivery Date & Time *</Label>
                            <Input
                                id="delivered_at"
                                type="datetime-local"
                                value={data.delivered_at}
                                onChange={(e) => setData('delivered_at', e.target.value)}
                                required
                            />
                            {errors.delivered_at && (
                                <p className="text-sm text-destructive">{errors.delivered_at}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Status *</Label>
                        <Select
                            value={data.status}
                            onValueChange={(value: 'pending' | 'delivered') => setData('status', value)}
                        >
                            <SelectTrigger id="status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.status && (
                            <p className="text-sm text-destructive">{errors.status}</p>
                        )}
                    </div>

                    {/* Delivery Items */}
                    <div className="space-y-2">
                        <Label>Items to Deliver</Label>
                        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                            {deliveryItems.map((item, index) => (
                                <div key={item.product_variant_id} className="p-3 flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">{item.product_name}</p>
                                        <p className="text-xs text-muted-foreground">{item.variant_description}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Max: {formatNumber(item.max_quantity)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateItemQuantity(index, -0.01)}
                                            disabled={(Number(item.quantity) || 0) <= 0}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max={Number(item.max_quantity) || 0}
                                            value={formatNumber(item.quantity)}
                                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                                            className="w-20 text-center"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateItemQuantity(index, 0.01)}
                                            disabled={(Number(item.quantity) || 0) >= (Number(item.max_quantity) || 0)}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {totalItems === 0 && (
                            <div className="flex items-center gap-2 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4" />
                                <span>At least one item must have quantity greater than 0</span>
                            </div>
                        )}
                        {errors.items && (
                            <p className="text-sm text-destructive">{errors.items}</p>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Add delivery notes..."
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
                            disabled={processing || totalItems === 0}
                        >
                            {processing ? 'Creating...' : 'Create Delivery'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

