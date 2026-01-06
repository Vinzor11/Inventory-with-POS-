import { Head, usePage } from '@inertiajs/react';
import { useState, useMemo } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Truck, Package, Plus, Minus, X, Clock, ShoppingCart, Home, LogIn, AlertTriangle, Search, Scale, FileText, LayoutGrid } from 'lucide-react';
import { toast } from '@/lib/toast';
import { formatCurrency } from '@/lib/format-currency';
import { type SharedData } from '@/types';

interface User {
    id: number;
    name: string;
}

interface Product {
    id: number;
    name: string;
}

interface ProductVariant {
    id: number;
    description: string;
    product: Product;
}

interface SaleItem {
    id: number;
    product_variant_id: number;
    quantity: number;
    unit_price: number;
    line_total: number;
    delivered_quantity: number;
    refunded_quantity: number;
    canceled_quantity: number;
    remaining_quantity: number;
    product_variant: ProductVariant;
}

interface Delivery {
    id: number;
    sale_number: string;
    delivery_status: 'PENDING' | 'PARTIAL';
    created_at: string;
    notes: string | null;
    cashier: User;
    delivery_name: string | null;
    delivery_address: string | null;
    delivery_contact: string | null;
    items: SaleItem[];
}

interface DeliveryLandingProps {
    deliveries: Delivery[];
}

interface CartItem {
    deliveryId: number;
    saleNumber: string;
    productVariantId: number;
    productName: string;
    description: string;
    unitPrice: number;
    quantity: number;
    remainingQuantity: number;
    saleItemId: number;
}

export default function DeliveryLanding({ deliveries }: DeliveryLandingProps) {
    const { auth } = usePage<SharedData>().props;
    const [selectedStatus, setSelectedStatus] = useState<'all' | 'PENDING' | 'PARTIAL'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [deliveredAt, setDeliveredAt] = useState('');
    const [notes, setNotes] = useState('');

    // Filter deliveries by status and search term
    const filteredDeliveries = useMemo(() => {
        let filtered = deliveries;
        
        // Filter by status
        if (selectedStatus !== 'all') {
            filtered = filtered.filter(d => d.delivery_status === selectedStatus);
        }
        
        // Filter by search term
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(d => 
                d.sale_number.toLowerCase().includes(searchLower) ||
                d.cashier.name.toLowerCase().includes(searchLower) ||
                d.items.some(item => 
                    item.product_variant.product.name.toLowerCase().includes(searchLower) ||
                    item.product_variant.description.toLowerCase().includes(searchLower)
                )
            );
        }
        
        return filtered;
    }, [deliveries, selectedStatus, searchTerm]);

    // Get current time
    const currentTime = useMemo(() => {
        return new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }, []);

    // Add item to cart (similar to POS addToCart)
    const addToCart = (delivery: Delivery, item: SaleItem) => {
        if (item.remaining_quantity <= 0) {
            toast.error('No remaining quantity to deliver');
            return;
        }

        // Check if cart already has items from a different sale
        if (cart.length > 0) {
            const existingSaleNumber = cart[0].saleNumber;
            if (existingSaleNumber !== delivery.sale_number) {
                toast.error('Please process items from one sale at a time. Clear cart first.');
                return;
            }
        }

        // Auto-populate date/time and notes from sale when first item is added
        if (cart.length === 0) {
            const saleDate = new Date(delivery.created_at);
            const localDateTime = new Date(saleDate.getTime() - saleDate.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);
            setDeliveredAt(localDateTime);
            setNotes(delivery.notes || '');
        }

        // Check if item already exists in cart
        const existingItemIndex = cart.findIndex(
            cartItem => cartItem.productVariantId === item.product_variant_id && cartItem.deliveryId === delivery.id
        );

        if (existingItemIndex >= 0) {
            // Update quantity (but check remaining)
            const newCart = [...cart];
            const newQuantity = newCart[existingItemIndex].quantity + 0.5;
            if (newQuantity > newCart[existingItemIndex].remainingQuantity) {
                toast.error(`Insufficient remaining quantity. Available: ${newCart[existingItemIndex].remainingQuantity}`);
                return;
            }
            newCart[existingItemIndex].quantity = newQuantity;
            setCart(newCart);
        } else {
            // Add new item
            const newItem: CartItem = {
                deliveryId: delivery.id,
                saleNumber: delivery.sale_number,
                productVariantId: item.product_variant_id,
                productName: item.product_variant.product.name,
                description: item.product_variant.description,
                unitPrice: item.unit_price,
                quantity: 0.5,
                remainingQuantity: item.remaining_quantity,
                saleItemId: item.id,
            };
            setCart([...cart, newItem]);
        }
    };

    // Update cart item quantity
    const updateQuantity = (index: number, change: number) => {
        const newCart = [...cart];
        const newQuantity = Math.max(0, Math.min(newCart[index].remainingQuantity, newCart[index].quantity + change));
        
        if (newQuantity === 0) {
            // Remove item if quantity is 0
            setCart(newCart.filter((_, i) => i !== index));
        } else {
            newCart[index].quantity = newQuantity;
            setCart(newCart);
        }
    };

    // Remove item from cart
    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    // Clear cart
    const clearCart = () => {
        setCart([]);
        setDeliveredAt('');
        setNotes('');
    };

    // Calculate cart totals
    const cartTotals = useMemo(() => {
        const total = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        return { total };
    }, [cart]);

    // Group cart items by delivery
    const cartByDelivery = useMemo(() => {
        const grouped: Record<number, CartItem[]> = {};
        cart.forEach(item => {
            if (!grouped[item.deliveryId]) {
                grouped[item.deliveryId] = [];
            }
            grouped[item.deliveryId].push(item);
        });
        return grouped;
    }, [cart]);

    // Handle checkout (process delivery)
    const handleCheckout = () => {
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        // Check if all items are from the same delivery
        const deliveryIds = [...new Set(cart.map(item => item.deliveryId))];
        if (deliveryIds.length > 1) {
            toast.error('Please process items from one delivery at a time');
            return;
        }

        setIsPinDialogOpen(true);
    };

    // Handle PIN submission and process delivery
    const handlePinSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (isProcessing) {
            return;
        }

        if (!pin) {
            setPinError('PIN is required');
            return;
        }

        setIsProcessing(true);
        setPinError('');

        // All items should be from the same delivery (validated in handleCheckout)
        const deliveryId = cart[0].deliveryId;
        const items = cart.map(item => ({
            product_variant_id: item.productVariantId,
            quantity: item.quantity,
        }));

        router.post(`/delivery-landing/${deliveryId}/process`, {
            pin,
            items,
            delivered_at: deliveredAt,
            notes: notes.trim(),
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsPinDialogOpen(false);
                setPin('');
                setCart([]);
                setDeliveredAt(new Date().toISOString().slice(0, 16));
                setNotes('');
                toast.success('Delivery processed successfully. Delivery receipt has been generated.');
            },
            onError: (errors) => {
                setIsProcessing(false);
                if (errors.pin) {
                    const pinError = Array.isArray(errors.pin) ? errors.pin[0] : errors.pin;
                    setPinError(pinError);
                } else if (errors.delivery) {
                    const deliveryError = Array.isArray(errors.delivery) ? errors.delivery[0] : errors.delivery;
                    setPinError(deliveryError);
                } else {
                    const firstError = Object.values(errors)[0];
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    setPinError(errorMessage || 'Delivery failed. Please try again.');
                }
            },
        });
    };

    return (
        <>
            <Head title="Delivery Management" />
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                {/* Left Sidebar - Desktop Only */}
                <div className="hidden lg:flex lg:w-[7%] lg:flex-col lg:items-center lg:py-4 lg:bg-white lg:border-r lg:border-slate-200">
                    <Button
                        variant={selectedStatus === 'all' ? "default" : "ghost"}
                        className={`w-20 h-20 mb-2 flex flex-col items-center justify-center ${
                            selectedStatus === 'all' ? 'bg-blue-600 text-white' : ''
                        }`}
                        onClick={() => setSelectedStatus('all')}
                    >
                        <Home className="h-6 w-6 mb-1" />
                        <span className="text-xs">All</span>
                    </Button>
                    <Button
                        variant={selectedStatus === 'PENDING' ? "default" : "ghost"}
                        className={`w-20 h-20 mb-2 flex flex-col items-center justify-center ${
                            selectedStatus === 'PENDING' ? 'bg-blue-600 text-white' : ''
                        }`}
                        onClick={() => setSelectedStatus('PENDING')}
                    >
                        <Clock className="h-6 w-6 mb-1" />
                        <span className="text-xs text-center">Pending</span>
                    </Button>
                    <Button
                        variant={selectedStatus === 'PARTIAL' ? "default" : "ghost"}
                        className={`w-20 h-20 mb-2 flex flex-col items-center justify-center ${
                            selectedStatus === 'PARTIAL' ? 'bg-blue-600 text-white' : ''
                        }`}
                        onClick={() => setSelectedStatus('PARTIAL')}
                    >
                        <Package className="h-6 w-6 mb-1" />
                        <span className="text-xs text-center">Partial</span>
                    </Button>
                    <div className="mt-auto">
                        <Button 
                            variant="ghost" 
                            className="w-20 h-20 flex flex-col items-center justify-center"
                            onClick={() => router.visit(auth.user ? '/dashboard' : '/login')}
                        >
                            {auth.user ? (
                                <>
                                    <LayoutGrid className="h-6 w-6 mb-1" />
                                    <span className="text-xs">Dashboard</span>
                                </>
                            ) : (
                                <>
                                    <LogIn className="h-6 w-6 mb-1" />
                                    <span className="text-xs">Login</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden lg:w-[64%] min-w-0">
                    {/* Mobile Category Bar */}
                    <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2 overflow-x-auto">
                        <div className="flex gap-2">
                            <Button
                                variant={selectedStatus === 'all' ? "default" : "outline"}
                                size="sm"
                                className={selectedStatus === 'all' ? 'bg-blue-600 text-white' : ''}
                                onClick={() => setSelectedStatus('all')}
                            >
                                All
                            </Button>
                            <Button
                                variant={selectedStatus === 'PENDING' ? "default" : "outline"}
                                size="sm"
                                className={selectedStatus === 'PENDING' ? 'bg-blue-600 text-white' : ''}
                                onClick={() => setSelectedStatus('PENDING')}
                            >
                                Pending
                            </Button>
                            <Button
                                variant={selectedStatus === 'PARTIAL' ? "default" : "outline"}
                                size="sm"
                                className={selectedStatus === 'PARTIAL' ? 'bg-blue-600 text-white' : ''}
                                onClick={() => setSelectedStatus('PARTIAL')}
                            >
                                Partial
                            </Button>
                        </div>
                    </div>

                    {/* Header */}
                    <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                type="text"
                                placeholder="Search deliveries by sale number, cashier, or product..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.visit('/pos')}
                            >
                                <ShoppingCart className="h-4 w-4 mr-1" />
                                New Order
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.visit('/weigh-ins-landing')}
                            >
                                <Scale className="h-4 w-4 mr-1" />
                                Weigh-Ins
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="lg:hidden relative"
                                onClick={() => setIsMobileCartOpen(true)}
                            >
                                <ShoppingCart className="h-5 w-5" />
                                {cart.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                        {cart.length}
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Delivery Items Grid */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {filteredDeliveries.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredDeliveries.map((delivery) => {
                                    const totalItems = delivery.items.length;
                                    const totalRemaining = delivery.items.reduce((sum, item) => sum + item.remaining_quantity, 0);
                                    const hasAvailableItems = delivery.items.some(item => item.remaining_quantity > 0);
                                    
                                    // Check if cart has items from a different sale
                                    const cartHasOtherSale = cart.length > 0 && cart[0].saleNumber !== delivery.sale_number;
                                    const isDisabled = !hasAvailableItems || cartHasOtherSale;
                                        
                                    return (
                                        <div
                                            key={delivery.id}
                                            className={`bg-white rounded-lg shadow-sm transition-all duration-200 border border-slate-200 flex flex-col ${
                                                isDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md cursor-pointer transform hover:scale-[1.02]'
                                            }`}
                                            onClick={() => {
                                                if (isDisabled) {
                                                    if (cartHasOtherSale) {
                                                        toast.error('Please process items from one sale at a time. Clear cart first.');
                                                    }
                                                    return;
                                                }
                                                
                                                // Add all available items to cart at once
                                                const itemsToAdd: CartItem[] = [];
                                                delivery.items.forEach(item => {
                                                    if (item.remaining_quantity > 0) {
                                                        // Check if item already exists in cart
                                                        const existingItemIndex = cart.findIndex(
                                                            cartItem => cartItem.productVariantId === item.product_variant_id && cartItem.deliveryId === delivery.id
                                                        );

                                                        if (existingItemIndex >= 0) {
                                                            // Update quantity (but check remaining)
                                                            const existingItem = cart[existingItemIndex];
                                                            const newQuantity = Math.min(existingItem.remainingQuantity, existingItem.quantity + 0.5);
                                                            if (newQuantity > existingItem.quantity) {
                                                                const newCart = [...cart];
                                                                newCart[existingItemIndex].quantity = newQuantity;
                                                                setCart(newCart);
                                                            }
                                                        } else {
                                                            // Add new item
                                                            itemsToAdd.push({
                                                                deliveryId: delivery.id,
                                                                saleNumber: delivery.sale_number,
                                                                productVariantId: item.product_variant_id,
                                                                productName: item.product_variant.product.name,
                                                                description: item.product_variant.description,
                                                                unitPrice: item.unit_price,
                                                                quantity: 0.5,
                                                                remainingQuantity: item.remaining_quantity,
                                                                saleItemId: item.id,
                                                            });
                                                        }
                                                    }
                                                });
                                                
                                                // Add all new items at once
                                                if (itemsToAdd.length > 0) {
                                                    // Auto-populate date/time and notes from sale when first items are added
                                                    if (cart.length === 0) {
                                                        const saleDate = new Date(delivery.created_at);
                                                        const localDateTime = new Date(saleDate.getTime() - saleDate.getTimezoneOffset() * 60000)
                                                            .toISOString()
                                                            .slice(0, 16);
                                                        setDeliveredAt(localDateTime);
                                                        setNotes(delivery.notes || '');
                                                    }
                                                    setCart([...cart, ...itemsToAdd]);
                                                }
                                            }}
                                        >
                                            {/* Image Section - Keep original h-36 size */}
                                            <div className="h-36 bg-slate-100 rounded-t-lg flex items-center justify-center relative">
                                                <Truck className="h-16 w-16 text-slate-400" />
                                                {isDisabled && (
                                                    <div className="absolute inset-0 bg-red-50 bg-opacity-80 flex items-center justify-center">
                                                        <div className="text-center">
                                                            <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-1" />
                                                            <span className="text-xs font-semibold text-red-600">
                                                                {!hasAvailableItems ? 'No Items' : 'Clear cart first'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content Section */}
                                            <div className="flex-1 p-4 flex flex-col">
                                                {/* Header */}
                                                <div className="mb-3">
                                                    <h3 className="font-semibold text-slate-900 text-base mb-1">
                                                        {delivery.sale_number}
                                                    </h3>
                                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                                        {delivery.delivery_status === 'PENDING' ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                                                <Clock className="h-3 w-3 mr-1" />
                                                                Pending
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                <Package className="h-3 w-3 mr-1" />
                                                                Partial
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-slate-500">
                                                            {new Date(delivery.created_at).toLocaleDateString()} • {delivery.cashier.name}
                                                        </span>
                                                    </div>
                                                    {delivery.delivery_name && (
                                                        <p className="text-xs text-slate-600 font-medium">
                                                            To: {delivery.delivery_name}
                                                        </p>
                                                    )}
                                                    {delivery.delivery_address && (
                                                        <p className="text-xs text-slate-500 line-clamp-1">
                                                            {delivery.delivery_address}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Notes if available */}
                                                {delivery.notes && (
                                                    <div className="flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-200 mb-3">
                                                        <FileText className="h-3.5 w-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                                                        <p className="text-xs text-blue-900 line-clamp-2">{delivery.notes}</p>
                                                    </div>
                                                )}

                                                {/* Items List */}
                                                <div className="flex-1 space-y-2 min-h-0 overflow-y-auto">
                                                    {delivery.items.map((item) => (
                                                        <div key={item.id} className="flex items-start justify-between gap-2 p-2 bg-slate-50 rounded border border-slate-200">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-slate-900 truncate">
                                                                    {item.product_variant?.product?.name || 'N/A'}
                                                                </p>
                                                                {item.product_variant?.description && (
                                                                    <p className="text-xs text-slate-600 truncate">
                                                                        {item.product_variant.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <span className="text-xs font-semibold text-slate-700">
                                                                    Qty: {item.remaining_quantity.toFixed(2)}
                                                                </span>
                                                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                                    item.remaining_quantity > 5 
                                                                        ? 'bg-green-100 text-green-700' 
                                                                        : item.remaining_quantity > 0 
                                                                        ? 'bg-yellow-100 text-yellow-700' 
                                                                        : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                    {item.remaining_quantity > 0 ? 'Available' : 'None'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Footer */}
                                                <div className="mt-3 pt-3 border-t border-slate-200">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-slate-600">
                                                            {totalItems} item{totalItems !== 1 ? 's' : ''} total
                                                        </span>
                                                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                                                            totalRemaining > 5 
                                                                ? 'bg-green-100 text-green-700' 
                                                                : totalRemaining > 0 
                                                                ? 'bg-yellow-100 text-yellow-700' 
                                                                : 'bg-red-100 text-red-700'
                                                        }`}>
                                                            Remaining: {totalRemaining.toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <Truck className="h-16 w-16 mb-4 opacity-50" />
                                <p className="text-lg">No deliveries found</p>
                                <p className="text-sm">Try selecting a different status</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop Cart Panel */}
                <div className="hidden lg:flex lg:w-[28%] bg-white border-l border-slate-200 flex-col h-screen overflow-hidden">
                    <div className="flex-shrink-0 p-5 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-semibold text-slate-900">Delivery Cart</h2>
                            <span className="text-sm text-slate-500">{currentTime}</span>
                        </div>
                        <p className="text-sm text-slate-600">{cart.length} item(s) ready for delivery</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 min-h-0" style={{ overflowY: 'auto' }}>
                        {cart.length > 0 ? (
                            <div className="space-y-4">
                                {Object.entries(cartByDelivery).map(([deliveryId, items]) => {
                                    const delivery = filteredDeliveries.find(d => d.id === parseInt(deliveryId));
                                    return (
                                        <div key={deliveryId} className="space-y-2">
                                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                {delivery?.sale_number || 'Unknown'}
                                            </div>
                                            {items.map((item, index) => {
                                                const cartIndex = cart.findIndex(
                                                    c => c.deliveryId === parseInt(deliveryId) && c.productVariantId === item.productVariantId
                                                );
                                                return (
                                                    <div key={`${deliveryId}-${item.productVariantId}`} className="bg-slate-50 rounded-lg p-4 border border-slate-200 relative">
                                                        <button
                                                            onClick={() => removeFromCart(cartIndex)}
                                                            className="absolute top-3 right-3 text-slate-400 hover:text-red-600 transition-colors"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                        <div className="flex gap-4 pr-8">
                                                            <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center flex-shrink-0">
                                                                <Package className="h-6 w-6 text-slate-400" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-medium text-sm text-slate-900 truncate mb-1">{item.productName}</h4>
                                                                <p className="text-xs text-slate-500 truncate mb-1">{item.description}</p>
                                                                <div className="flex items-center gap-2 mt-3">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            updateQuantity(cartIndex, -0.5);
                                                                        }}
                                                                        className="w-7 h-7 rounded bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-colors"
                                                                    >
                                                                        <Minus className="h-3 w-3" />
                                                                    </button>
                                                                    <span className="text-sm font-medium min-w-[2rem] text-center">
                                                                        {item.quantity.toFixed(2)}
                                                                    </span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            updateQuantity(cartIndex, 0.5);
                                                                        }}
                                                                        className="w-7 h-7 rounded bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-colors"
                                                                    >
                                                                        <Plus className="h-3 w-3" />
                                                                    </button>
                                                                </div>
                                                                <div className="text-xs text-slate-500 mt-1">
                                                                    Remaining: {item.remainingQuantity.toFixed(2)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-16">
                                <ShoppingCart className="h-16 w-16 mb-4 opacity-50" />
                                <p className="text-sm">Your cart is empty</p>
                                <p className="text-xs mt-1">Click on items to add them</p>
                            </div>
                        )}
                    </div>

                    {cart.length > 0 && (
                        <div className="flex-shrink-0 border-t border-slate-200 bg-white p-5 space-y-5">
                            {/* Notes */}
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">
                                    Notes (Optional)
                                </label>
                                <textarea
                                    placeholder="Add delivery notes or special instructions..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    rows={3}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-3 border-t border-slate-200">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={clearCart}
                                >
                                    Clear Cart
                                </Button>
                                <Button
                                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    onClick={handleCheckout}
                                    disabled={isProcessing || cart.length === 0}
                                >
                                    <Truck className="h-4 w-4 mr-2" />
                                    Process Delivery
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Mobile Cart Sheet */}
                <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
                    <SheetContent side="right" className="w-full sm:max-w-sm md:max-w-md flex flex-col p-0">
                        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-200">
                            <SheetHeader>
                                <SheetTitle className="text-lg font-semibold">Delivery Cart</SheetTitle>
                                {cart.length > 0 && (
                                    <p className="text-sm text-slate-600 mt-1">{cart.length} item(s)</p>
                                )}
                            </SheetHeader>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                            {cart.length > 0 ? (
                                <div className="space-y-3 sm:space-y-4">
                                    {Object.entries(cartByDelivery).map(([deliveryId, items]) => {
                                        const delivery = filteredDeliveries.find(d => d.id === parseInt(deliveryId));
                                        return (
                                            <div key={deliveryId} className="space-y-2">
                                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                    {delivery?.sale_number || 'Unknown'}
                                                </div>
                                                {items.map((item, index) => {
                                                    const cartIndex = cart.findIndex(
                                                        c => c.deliveryId === parseInt(deliveryId) && c.productVariantId === item.productVariantId
                                                    );
                                                    return (
                                                        <div key={`${deliveryId}-${item.productVariantId}`} className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200 relative">
                                                            <button
                                                                onClick={() => removeFromCart(cartIndex)}
                                                                className="absolute top-2 right-2 sm:top-3 sm:right-3 text-slate-400 hover:text-red-600 active:text-red-700 transition-colors touch-manipulation"
                                                                aria-label="Remove item"
                                                            >
                                                                <X className="h-4 w-4 sm:h-5 sm:w-5" />
                                                            </button>
                                                            <div className="flex gap-3 sm:gap-4 pr-8 sm:pr-10">
                                                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-200 rounded flex items-center justify-center flex-shrink-0">
                                                                    <Package className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="font-medium text-sm text-slate-900 truncate mb-1">{item.productName}</h4>
                                                                    <p className="text-xs text-slate-500 truncate mb-1">{item.description}</p>
                                                                    <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                updateQuantity(cartIndex, -0.5);
                                                                            }}
                                                                            className="w-8 h-8 sm:w-9 sm:h-9 rounded bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center transition-colors touch-manipulation"
                                                                            aria-label="Decrease quantity"
                                                                        >
                                                                            <Minus className="h-4 w-4" />
                                                                        </button>
                                                                        <span className="text-sm font-medium min-w-[3rem] text-center">
                                                                            {item.quantity.toFixed(2)}
                                                                        </span>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                updateQuantity(cartIndex, 0.5);
                                                                            }}
                                                                            className="w-8 h-8 sm:w-9 sm:h-9 rounded bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center transition-colors touch-manipulation"
                                                                            aria-label="Increase quantity"
                                                                        >
                                                                            <Plus className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 mt-1">
                                                                        Remaining: {item.remainingQuantity.toFixed(2)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 py-16">
                                    <ShoppingCart className="h-16 w-16 mb-4 opacity-50" />
                                    <p className="text-sm">Your cart is empty</p>
                                    <p className="text-xs mt-1">Click on items to add them</p>
                                </div>
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="flex-shrink-0 border-t border-slate-200 bg-white p-5 space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                                        Notes (Optional)
                                    </label>
                                    <textarea
                                        placeholder="Add delivery notes or special instructions..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows={3}
                                    />
                                </div>

                                <div className="flex gap-3 pt-3 border-t border-slate-200">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={clearCart}
                                    >
                                        Clear
                                    </Button>
                                    <Button
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                        onClick={handleCheckout}
                                        disabled={isProcessing || cart.length === 0}
                                    >
                                        <Truck className="h-4 w-4 mr-2" />
                                        Process
                                    </Button>
                                </div>
                            </div>
                        )}
                    </SheetContent>
                </Sheet>

                {/* PIN Dialog */}
                <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Confirm Delivery Processing</DialogTitle>
                            <DialogDescription>
                                Enter your PIN to process this delivery and generate the delivery receipt.
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
                                }}
                                disabled={isProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handlePinSubmit}
                                disabled={isProcessing || !pin}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {isProcessing ? 'Processing...' : 'Process Delivery'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
