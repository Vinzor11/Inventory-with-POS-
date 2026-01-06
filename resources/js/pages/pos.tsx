import { Head, usePage } from '@inertiajs/react';
import { useState, useMemo, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Home, Package, ShoppingCart, Search, Plus, Minus, X, CreditCard, LogIn, AlertTriangle, DollarSign, FileText, Truck, Scale, ChevronDown, ChevronUp, LayoutGrid } from 'lucide-react';
import { toast } from '@/lib/toast';
import { formatCurrency } from '@/lib/format-currency';
import { type SharedData } from '@/types';

interface ProductCategory {
    id: number;
    name: string;
}

interface Inventory {
    quantity_on_hand: number;
}

interface ProductVariant {
    id: number;
    size: string | null;
    thickness: string | null;
    diameter: string | null;
    description: string;
    unit_price: number;
    inventory: Inventory | null;
}

interface Product {
    id: number;
    name: string;
    brand: string | null;
    sku: string | null;
    image: string | null;
    base_unit: string;
    category: ProductCategory;
    variants: ProductVariant[];
}

interface CartItem {
    productId: number;
    productVariantId: number;
    name: string;
    description: string;
    unitPrice: number;
    quantity: number;
    unit: string;
    stock: number;
    image: string | null;
}

interface PosProps {
    categories: ProductCategory[];
    products: Product[];
}

export default function Pos({ categories, products }: PosProps) {
    const { auth } = usePage<SharedData>().props;
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [amountReceived, setAmountReceived] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | 'cheque' | 'credit'>('cash');
    const [isForDelivery, setIsForDelivery] = useState(false);
    const [notes, setNotes] = useState('');
    const [deliveryName, setDeliveryName] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryContact, setDeliveryContact] = useState('');
    const [itemsCollapsed, setItemsCollapsed] = useState(false);
    const [fieldsCollapsed, setFieldsCollapsed] = useState(false);

    // Auto-collapse items section when delivery is checked
    useEffect(() => {
        if (isForDelivery) {
            setItemsCollapsed(true);
        }
    }, [isForDelivery]);

    // Filter products based on search and category
    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const matchesSearch = !searchTerm || 
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesCategory = !selectedCategoryId || product.category.id === selectedCategoryId;
            
            return matchesSearch && matchesCategory;
        });
    }, [products, searchTerm, selectedCategoryId]);

    // Calculate cart totals (no tax per requirements)
    const cartTotals = useMemo(() => {
        const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        const total = subtotal; // No tax, no discounts
        return { subtotal, total };
    }, [cart]);

    // Calculate payment details
    const paymentDetails = useMemo(() => {
        const total = cartTotals.total;
        const received = parseFloat(amountReceived) || 0;
        const change = received > total ? received - total : 0;
        const balance = received < total ? total - received : 0;
        const isExact = received === total;
        const hasChange = change > 0;
        const isPartial = received > 0 && received < total;
        const isComplete = received >= total;

        return {
            total,
            received,
            change,
            balance,
            isExact,
            hasChange,
            isPartial,
            isComplete,
        };
    }, [cartTotals.total, amountReceived]);

    // Get current time
    const currentTime = useMemo(() => {
        return new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }, []);

    // Add product variant to cart
    const addToCart = (product: Product, variant: ProductVariant) => {
        const stock = variant.inventory?.quantity_on_hand ?? 0;
        
        // Check if item already exists in cart
        const existingItemIndex = cart.findIndex(
            item => item.productVariantId === variant.id
        );

        if (existingItemIndex >= 0) {
            // Update quantity (but check stock)
            const newCart = [...cart];
            const newQuantity = newCart[existingItemIndex].quantity + 1;
            if (newQuantity > stock) {
                toast.error(`Insufficient stock. Available: ${stock}`);
                return;
            }
            newCart[existingItemIndex].quantity = newQuantity;
            setCart(newCart);
        } else {
            // Add new item
            if (stock <= 0) {
                toast.error('This item is out of stock.');
                return;
            }
            const newItem: CartItem = {
                productId: product.id,
                productVariantId: variant.id,
                name: product.name,
                description: variant.description,
                unitPrice: variant.unit_price,
                quantity: 1,
                unit: product.base_unit,
                stock: stock,
                image: product.image,
            };
            setCart([...cart, newItem]);
        }
    };

    // Update cart item quantity
    const updateQuantity = (index: number, change: number) => {
        const newCart = [...cart];
        const newQuantity = Math.max(0.50, newCart[index].quantity + change);
        
        // Check stock availability
        if (newQuantity > newCart[index].stock) {
            toast.error(`Insufficient stock. Available: ${newCart[index].stock}`);
            return;
        }
        
        newCart[index].quantity = newQuantity;
        setCart(newCart);
    };

    // Remove item from cart
    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    // Clear cart
    const clearCart = () => {
        setCart([]);
    };

    // Handle checkout
    const handleCheckout = () => {
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        // Allow checkout with any payment amount (including 0 for unpaid sales)
        // Partial payments are supported - user can add more payments later
        const paymentAmount = parseFloat(amountReceived) || 0;
        if (paymentAmount < 0) {
            toast.error('Payment amount cannot be negative.');
            return;
        }

        setIsPinDialogOpen(true);
    };

    // Handle PIN submission and process checkout
    const handlePinSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
        // Prevent default form submission
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Prevent double submission
        if (isProcessing) {
            return;
        }

        if (!pin) {
            setPinError('PIN is required');
            return;
        }

        setIsProcessing(true);
        setPinError('');

        // Prepare items for checkout
        const items = cart.map(item => ({
            product_variant_id: item.productVariantId,
            quantity: item.quantity,
        }));

        // Payment validation: amount must be >= 0 (allows partial payments)
        const paymentAmount = parseFloat(amountReceived) || 0;
        if (paymentAmount < 0) {
            setPinError('Payment amount cannot be negative.');
            setIsProcessing(false);
            return;
        }

        // Prepare checkout data with payment information
        const checkoutData = {
            items,
            pin,
            notes: notes.trim(),
            payment_amount: parseFloat(amountReceived) || 0,
            payment_method: paymentMethod,
            is_for_delivery: isForDelivery,
            delivery_name: isForDelivery ? deliveryName.trim() : '',
            delivery_address: isForDelivery ? deliveryAddress.trim() : '',
            delivery_contact: isForDelivery ? deliveryContact.trim() : '',
        };

        // Submit checkout request directly using router.post
        router.post('/pos/checkout', checkoutData, {
            onSuccess: () => {
                // Redirect handled by backend
                setIsProcessing(false);
                setIsPinDialogOpen(false);
                setPin('');
                setCart([]);
                setAmountReceived('');
                setPaymentMethod('cash');
                setIsForDelivery(false);
                setNotes('');
                setDeliveryName('');
                setDeliveryAddress('');
                setDeliveryContact('');
            },
            onError: (errors) => {
                setIsProcessing(false);
                if (errors.pin) {
                    const pinError = Array.isArray(errors.pin) ? errors.pin[0] : errors.pin;
                    setPinError(pinError);
                } else if (errors.checkout) {
                    const checkoutError = Array.isArray(errors.checkout) ? errors.checkout[0] : errors.checkout;
                    setPinError(checkoutError);
                } else if (errors.items) {
                    setPinError('Invalid cart items');
                } else {
                    const firstError = Object.values(errors)[0];
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    setPinError(errorMessage || 'Checkout failed. Please try again.');
                }
            },
        });
    };

    return (
        <>
            <Head title="Point of Sale" />
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                {/* Left Sidebar - Desktop Only */}
                <div className="hidden lg:flex lg:w-[7%] lg:flex-col lg:items-center lg:py-4 lg:bg-white lg:border-r lg:border-slate-200">
                    <Button
                        variant={selectedCategoryId === null ? "default" : "ghost"}
                        className={`w-20 h-20 mb-2 flex flex-col items-center justify-center ${
                            selectedCategoryId === null ? 'bg-blue-600 text-white' : ''
                        }`}
                        onClick={() => setSelectedCategoryId(null)}
                    >
                        <Home className="h-6 w-6 mb-1" />
                        <span className="text-xs">All</span>
                    </Button>
                    {categories.map((category) => (
                        <Button
                            key={category.id}
                            variant={selectedCategoryId === category.id ? "default" : "ghost"}
                            className={`w-20 h-20 mb-2 flex flex-col items-center justify-center ${
                                selectedCategoryId === category.id ? 'bg-blue-600 text-white' : ''
                            }`}
                            onClick={() => setSelectedCategoryId(category.id)}
                        >
                            <Package className="h-6 w-6 mb-1" />
                            <span className="text-xs text-center">{category.name}</span>
                        </Button>
                    ))}
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
                                variant={selectedCategoryId === null ? "default" : "outline"}
                                size="sm"
                                className={selectedCategoryId === null ? 'bg-blue-600 text-white' : ''}
                                onClick={() => setSelectedCategoryId(null)}
                            >
                                All
                            </Button>
                            {categories.map((category) => (
                                <Button
                                    key={category.id}
                                    variant={selectedCategoryId === category.id ? "default" : "outline"}
                                    size="sm"
                                    className={selectedCategoryId === category.id ? 'bg-blue-600 text-white' : ''}
                                    onClick={() => setSelectedCategoryId(category.id)}
                                >
                                    {category.name}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                type="text"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.visit('/')}
                            >
                                <Truck className="h-4 w-4 mr-1" />
                                Deliveries
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

                    {/* Product Grid */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {filteredProducts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {filteredProducts.flatMap((product) => 
                                    product.variants.map((variant) => {
                                        const stock = variant.inventory?.quantity_on_hand ?? 0;
                                        const price = variant.unit_price;
                                        const isOutOfStock = stock <= 0;
                                        
                                        return (
                                            <div
                                                key={`${product.id}-${variant.id}`}
                                                className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer transform hover:scale-[1.02] border border-slate-200 flex flex-col ${
                                                    isOutOfStock ? 'opacity-60' : ''
                                                }`}
                                                onClick={() => !isOutOfStock && addToCart(product, variant)}
                                            >
                                                {/* Image Section - Aspect ratio container for consistent sizing */}
                                                <div className="aspect-square bg-slate-100 rounded-t-lg flex items-center justify-center relative overflow-hidden">
                                                    {product.image ? (
                                                        <img
                                                            src={`/storage/${product.image}`}
                                                            alt={product.name}
                                                            className="absolute inset-0 w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <Package className="h-16 w-16 text-slate-400" />
                                                    )}
                                                    {isOutOfStock && (
                                                        <div className="absolute inset-0 bg-red-50 bg-opacity-80 flex items-center justify-center z-10">
                                                            <div className="text-center">
                                                                <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-1" />
                                                                <span className="text-xs font-semibold text-red-600">Out of Stock</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Content Section */}
                                                <div className="p-3 flex flex-col">
                                                    <h3 className="font-semibold text-slate-900 text-sm line-clamp-1 mb-0.5">
                                                        {product.name}
                                                    </h3>
                                                    {variant.description && (
                                                        <p className="text-xs text-slate-600 font-medium line-clamp-1">{variant.description}</p>
                                                    )}
                                                    <div className="mt-2 flex items-center justify-between">
                                                        <span className="text-base font-bold text-slate-900">
                                                            ₱{formatCurrency(price)}
                                                        </span>
                                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                                            stock > 5 
                                                                ? 'bg-green-100 text-green-700' 
                                                                : stock > 0 
                                                                ? 'bg-yellow-100 text-yellow-700' 
                                                                : 'bg-red-100 text-red-700'
                                                        }`}>
                                                            {stock} {product.base_unit}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <Package className="h-16 w-16 mb-4 opacity-50" />
                                <p className="text-lg">No products found</p>
                                <p className="text-sm">Try adjusting your search or category filter</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop Cart Panel */}
                <div className="hidden lg:flex lg:w-[28%] bg-white border-l border-slate-200 flex-col h-screen">
                    <div className="flex-shrink-0 p-5 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
                            <span className="text-sm text-slate-500">{currentTime}</span>
                        </div>
                        <p className="text-sm text-slate-600">{cart.length} item(s)</p>
                    </div>

                    {cart.length > 0 ? (
                        <>
                            <div className={`${itemsCollapsed ? 'flex-shrink-0' : 'flex-1'} overflow-y-auto p-5 border-b border-slate-200`}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-slate-900">Items ({cart.length})</h3>
                                    <button
                                        onClick={() => setItemsCollapsed(!itemsCollapsed)}
                                        className="text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                        {itemsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                    </button>
                                </div>
                                {!itemsCollapsed && (
                                <div className="space-y-4">
                                    {cart.map((item, index) => (
                                        <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200 relative">
                                            <button
                                                onClick={() => removeFromCart(index)}
                                                className="absolute top-3 right-3 text-slate-400 hover:text-red-600 transition-colors"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                            <div className="flex gap-4 pr-8">
                                                <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                    {item.image ? (
                                                        <img
                                                            src={`/storage/${item.image}`}
                                                            alt={item.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <Package className="h-6 w-6 text-slate-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-sm text-slate-900 truncate mb-1">{item.name}</h4>
                                                    <p className="text-xs text-slate-500 truncate mb-1">{item.description}</p>
                                                    <p className="text-xs text-slate-600 mb-3">₱{formatCurrency(item.unitPrice)} per {item.unit}</p>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                updateQuantity(index, -0.50);
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
                                                                updateQuantity(index, 0.50);
                                                            }}
                                                            className="w-7 h-7 rounded bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-colors"
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        ₱{formatCurrency(item.unitPrice * item.quantity)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                )}
                            </div>

                            <div className="flex-1 border-t border-slate-200 bg-white p-5 space-y-5 overflow-y-auto">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-slate-900">Payment & Details</h3>
                                    <button
                                        onClick={() => setFieldsCollapsed(!fieldsCollapsed)}
                                        className="text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                        {fieldsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                    </button>
                                </div>
                                {!fieldsCollapsed && (
                                <>
                                {/* Totals */}
                                <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Subtotal</span>
                                    <span className="text-slate-900">₱{formatCurrency(cartTotals.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold pt-3 border-t border-slate-200">
                                    <span className="text-slate-900">Total</span>
                                    <span className="text-slate-900">₱{formatCurrency(cartTotals.total)}</span>
                                </div>
                                </div>

                                {/* Payment Section */}
                                <div className="space-y-4 pt-3 border-t border-slate-200">
                                {/* Payment Method */}
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                                        Payment Method
                                    </label>
                                    <Select
                                        value={paymentMethod}
                                        onValueChange={(value: 'cash' | 'gcash' | 'cheque' | 'credit') => setPaymentMethod(value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select payment method" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Cash</SelectItem>
                                            <SelectItem value="gcash">GCash</SelectItem>
                                            <SelectItem value="cheque">Cheque</SelectItem>
                                            <SelectItem value="credit">Credit</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Amount Received */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Amount Received
                                        </label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs"
                                            onClick={() => setAmountReceived(cartTotals.total.toFixed(2))}
                                        >
                                            Exact
                                        </Button>
                                    </div>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            type="number"
                                            step="0.50"
                                            min="0"
                                            placeholder="0.00"
                                            value={amountReceived}
                                            onChange={(e) => setAmountReceived(e.target.value)}
                                            className="pl-10"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && paymentDetails.isComplete) {
                                                    handleCheckout();
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Payment Status */}
                                {amountReceived && (
                                    <div className="space-y-3">
                                        {paymentDetails.hasChange && (
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium text-green-800">Change Due</span>
                                                    <span className="text-lg font-bold text-green-900">
                                                        ₱{formatCurrency(paymentDetails.change)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {paymentDetails.isPartial && (
                                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-sm font-medium text-yellow-800">Partial Payment</span>
                                                    <span className="text-sm text-yellow-900">
                                                        Paid: ₱{formatCurrency(paymentDetails.received)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center pt-2 border-t border-yellow-300">
                                                    <span className="text-sm text-yellow-700">Balance Remaining</span>
                                                    <span className="text-lg font-bold text-yellow-900">
                                                        ₱{formatCurrency(paymentDetails.balance)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {paymentDetails.isExact && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium text-blue-800">Exact Payment</span>
                                                    <span className="text-sm text-blue-900">No change needed</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* For Delivery Checkbox */}
                                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                                    <input
                                        type="checkbox"
                                        id="is_for_delivery"
                                        checked={isForDelivery}
                                        onChange={(e) => setIsForDelivery(e.target.checked)}
                                        className="rounded"
                                    />
                                    <label htmlFor="is_for_delivery" className="text-sm font-medium text-slate-700 cursor-pointer">
                                        This sale is for delivery
                                    </label>
                                </div>

                                {/* Delivery Details - Only show when isForDelivery is true */}
                                {isForDelivery && (
                                    <div className="space-y-3 pt-2 border-t border-slate-200">
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 mb-2 block">
                                                Deliver To (Name) *
                                            </label>
                                            <Input
                                                type="text"
                                                placeholder="Enter recipient name"
                                                value={deliveryName}
                                                onChange={(e) => setDeliveryName(e.target.value)}
                                                required={isForDelivery}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 mb-2 block">
                                                Address *
                                            </label>
                                            <textarea
                                                placeholder="Brgy. San Isidro, Purok 3&#10;Calauan, Laguna"
                                                value={deliveryAddress}
                                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                rows={3}
                                                required={isForDelivery}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 mb-2 block">
                                                Contact Number *
                                            </label>
                                            <Input
                                                type="text"
                                                placeholder="0917-xxx-xxxx"
                                                value={deliveryContact}
                                                onChange={(e) => setDeliveryContact(e.target.value)}
                                                required={isForDelivery}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Notes */}
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                                        Notes (Optional)
                                    </label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                        <textarea
                                            placeholder="Add notes for this sale..."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-3 border-t border-slate-200">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        clearCart();
                                        setAmountReceived('');
                                        setPaymentMethod('cash');
                                        setIsForDelivery(false);
                                        setNotes('');
                                        setDeliveryName('');
                                        setDeliveryAddress('');
                                        setDeliveryContact('');
                                    }}
                                >
                                    Clear Cart
                                </Button>
                                <Button
                                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    onClick={handleCheckout}
                                    disabled={isProcessing || cart.length === 0}
                                >
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Checkout
                                </Button>
                            </div>
                                </>
                                )}
                        </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16">
                            <ShoppingCart className="h-16 w-16 mb-4 opacity-50" />
                            <p className="text-sm">Your cart is empty</p>
                        </div>
                    )}
                </div>

                {/* Mobile Cart Sheet */}
                <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
                    <SheetContent side="right" className="w-full sm:max-w-sm md:max-w-md flex flex-col p-0">
                        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-200">
                            <SheetHeader>
                                <SheetTitle className="text-lg font-semibold">Order Summary</SheetTitle>
                                {cart.length > 0 && (
                                    <p className="text-sm text-slate-600 mt-1">{cart.length} item(s)</p>
                                )}
                            </SheetHeader>
                        </div>
                        
                        {cart.length > 0 ? (
                            <>
                                <div className={`${itemsCollapsed ? 'flex-shrink-0' : 'flex-1'} overflow-y-auto px-6 py-4 border-b border-slate-200`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-slate-900">Items ({cart.length})</h3>
                                        <button
                                            onClick={() => setItemsCollapsed(!itemsCollapsed)}
                                            className="text-slate-500 hover:text-slate-700 transition-colors"
                                        >
                                            {itemsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {!itemsCollapsed && (
                                    <div className="space-y-3 sm:space-y-4">
                                        {cart.map((item, index) => (
                                            <div key={index} className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200 relative">
                                                <button
                                                    onClick={() => removeFromCart(index)}
                                                    className="absolute top-2 right-2 sm:top-3 sm:right-3 text-slate-400 hover:text-red-600 active:text-red-700 transition-colors touch-manipulation"
                                                    aria-label="Remove item"
                                                >
                                                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                                                </button>
                                                <div className="flex gap-3 sm:gap-4 pr-8 sm:pr-10">
                                                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-200 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        {item.image ? (
                                                            <img
                                                                src={`/storage/${item.image}`}
                                                                alt={item.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <Package className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-sm text-slate-900 truncate mb-1">{item.name}</h4>
                                                        <p className="text-xs text-slate-500 truncate mb-1">{item.description}</p>
                                                        <p className="text-xs text-slate-600 mb-2 sm:mb-3">₱{formatCurrency(item.unitPrice)} per {item.unit}</p>
                                                        <div className="flex items-center gap-2 sm:gap-3">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    updateQuantity(index, -0.50);
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
                                                                    updateQuantity(index, 0.50);
                                                                }}
                                                                className="w-8 h-8 sm:w-9 sm:h-9 rounded bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center transition-colors touch-manipulation"
                                                                aria-label="Increase quantity"
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            ₱{formatCurrency(item.unitPrice * item.quantity)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    )}
                                </div>

                                <div className="flex-1 border-t border-slate-200 px-6 py-4 space-y-4 bg-white overflow-y-auto">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-slate-900">Payment & Details</h3>
                                        <button
                                            onClick={() => setFieldsCollapsed(!fieldsCollapsed)}
                                            className="text-slate-500 hover:text-slate-700 transition-colors"
                                        >
                                            {fieldsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {!fieldsCollapsed && (
                                    <>
                                    {/* Totals */}
                                    <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Subtotal</span>
                                        <span className="text-slate-900 font-medium">₱{formatCurrency(cartTotals.subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-base sm:text-lg font-bold pt-2 border-t border-slate-200">
                                        <span className="text-slate-900">Total</span>
                                        <span className="text-slate-900">₱{formatCurrency(cartTotals.total)}</span>
                                    </div>
                                </div>

                                {/* Payment Section */}
                                <div className="space-y-3 pt-2 border-t border-slate-200">
                                    {/* Payment Method */}
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                            Payment Method
                                        </label>
                                        <Select
                                            value={paymentMethod}
                                            onValueChange={(value: 'cash' | 'gcash' | 'cheque' | 'credit') => setPaymentMethod(value)}
                                        >
                                            <SelectTrigger className="h-10 sm:h-11">
                                                <SelectValue placeholder="Select payment method" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="cash">Cash</SelectItem>
                                                <SelectItem value="gcash">GCash</SelectItem>
                                                <SelectItem value="cheque">Cheque</SelectItem>
                                                <SelectItem value="credit">Credit</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Amount Received */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-sm font-medium text-slate-700">
                                                Amount Received
                                            </label>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs px-2"
                                                onClick={() => setAmountReceived(cartTotals.total.toFixed(2))}
                                            >
                                                Exact
                                            </Button>
                                        </div>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                type="number"
                                                step="0.50"
                                                min="0"
                                                placeholder="0.00"
                                                value={amountReceived}
                                                onChange={(e) => setAmountReceived(e.target.value)}
                                                className="pl-10 h-10 sm:h-11 text-base"
                                            />
                                        </div>
                                    </div>

                                    {/* Payment Status */}
                                    {amountReceived && (
                                        <div className="space-y-2">
                                            {paymentDetails.hasChange && (
                                                <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-medium text-green-800">Change Due</span>
                                                        <span className="text-base sm:text-lg font-bold text-green-900">
                                                            ₱{formatCurrency(paymentDetails.change)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            {paymentDetails.isPartial && (
                                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
                                                    <div className="flex justify-between items-center mb-1.5">
                                                        <span className="text-sm font-medium text-yellow-800">Partial Payment</span>
                                                        <span className="text-xs sm:text-sm text-yellow-900">
                                                            Paid: ₱{formatCurrency(paymentDetails.received)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-1.5 border-t border-yellow-300">
                                                        <span className="text-sm text-yellow-700">Balance Remaining</span>
                                                        <span className="text-base sm:text-lg font-bold text-yellow-900">
                                                            ₱{formatCurrency(paymentDetails.balance)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            {paymentDetails.isExact && (
                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-medium text-blue-800">Exact Payment</span>
                                                        <span className="text-xs sm:text-sm text-blue-900">No change needed</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* For Delivery Checkbox */}
                                    <div className="flex items-center gap-2 p-2.5 sm:p-3 bg-slate-50 rounded-lg">
                                        <input
                                            type="checkbox"
                                            id="is_for_delivery_mobile"
                                            checked={isForDelivery}
                                            onChange={(e) => setIsForDelivery(e.target.checked)}
                                            className="rounded w-4 h-4 sm:w-5 sm:h-5"
                                        />
                                        <label htmlFor="is_for_delivery_mobile" className="text-sm font-medium text-slate-700 cursor-pointer">
                                            This sale is for delivery
                                        </label>
                                    </div>

                                    {/* Delivery Details - Only show when isForDelivery is true */}
                                    {isForDelivery && (
                                        <div className="space-y-2.5 sm:space-y-3 pt-2 border-t border-slate-200">
                                            <div>
                                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                                    Deliver To (Name) *
                                                </label>
                                                <Input
                                                    type="text"
                                                    placeholder="Enter recipient name"
                                                    value={deliveryName}
                                                    onChange={(e) => setDeliveryName(e.target.value)}
                                                    className="h-10 sm:h-11 text-base"
                                                    required={isForDelivery}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                                    Address *
                                                </label>
                                                <textarea
                                                    placeholder="Brgy. San Isidro, Purok 3&#10;Calauan, Laguna"
                                                    value={deliveryAddress}
                                                    onChange={(e) => setDeliveryAddress(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    rows={3}
                                                    required={isForDelivery}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                                    Contact Number *
                                                </label>
                                                <Input
                                                    type="text"
                                                    placeholder="0917-xxx-xxxx"
                                                    value={deliveryContact}
                                                    onChange={(e) => setDeliveryContact(e.target.value)}
                                                    className="h-10 sm:h-11 text-base"
                                                    required={isForDelivery}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Notes */}
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                            Notes (Optional)
                                        </label>
                                        <div className="relative">
                                            <FileText className="absolute left-3 top-2.5 sm:top-3 h-4 w-4 text-slate-400" />
                                            <textarea
                                                placeholder="Add notes for this sale..."
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 sm:gap-3 pt-2 border-t border-slate-200">
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-11 sm:h-12 text-sm sm:text-base"
                                        onClick={() => {
                                            clearCart();
                                            setAmountReceived('');
                                            setPaymentMethod('cash');
                                            setIsForDelivery(false);
                                            setNotes('');
                                            setDeliveryName('');
                                            setDeliveryAddress('');
                                            setDeliveryContact('');
                                        }}
                                    >
                                        Clear Cart
                                    </Button>
                                    <Button
                                        className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-blue-600 hover:bg-blue-700"
                                        onClick={() => {
                                            setIsMobileCartOpen(false);
                                            handleCheckout();
                                        }}
                                        disabled={isProcessing || cart.length === 0}
                                    >
                                        <CreditCard className="h-4 w-4 mr-2" />
                                        Checkout
                                    </Button>
                                </div>
                                    </>
                                    )}
                            </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16">
                                <ShoppingCart className="h-16 w-16 mb-4 opacity-50" />
                                <p className="text-sm">Your cart is empty</p>
                            </div>
                        )}
                    </SheetContent>
                </Sheet>

                {/* PIN Authentication Dialog */}
                <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Enter PIN</DialogTitle>
                            <DialogDescription>
                                Please enter your PIN to complete the transaction.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
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
                                        e.preventDefault();
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
                                type="button"
                                onClick={(e) => handlePinSubmit(e)}
                                disabled={isProcessing}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isProcessing ? 'Processing...' : 'Confirm'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
