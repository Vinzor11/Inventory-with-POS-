import { PosSectionNav } from '@/components/pos-section-nav';
import { ProductImage } from '@/components/product-image';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { formatCurrency } from '@/lib/format-currency';
import { toast } from '@/lib/toast';
import { type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    CreditCard,
    DollarSign,
    FileText,
    Home,
    LayoutGrid,
    LogIn,
    Minus,
    Package,
    Plus,
    Scale,
    Search,
    ShoppingCart,
    SlidersHorizontal,
    Truck,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

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

interface PosCatalogItem {
    product: Product;
    variant: ProductVariant;
    availableStock: number;
}

interface PosProps {
    categories: ProductCategory[];
    products: Product[];
}

export default function Pos({ categories, products }: PosProps) {
    const { auth } = usePage<SharedData>().props;
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
        null,
    );
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [amountReceived, setAmountReceived] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<
        'cash' | 'gcash' | 'cheque' | 'credit'
    >('cash');
    const [isForDelivery, setIsForDelivery] = useState(false);
    const [notes, setNotes] = useState('');
    const [deliveryName, setDeliveryName] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryContact, setDeliveryContact] = useState('');
    const [itemsCollapsed, setItemsCollapsed] = useState(false);
    const [fieldsCollapsed, setFieldsCollapsed] = useState(false);

    // POS sorting: highest stock first, then A-Z by product/variant.
    const filteredProductVariants = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return products
            .filter(
                (product) =>
                    !selectedCategoryId ||
                    product.category.id === selectedCategoryId,
            )
            .flatMap((product) =>
                product.variants.map((variant) => ({
                    product,
                    variant,
                    availableStock: variant.inventory?.quantity_on_hand ?? 0,
                })),
            )
            .filter((item) => {
                if (!query) {
                    return true;
                }

                return (
                    item.product.name.toLowerCase().includes(query) ||
                    item.product.brand?.toLowerCase().includes(query) ||
                    item.product.sku?.toLowerCase().includes(query) ||
                    item.variant.description.toLowerCase().includes(query)
                );
            })
            .sort((a: PosCatalogItem, b: PosCatalogItem) => {
                if (b.availableStock !== a.availableStock) {
                    return b.availableStock - a.availableStock;
                }

                const productOrder = a.product.name.localeCompare(
                    b.product.name,
                    undefined,
                    { sensitivity: 'base' },
                );
                if (productOrder !== 0) {
                    return productOrder;
                }

                return a.variant.description.localeCompare(
                    b.variant.description,
                    undefined,
                    { sensitivity: 'base' },
                );
            });
    }, [products, searchTerm, selectedCategoryId]);

    // Calculate cart totals (no tax per requirements)
    const cartTotals = useMemo(() => {
        const subtotal = cart.reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0,
        );
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
            minute: '2-digit',
        });
    }, []);

    // Add product variant to cart
    const addToCart = (product: Product, variant: ProductVariant) => {
        const stock = variant.inventory?.quantity_on_hand ?? 0;

        // Check if item already exists in cart
        const existingItemIndex = cart.findIndex(
            (item) => item.productVariantId === variant.id,
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
        const newQuantity = Math.max(0.5, newCart[index].quantity + change);

        // Check stock availability
        if (newQuantity > newCart[index].stock) {
            toast.error(
                `Insufficient stock. Available: ${newCart[index].stock}`,
            );
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
        const items = cart.map((item) => ({
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
                    const pinError = Array.isArray(errors.pin)
                        ? errors.pin[0]
                        : errors.pin;
                    setPinError(pinError);
                } else if (errors.checkout) {
                    const checkoutError = Array.isArray(errors.checkout)
                        ? errors.checkout[0]
                        : errors.checkout;
                    setPinError(checkoutError);
                } else if (errors.items) {
                    setPinError('Invalid cart items');
                } else {
                    const firstError = Object.values(errors)[0];
                    const errorMessage = Array.isArray(firstError)
                        ? firstError[0]
                        : firstError;
                    setPinError(
                        errorMessage || 'Checkout failed. Please try again.',
                    );
                }
            },
        });
    };

    return (
        <>
            <Head title="Point of Sale" />
            <div className="flex h-screen overflow-hidden bg-slate-50">
                {/* Left Sidebar - Desktop Only */}
                <div className="hidden lg:flex lg:w-[7%] lg:flex-col lg:items-center lg:border-r lg:border-slate-200 lg:bg-white lg:py-4">
                    <Button
                        variant={
                            selectedCategoryId === null ? 'default' : 'ghost'
                        }
                        className={`mb-2 flex h-20 w-20 flex-col items-center justify-center ${
                            selectedCategoryId === null
                                ? 'bg-blue-600 text-white'
                                : ''
                        }`}
                        onClick={() => setSelectedCategoryId(null)}
                    >
                        <Home className="mb-1 h-6 w-6" />
                        <span className="text-xs">All</span>
                    </Button>
                    {categories.map((category) => (
                        <Button
                            key={category.id}
                            variant={
                                selectedCategoryId === category.id
                                    ? 'default'
                                    : 'ghost'
                            }
                            className={`mb-2 flex h-20 w-20 flex-col items-center justify-center ${
                                selectedCategoryId === category.id
                                    ? 'bg-blue-600 text-white'
                                    : ''
                            }`}
                            onClick={() => setSelectedCategoryId(category.id)}
                        >
                            <Package className="mb-1 h-6 w-6" />
                            <span className="text-center text-xs">
                                {category.name}
                            </span>
                        </Button>
                    ))}
                    <div className="mt-auto">
                        <Button
                            variant="ghost"
                            className="flex h-20 w-20 flex-col items-center justify-center"
                            onClick={() =>
                                router.visit(
                                    auth.user ? '/dashboard' : '/login',
                                )
                            }
                        >
                            {auth.user ? (
                                <>
                                    <LayoutGrid className="mb-1 h-6 w-6" />
                                    <span className="text-xs">Dashboard</span>
                                </>
                            ) : (
                                <>
                                    <LogIn className="mb-1 h-6 w-6" />
                                    <span className="text-xs">Login</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:w-[64%]">
                    {/* Search and Filter */}
                    <div className="border-b border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="relative min-w-0 flex-1">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder="Search products..."
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
                                    className="app-search-surface h-10 pl-10"
                                />
                            </div>
                            <div className="shrink-0 lg:hidden">
                                <Select
                                    value={
                                        selectedCategoryId === null
                                            ? 'all'
                                            : selectedCategoryId.toString()
                                    }
                                    onValueChange={(value) =>
                                        setSelectedCategoryId(
                                            value === 'all'
                                                ? null
                                                : Number(value),
                                        )
                                    }
                                >
                                    <SelectTrigger
                                        className="h-10 w-10 justify-center rounded-lg border border-slate-300 bg-white p-0 text-slate-500 shadow-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary/20 [&>svg]:hidden"
                                        aria-label="Filter by category"
                                    >
                                        <div className="relative">
                                            <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                                            {selectedCategoryId !== null && (
                                                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                                            )}
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                        <SelectItem value="all">
                                            All Categories
                                        </SelectItem>
                                        {categories.map((category) => (
                                            <SelectItem
                                                key={category.id}
                                                value={category.id.toString()}
                                            >
                                                {category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="hidden items-center gap-2 lg:flex">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.visit('/')}
                                >
                                    <Truck className="mr-1 h-4 w-4" />
                                    Deliveries
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        router.visit('/weigh-ins-landing')
                                    }
                                >
                                    <Scale className="mr-1 h-4 w-4" />
                                    Weigh-Ins
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="flex-1 overflow-y-auto p-4 pb-36 lg:pb-4">
                        {filteredProductVariants.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {filteredProductVariants.map((item) => {
                                    const { product, variant, availableStock } =
                                        item;
                                    const price = variant.unit_price;
                                    const isOutOfStock = availableStock <= 0;

                                    return (
                                        <div
                                            key={`${product.id}-${variant.id}`}
                                            className={`flex w-full flex-col rounded-lg border-2 border-slate-200 bg-white shadow-sm transition-all duration-200 ${
                                                isOutOfStock
                                                    ? 'cursor-not-allowed opacity-60'
                                                    : 'transform cursor-pointer hover:scale-[1.02] hover:shadow-md'
                                            }`}
                                            onClick={() =>
                                                !isOutOfStock &&
                                                addToCart(product, variant)
                                            }
                                        >
                                            {/* Image Section - Aspect ratio container for consistent sizing */}
                                            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-t-lg bg-slate-100">
                                                <ProductImage
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="absolute inset-0 h-full w-full object-cover"
                                                    fallbackClassName="absolute inset-0"
                                                />
                                                {isOutOfStock && (
                                                    <div className="bg-opacity-80 absolute inset-0 z-10 flex items-center justify-center bg-red-50">
                                                        <div className="text-center">
                                                            <AlertTriangle className="mx-auto mb-1 h-8 w-8 text-red-600" />
                                                            <span className="text-xs font-semibold text-red-600">
                                                                Out of Stock
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content Section */}
                                            <div className="p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="mb-0.5 line-clamp-1 text-base font-semibold text-slate-900">
                                                            {product.name}
                                                        </h3>
                                                        {variant.description && (
                                                            <p className="line-clamp-1 text-xs text-slate-500">
                                                                {
                                                                    variant.description
                                                                }
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="shrink-0 text-right">
                                                        <p className="text-base font-bold whitespace-nowrap text-slate-900">
                                                            {'\u20B1'}
                                                            {formatCurrency(
                                                                price,
                                                            )}{' '}
                                                            <span className="text-xs font-normal text-slate-500">
                                                                /
                                                                {
                                                                    product.base_unit
                                                                }
                                                            </span>
                                                        </p>
                                                        <p
                                                            className={`mt-1 text-xs font-medium whitespace-nowrap ${
                                                                availableStock >
                                                                5
                                                                    ? 'text-green-700'
                                                                    : availableStock >
                                                                        0
                                                                      ? 'text-yellow-700'
                                                                      : 'text-red-600'
                                                            }`}
                                                        >
                                                            {availableStock > 0
                                                                ? `${availableStock} ${product.base_unit} available`
                                                                : 'Out of stock'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center text-slate-500">
                                <Package className="mb-4 h-16 w-16 opacity-50" />
                                <p className="text-lg">No products found</p>
                                <p className="text-sm">
                                    Try adjusting your search or category filter
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop Cart Panel */}
                <div className="hidden h-screen flex-col border-l border-slate-200 bg-white lg:flex lg:w-[28%]">
                    <div className="flex-shrink-0 border-b border-slate-200 p-5">
                        <div className="mb-2 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">
                                Order Summary
                            </h2>
                            <span className="text-sm text-slate-500">
                                {currentTime}
                            </span>
                        </div>
                        <p className="text-sm text-slate-600">
                            {cart.length} item(s)
                        </p>
                    </div>

                    {cart.length > 0 ? (
                        <>
                            <div
                                className={`${itemsCollapsed ? 'flex-shrink-0' : 'flex-1'} overflow-y-auto border-b border-slate-200 p-5`}
                            >
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-900">
                                        Items ({cart.length})
                                    </h3>
                                    <button
                                        onClick={() =>
                                            setItemsCollapsed(!itemsCollapsed)
                                        }
                                        className="text-slate-500 transition-colors hover:text-slate-700"
                                    >
                                        {itemsCollapsed ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronUp className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                {!itemsCollapsed && (
                                    <div className="space-y-4">
                                        {cart.map((item, index) => (
                                            <div
                                                key={index}
                                                className="relative rounded-lg border border-slate-200 bg-slate-50 p-4"
                                            >
                                                <button
                                                    onClick={() =>
                                                        removeFromCart(index)
                                                    }
                                                    className="absolute top-3 right-3 text-slate-400 transition-colors hover:text-red-600"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                                <div className="flex gap-4 pr-8">
                                                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-slate-200">
                                                        <ProductImage
                                                            src={item.image}
                                                            alt={item.name}
                                                            className="h-full w-full object-cover"
                                                            fallbackClassName="w-full h-full"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="mb-1 truncate text-sm font-medium text-slate-900">
                                                            {item.name}
                                                        </h4>
                                                        <p className="mb-1 truncate text-xs text-slate-500">
                                                            {item.description}
                                                        </p>
                                                        <p className="mb-3 text-xs text-slate-600">
                                                            ₱
                                                            {formatCurrency(
                                                                item.unitPrice,
                                                            )}{' '}
                                                            per {item.unit}
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(
                                                                    e,
                                                                ) => {
                                                                    e.stopPropagation();
                                                                    updateQuantity(
                                                                        index,
                                                                        -0.5,
                                                                    );
                                                                }}
                                                                className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white transition-colors hover:bg-slate-50"
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </button>
                                                            <span className="min-w-[2rem] text-center text-sm font-medium">
                                                                {item.quantity.toFixed(
                                                                    2,
                                                                )}
                                                            </span>
                                                            <button
                                                                onClick={(
                                                                    e,
                                                                ) => {
                                                                    e.stopPropagation();
                                                                    updateQuantity(
                                                                        index,
                                                                        0.5,
                                                                    );
                                                                }}
                                                                className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white transition-colors hover:bg-slate-50"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            ₱
                                                            {formatCurrency(
                                                                item.unitPrice *
                                                                    item.quantity,
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 space-y-5 overflow-y-auto border-t border-slate-200 bg-white p-5">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-900">
                                        Payment & Details
                                    </h3>
                                    <button
                                        onClick={() =>
                                            setFieldsCollapsed(!fieldsCollapsed)
                                        }
                                        className="text-slate-500 transition-colors hover:text-slate-700"
                                    >
                                        {fieldsCollapsed ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronUp className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                {!fieldsCollapsed && (
                                    <>
                                        {/* Totals */}
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">
                                                    Subtotal
                                                </span>
                                                <span className="text-slate-900">
                                                    ₱
                                                    {formatCurrency(
                                                        cartTotals.subtotal,
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-bold">
                                                <span className="text-slate-900">
                                                    Total
                                                </span>
                                                <span className="text-slate-900">
                                                    ₱
                                                    {formatCurrency(
                                                        cartTotals.total,
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Payment Section */}
                                        <div className="space-y-4 border-t border-slate-200 pt-3">
                                            {/* Payment Method */}
                                            <div>
                                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                                    Payment Method
                                                </label>
                                                <Select
                                                    value={paymentMethod}
                                                    onValueChange={(
                                                        value:
                                                            | 'cash'
                                                            | 'gcash'
                                                            | 'cheque'
                                                            | 'credit',
                                                    ) =>
                                                        setPaymentMethod(value)
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select payment method" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="cash">
                                                            Cash
                                                        </SelectItem>
                                                        <SelectItem value="gcash">
                                                            GCash
                                                        </SelectItem>
                                                        <SelectItem value="cheque">
                                                            Cheque
                                                        </SelectItem>
                                                        <SelectItem value="credit">
                                                            Credit
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Amount Received */}
                                            <div>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <label className="text-sm font-medium text-slate-700">
                                                        Amount Received
                                                    </label>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 text-xs"
                                                        onClick={() =>
                                                            setAmountReceived(
                                                                cartTotals.total.toFixed(
                                                                    2,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        Exact
                                                    </Button>
                                                </div>
                                                <div className="relative">
                                                    <DollarSign className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                                                    <Input
                                                        type="number"
                                                        step="0.50"
                                                        min="0"
                                                        placeholder="0.00"
                                                        value={amountReceived}
                                                        onChange={(e) =>
                                                            setAmountReceived(
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="pl-10"
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key ===
                                                                    'Enter' &&
                                                                paymentDetails.isComplete
                                                            ) {
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
                                                        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-medium text-green-800">
                                                                    Change Due
                                                                </span>
                                                                <span className="text-lg font-bold text-green-900">
                                                                    ₱
                                                                    {formatCurrency(
                                                                        paymentDetails.change,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {paymentDetails.isPartial && (
                                                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                                                            <div className="mb-2 flex items-center justify-between">
                                                                <span className="text-sm font-medium text-yellow-800">
                                                                    Partial
                                                                    Payment
                                                                </span>
                                                                <span className="text-sm text-yellow-900">
                                                                    Paid: ₱
                                                                    {formatCurrency(
                                                                        paymentDetails.received,
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between border-t border-yellow-300 pt-2">
                                                                <span className="text-sm text-yellow-700">
                                                                    Balance
                                                                    Remaining
                                                                </span>
                                                                <span className="text-lg font-bold text-yellow-900">
                                                                    ₱
                                                                    {formatCurrency(
                                                                        paymentDetails.balance,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {paymentDetails.isExact && (
                                                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-medium text-blue-800">
                                                                    Exact
                                                                    Payment
                                                                </span>
                                                                <span className="text-sm text-blue-900">
                                                                    No change
                                                                    needed
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* For Delivery Checkbox */}
                                            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
                                                <input
                                                    type="checkbox"
                                                    id="is_for_delivery"
                                                    checked={isForDelivery}
                                                    onChange={(e) => {
                                                        const nextIsForDelivery =
                                                            e.target.checked;
                                                        setIsForDelivery(
                                                            nextIsForDelivery,
                                                        );
                                                        if (
                                                            nextIsForDelivery
                                                        ) {
                                                            setItemsCollapsed(
                                                                true,
                                                            );
                                                        }
                                                    }}
                                                    className="rounded"
                                                />
                                                <label
                                                    htmlFor="is_for_delivery"
                                                    className="cursor-pointer text-sm font-medium text-slate-700"
                                                >
                                                    This sale is for delivery
                                                </label>
                                            </div>

                                            {/* Delivery Details - Only show when isForDelivery is true */}
                                            {isForDelivery && (
                                                <div className="space-y-3 border-t border-slate-200 pt-2">
                                                    <div>
                                                        <label className="mb-2 block text-sm font-medium text-slate-700">
                                                            Deliver To (Name) *
                                                        </label>
                                                        <Input
                                                            type="text"
                                                            placeholder="Enter recipient name"
                                                            value={deliveryName}
                                                            onChange={(e) =>
                                                                setDeliveryName(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            required={
                                                                isForDelivery
                                                            }
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-sm font-medium text-slate-700">
                                                            Address *
                                                        </label>
                                                        <textarea
                                                            placeholder="Brgy. San Isidro, Purok 3&#10;Calauan, Laguna"
                                                            value={
                                                                deliveryAddress
                                                            }
                                                            onChange={(e) =>
                                                                setDeliveryAddress(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                            rows={3}
                                                            required={
                                                                isForDelivery
                                                            }
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 block text-sm font-medium text-slate-700">
                                                            Contact Number *
                                                        </label>
                                                        <Input
                                                            type="text"
                                                            placeholder="0917-xxx-xxxx"
                                                            value={
                                                                deliveryContact
                                                            }
                                                            onChange={(e) =>
                                                                setDeliveryContact(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            required={
                                                                isForDelivery
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Notes */}
                                            <div>
                                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                                    Notes (Optional)
                                                </label>
                                                <div className="relative">
                                                    <FileText className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
                                                    <textarea
                                                        placeholder="Add notes for this sale..."
                                                        value={notes}
                                                        onChange={(e) =>
                                                            setNotes(
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="w-full resize-none rounded-md border border-slate-300 py-2 pr-3 pl-10 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                        rows={2}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-3 border-t border-slate-200 pt-3">
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
                                                disabled={
                                                    isProcessing ||
                                                    cart.length === 0
                                                }
                                            >
                                                <CreditCard className="mr-2 h-4 w-4" />
                                                Checkout
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center py-16 text-slate-500">
                            <ShoppingCart className="mb-4 h-16 w-16 opacity-50" />
                            <p className="text-sm">Your cart is empty</p>
                        </div>
                    )}
                </div>

                {!isMobileCartOpen && (
                    <button
                        type="button"
                        className="mobile-fab fixed right-4 bottom-20 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-xl hover:bg-green-700 active:bg-green-700 lg:hidden"
                        onClick={() => setIsMobileCartOpen(true)}
                        aria-label="Open cart"
                    >
                        <ShoppingCart className="h-6 w-6" />
                        {cart.length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                                {cart.length}
                            </span>
                        )}
                    </button>
                )}

                <PosSectionNav />

                {/* Mobile Cart Sheet */}
                <Sheet
                    open={isMobileCartOpen}
                    onOpenChange={setIsMobileCartOpen}
                >
                    <SheetContent
                        side="right"
                        className="flex w-full flex-col p-0 sm:max-w-sm md:max-w-md"
                    >
                        <div className="flex-shrink-0 border-b border-slate-200 px-6 pt-6 pb-4">
                            <SheetHeader>
                                <SheetTitle className="text-lg font-semibold">
                                    Order Summary
                                </SheetTitle>
                                {cart.length > 0 && (
                                    <p className="mt-1 text-sm text-slate-600">
                                        {cart.length} item(s)
                                    </p>
                                )}
                            </SheetHeader>
                        </div>

                        {cart.length > 0 ? (
                            <>
                                <div
                                    className={`${itemsCollapsed ? 'flex-shrink-0' : 'flex-1'} overflow-y-auto border-b border-slate-200 px-6 py-4`}
                                >
                                    <div className="mb-3 flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-slate-900">
                                            Items ({cart.length})
                                        </h3>
                                        <button
                                            onClick={() =>
                                                setItemsCollapsed(
                                                    !itemsCollapsed,
                                                )
                                            }
                                            className="text-slate-500 transition-colors hover:text-slate-700"
                                        >
                                            {itemsCollapsed ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronUp className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                    {!itemsCollapsed && (
                                        <div className="space-y-3 sm:space-y-4">
                                            {cart.map((item, index) => (
                                                <div
                                                    key={index}
                                                    className="relative rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4"
                                                >
                                                    <button
                                                        onClick={() =>
                                                            removeFromCart(
                                                                index,
                                                            )
                                                        }
                                                        className="absolute top-2 right-2 touch-manipulation text-slate-400 transition-colors hover:text-red-600 active:text-red-700 sm:top-3 sm:right-3"
                                                        aria-label="Remove item"
                                                    >
                                                        <X className="h-4 w-4 sm:h-5 sm:w-5" />
                                                    </button>
                                                    <div className="flex gap-3 pr-8 sm:gap-4 sm:pr-10">
                                                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-slate-200 sm:h-16 sm:w-16">
                                                            <ProductImage
                                                                src={item.image}
                                                                alt={item.name}
                                                                className="h-full w-full object-cover"
                                                                fallbackClassName="w-full h-full"
                                                            />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="mb-1 truncate text-sm font-medium text-slate-900">
                                                                {item.name}
                                                            </h4>
                                                            <p className="mb-1 truncate text-xs text-slate-500">
                                                                {
                                                                    item.description
                                                                }
                                                            </p>
                                                            <p className="mb-2 text-xs text-slate-600 sm:mb-3">
                                                                ₱
                                                                {formatCurrency(
                                                                    item.unitPrice,
                                                                )}{' '}
                                                                per {item.unit}
                                                            </p>
                                                            <div className="flex items-center gap-2 sm:gap-3">
                                                                <button
                                                                    onClick={(
                                                                        e,
                                                                    ) => {
                                                                        e.stopPropagation();
                                                                        updateQuantity(
                                                                            index,
                                                                            -0.5,
                                                                        );
                                                                    }}
                                                                    className="flex h-8 w-8 touch-manipulation items-center justify-center rounded border border-slate-200 bg-white transition-colors hover:bg-slate-50 active:bg-slate-100 sm:h-9 sm:w-9"
                                                                    aria-label="Decrease quantity"
                                                                >
                                                                    <Minus className="h-4 w-4" />
                                                                </button>
                                                                <span className="min-w-[3rem] text-center text-sm font-medium">
                                                                    {item.quantity.toFixed(
                                                                        2,
                                                                    )}
                                                                </span>
                                                                <button
                                                                    onClick={(
                                                                        e,
                                                                    ) => {
                                                                        e.stopPropagation();
                                                                        updateQuantity(
                                                                            index,
                                                                            0.5,
                                                                        );
                                                                    }}
                                                                    className="flex h-8 w-8 touch-manipulation items-center justify-center rounded border border-slate-200 bg-white transition-colors hover:bg-slate-50 active:bg-slate-100 sm:h-9 sm:w-9"
                                                                    aria-label="Increase quantity"
                                                                >
                                                                    <Plus className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-semibold text-slate-900">
                                                                ₱
                                                                {formatCurrency(
                                                                    item.unitPrice *
                                                                        item.quantity,
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 space-y-4 overflow-y-auto border-t border-slate-200 bg-white px-6 py-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-slate-900">
                                            Payment & Details
                                        </h3>
                                        <button
                                            onClick={() =>
                                                setFieldsCollapsed(
                                                    !fieldsCollapsed,
                                                )
                                            }
                                            className="text-slate-500 transition-colors hover:text-slate-700"
                                        >
                                            {fieldsCollapsed ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronUp className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                    {!fieldsCollapsed && (
                                        <>
                                            {/* Totals */}
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600">
                                                        Subtotal
                                                    </span>
                                                    <span className="font-medium text-slate-900">
                                                        ₱
                                                        {formatCurrency(
                                                            cartTotals.subtotal,
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold sm:text-lg">
                                                    <span className="text-slate-900">
                                                        Total
                                                    </span>
                                                    <span className="text-slate-900">
                                                        ₱
                                                        {formatCurrency(
                                                            cartTotals.total,
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Payment Section */}
                                            <div className="space-y-3 border-t border-slate-200 pt-2">
                                                {/* Payment Method */}
                                                <div>
                                                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                                        Payment Method
                                                    </label>
                                                    <Select
                                                        value={paymentMethod}
                                                        onValueChange={(
                                                            value:
                                                                | 'cash'
                                                                | 'gcash'
                                                                | 'cheque'
                                                                | 'credit',
                                                        ) =>
                                                            setPaymentMethod(
                                                                value,
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger className="h-10 sm:h-11">
                                                            <SelectValue placeholder="Select payment method" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="cash">
                                                                Cash
                                                            </SelectItem>
                                                            <SelectItem value="gcash">
                                                                GCash
                                                            </SelectItem>
                                                            <SelectItem value="cheque">
                                                                Cheque
                                                            </SelectItem>
                                                            <SelectItem value="credit">
                                                                Credit
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Amount Received */}
                                                <div>
                                                    <div className="mb-1.5 flex items-center justify-between">
                                                        <label className="text-sm font-medium text-slate-700">
                                                            Amount Received
                                                        </label>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() =>
                                                                setAmountReceived(
                                                                    cartTotals.total.toFixed(
                                                                        2,
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            Exact
                                                        </Button>
                                                    </div>
                                                    <div className="relative">
                                                        <DollarSign className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                                                        <Input
                                                            type="number"
                                                            step="0.50"
                                                            min="0"
                                                            placeholder="0.00"
                                                            value={
                                                                amountReceived
                                                            }
                                                            onChange={(e) =>
                                                                setAmountReceived(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            className="h-10 pl-10 text-base sm:h-11"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Payment Status */}
                                                {amountReceived && (
                                                    <div className="space-y-2">
                                                        {paymentDetails.hasChange && (
                                                            <div className="rounded-lg border border-green-200 bg-green-50 p-3 sm:p-4">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm font-medium text-green-800">
                                                                        Change
                                                                        Due
                                                                    </span>
                                                                    <span className="text-base font-bold text-green-900 sm:text-lg">
                                                                        ₱
                                                                        {formatCurrency(
                                                                            paymentDetails.change,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {paymentDetails.isPartial && (
                                                            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 sm:p-4">
                                                                <div className="mb-1.5 flex items-center justify-between">
                                                                    <span className="text-sm font-medium text-yellow-800">
                                                                        Partial
                                                                        Payment
                                                                    </span>
                                                                    <span className="text-xs text-yellow-900 sm:text-sm">
                                                                        Paid: ₱
                                                                        {formatCurrency(
                                                                            paymentDetails.received,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between border-t border-yellow-300 pt-1.5">
                                                                    <span className="text-sm text-yellow-700">
                                                                        Balance
                                                                        Remaining
                                                                    </span>
                                                                    <span className="text-base font-bold text-yellow-900 sm:text-lg">
                                                                        ₱
                                                                        {formatCurrency(
                                                                            paymentDetails.balance,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {paymentDetails.isExact && (
                                                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 sm:p-4">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm font-medium text-blue-800">
                                                                        Exact
                                                                        Payment
                                                                    </span>
                                                                    <span className="text-xs text-blue-900 sm:text-sm">
                                                                        No
                                                                        change
                                                                        needed
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* For Delivery Checkbox */}
                                                <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 sm:p-3">
                                                    <input
                                                        type="checkbox"
                                                        id="is_for_delivery_mobile"
                                                        checked={isForDelivery}
                                                        onChange={(e) => {
                                                            const nextIsForDelivery =
                                                                e.target
                                                                    .checked;
                                                            setIsForDelivery(
                                                                nextIsForDelivery,
                                                            );
                                                            if (
                                                                nextIsForDelivery
                                                            ) {
                                                                setItemsCollapsed(
                                                                    true,
                                                                );
                                                            }
                                                        }}
                                                        className="h-4 w-4 rounded sm:h-5 sm:w-5"
                                                    />
                                                    <label
                                                        htmlFor="is_for_delivery_mobile"
                                                        className="cursor-pointer text-sm font-medium text-slate-700"
                                                    >
                                                        This sale is for
                                                        delivery
                                                    </label>
                                                </div>

                                                {/* Delivery Details - Only show when isForDelivery is true */}
                                                {isForDelivery && (
                                                    <div className="space-y-2.5 border-t border-slate-200 pt-2 sm:space-y-3">
                                                        <div>
                                                            <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                                                Deliver To
                                                                (Name) *
                                                            </label>
                                                            <Input
                                                                type="text"
                                                                placeholder="Enter recipient name"
                                                                value={
                                                                    deliveryName
                                                                }
                                                                onChange={(e) =>
                                                                    setDeliveryName(
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="h-10 text-base sm:h-11"
                                                                required={
                                                                    isForDelivery
                                                                }
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                                                Address *
                                                            </label>
                                                            <textarea
                                                                placeholder="Brgy. San Isidro, Purok 3&#10;Calauan, Laguna"
                                                                value={
                                                                    deliveryAddress
                                                                }
                                                                onChange={(e) =>
                                                                    setDeliveryAddress(
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                                rows={3}
                                                                required={
                                                                    isForDelivery
                                                                }
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                                                Contact Number *
                                                            </label>
                                                            <Input
                                                                type="text"
                                                                placeholder="0917-xxx-xxxx"
                                                                value={
                                                                    deliveryContact
                                                                }
                                                                onChange={(e) =>
                                                                    setDeliveryContact(
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="h-10 text-base sm:h-11"
                                                                required={
                                                                    isForDelivery
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Notes */}
                                                <div>
                                                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                                        Notes (Optional)
                                                    </label>
                                                    <div className="relative">
                                                        <FileText className="absolute top-2.5 left-3 h-4 w-4 text-slate-400 sm:top-3" />
                                                        <textarea
                                                            placeholder="Add notes for this sale..."
                                                            value={notes}
                                                            onChange={(e) =>
                                                                setNotes(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            className="w-full resize-none rounded-md border border-slate-300 py-2 pr-3 pl-10 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                            rows={2}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2 border-t border-slate-200 pt-2 sm:gap-3">
                                                <Button
                                                    variant="outline"
                                                    className="h-11 flex-1 text-sm sm:h-12 sm:text-base"
                                                    onClick={() => {
                                                        clearCart();
                                                        setAmountReceived('');
                                                        setPaymentMethod(
                                                            'cash',
                                                        );
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
                                                    className="h-11 flex-1 bg-blue-600 text-sm hover:bg-blue-700 sm:h-12 sm:text-base"
                                                    onClick={() => {
                                                        setIsMobileCartOpen(
                                                            false,
                                                        );
                                                        handleCheckout();
                                                    }}
                                                    disabled={
                                                        isProcessing ||
                                                        cart.length === 0
                                                    }
                                                >
                                                    <CreditCard className="mr-2 h-4 w-4" />
                                                    Checkout
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center py-16 text-slate-500">
                                <ShoppingCart className="mb-4 h-16 w-16 opacity-50" />
                                <p className="text-sm">Your cart is empty</p>
                            </div>
                        )}
                    </SheetContent>
                </Sheet>

                {/* PIN Authentication Dialog */}
                <Dialog
                    open={isPinDialogOpen}
                    onOpenChange={setIsPinDialogOpen}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Enter PIN</DialogTitle>
                            <DialogDescription>
                                Please enter your PIN to complete the
                                transaction.
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
                                <p className="mt-2 text-sm text-red-600">
                                    {pinError}
                                </p>
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
