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
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { toast } from '@/lib/toast';
import { type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronUp,
    Clock,
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

interface User {
    id: number;
    name: string;
}

interface Product {
    id: number;
    name: string;
    image?: string | null;
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
    const [selectedStatus, setSelectedStatus] = useState<
        'all' | 'PENDING' | 'PARTIAL'
    >('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [expandedDeliveryId, setExpandedDeliveryId] = useState<number | null>(
        null,
    );
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
            filtered = filtered.filter(
                (d) => d.delivery_status === selectedStatus,
            );
        }

        // Filter by search term
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (d) =>
                    d.sale_number.toLowerCase().includes(searchLower) ||
                    d.cashier.name.toLowerCase().includes(searchLower) ||
                    d.items.some(
                        (item) =>
                            item.product_variant.product.name
                                .toLowerCase()
                                .includes(searchLower) ||
                            item.product_variant.description
                                .toLowerCase()
                                .includes(searchLower),
                    ),
            );
        }

        return filtered;
    }, [deliveries, selectedStatus, searchTerm]);

    // Get current time
    const currentTime = useMemo(() => {
        return new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }, []);

    const formatItemQuantity = (quantity: number) => {
        const value = Number(quantity);
        if (!Number.isFinite(value)) {
            return '0';
        }
        if (Number.isInteger(value)) {
            return value.toString();
        }
        return value.toFixed(2).replace(/\.?0+$/, '');
    };

    const getTransactionDateKey = (dateValue: string) => {
        const date = new Date(dateValue);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatTransactionDateLabel = (dateKey: string) => {
        const [year, month, day] = dateKey.split('-').map(Number);
        const transactionDate = new Date(year, month - 1, day);
        const now = new Date();
        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        );
        const diffMs = today.getTime() - transactionDate.getTime();
        const diffDays = Math.round(diffMs / 86_400_000);

        if (diffDays === 0) {
            return 'Today';
        }
        if (diffDays === 1) {
            return 'Yesterday';
        }

        return transactionDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTransactionTime = (dateValue: string) =>
        new Date(dateValue)
            .toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            })
            .toLowerCase();

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
                toast.error(
                    'Please process items from one sale at a time. Clear cart first.',
                );
                return;
            }
        }

        // Auto-populate date/time and notes from sale when first item is added
        if (cart.length === 0) {
            const saleDate = new Date(delivery.created_at);
            const localDateTime = new Date(
                saleDate.getTime() - saleDate.getTimezoneOffset() * 60000,
            )
                .toISOString()
                .slice(0, 16);
            setDeliveredAt(localDateTime);
            setNotes(delivery.notes || '');
        }

        // Check if item already exists in cart
        const existingItemIndex = cart.findIndex(
            (cartItem) =>
                cartItem.productVariantId === item.product_variant_id &&
                cartItem.deliveryId === delivery.id,
        );

        if (existingItemIndex >= 0) {
            // Update quantity (but check remaining)
            const newCart = [...cart];
            const newQuantity = newCart[existingItemIndex].quantity + 0.5;
            if (newQuantity > newCart[existingItemIndex].remainingQuantity) {
                toast.error(
                    `Insufficient remaining quantity. Available: ${newCart[existingItemIndex].remainingQuantity}`,
                );
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
        const newQuantity = Math.max(
            0,
            Math.min(
                newCart[index].remainingQuantity,
                newCart[index].quantity + change,
            ),
        );

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
        const total = cart.reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0,
        );
        return { total };
    }, [cart]);

    // Group cart items by delivery
    const cartByDelivery = useMemo(() => {
        const grouped: Record<number, CartItem[]> = {};
        cart.forEach((item) => {
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
        const deliveryIds = [...new Set(cart.map((item) => item.deliveryId))];
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
        const items = cart.map((item) => ({
            product_variant_id: item.productVariantId,
            quantity: item.quantity,
        }));

        router.post(
            `/delivery-landing/${deliveryId}/process`,
            {
                pin,
                items,
                delivered_at: deliveredAt,
                notes: notes.trim(),
            },
            {
                onSuccess: () => {
                    setIsProcessing(false);
                    setIsPinDialogOpen(false);
                    setPin('');
                    setCart([]);
                    setDeliveredAt(new Date().toISOString().slice(0, 16));
                    setNotes('');
                    toast.success(
                        'Delivery processed successfully. Delivery receipt has been generated.',
                    );
                },
                onError: (errors) => {
                    setIsProcessing(false);
                    if (errors.pin) {
                        const pinError = Array.isArray(errors.pin)
                            ? errors.pin[0]
                            : errors.pin;
                        setPinError(pinError);
                    } else if (errors.delivery) {
                        const deliveryError = Array.isArray(errors.delivery)
                            ? errors.delivery[0]
                            : errors.delivery;
                        setPinError(deliveryError);
                    } else {
                        const firstError = Object.values(errors)[0];
                        const errorMessage = Array.isArray(firstError)
                            ? firstError[0]
                            : firstError;
                        setPinError(
                            errorMessage ||
                                'Delivery failed. Please try again.',
                        );
                    }
                },
            },
        );
    };

    return (
        <>
            <Head title="Delivery Management" />
            <div className="flex h-screen overflow-hidden bg-slate-50">
                {/* Left Sidebar - Desktop Only */}
                <div className="hidden lg:flex lg:w-[7%] lg:flex-col lg:items-center lg:border-r lg:border-slate-200 lg:bg-white lg:py-4">
                    <Button
                        variant={selectedStatus === 'all' ? 'default' : 'ghost'}
                        className={`mb-2 flex h-20 w-20 flex-col items-center justify-center ${
                            selectedStatus === 'all'
                                ? 'bg-blue-600 text-white'
                                : ''
                        }`}
                        onClick={() => setSelectedStatus('all')}
                    >
                        <Home className="mb-1 h-6 w-6" />
                        <span className="text-xs">All</span>
                    </Button>
                    <Button
                        variant={
                            selectedStatus === 'PENDING' ? 'default' : 'ghost'
                        }
                        className={`mb-2 flex h-20 w-20 flex-col items-center justify-center ${
                            selectedStatus === 'PENDING'
                                ? 'bg-blue-600 text-white'
                                : ''
                        }`}
                        onClick={() => setSelectedStatus('PENDING')}
                    >
                        <Clock className="mb-1 h-6 w-6" />
                        <span className="text-center text-xs">Pending</span>
                    </Button>
                    <Button
                        variant={
                            selectedStatus === 'PARTIAL' ? 'default' : 'ghost'
                        }
                        className={`mb-2 flex h-20 w-20 flex-col items-center justify-center ${
                            selectedStatus === 'PARTIAL'
                                ? 'bg-blue-600 text-white'
                                : ''
                        }`}
                        onClick={() => setSelectedStatus('PARTIAL')}
                    >
                        <Package className="mb-1 h-6 w-6" />
                        <span className="text-center text-xs">Partial</span>
                    </Button>
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
                    {/* Header */}
                    <div className="border-b border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="relative min-w-0 flex-1">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder="Search deliveries..."
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
                                    className="h-10 pl-10"
                                />
                            </div>
                            <div className="shrink-0 lg:hidden">
                                <Select
                                    value={selectedStatus}
                                    onValueChange={(
                                        value: 'all' | 'PENDING' | 'PARTIAL',
                                    ) => setSelectedStatus(value)}
                                >
                                    <SelectTrigger
                                        className="h-10 w-10 justify-center p-0 [&>span]:hidden [&>svg]:hidden"
                                        aria-label="Filter deliveries by status"
                                    >
                                        <div className="relative">
                                            <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                                            {selectedStatus !== 'all' && (
                                                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                                            )}
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                        <SelectItem value="all">
                                            All Status
                                        </SelectItem>
                                        <SelectItem value="PENDING">
                                            Pending
                                        </SelectItem>
                                        <SelectItem value="PARTIAL">
                                            Partial
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="hidden items-center gap-2 lg:flex">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.visit('/pos')}
                                >
                                    <ShoppingCart className="mr-1 h-4 w-4" />
                                    New Order
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

                    {/* Delivery Items Grid */}
                    <div className="flex-1 overflow-y-auto p-4 pb-28 lg:pb-4">
                        {filteredDeliveries.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {filteredDeliveries.map(
                                    (delivery, deliveryIndex) => {
                                        const totalRemainingQuantity =
                                            delivery.items.reduce(
                                                (sum, item) =>
                                                    sum +
                                                    item.remaining_quantity,
                                                0,
                                            );
                                        const hasAvailableItems =
                                            delivery.items.some(
                                                (item) =>
                                                    item.remaining_quantity > 0,
                                            );
                                        const recipientInfo = [
                                            delivery.delivery_name,
                                            delivery.delivery_address,
                                            delivery.delivery_contact,
                                        ]
                                            .filter(Boolean)
                                            .join(' | ');
                                        const firstItem = delivery.items[0];
                                        const additionalItems =
                                            delivery.items.slice(1);
                                        const hasAdditionalItems =
                                            additionalItems.length > 0;
                                        const isExpanded =
                                            expandedDeliveryId === delivery.id;
                                        const displayedItems = isExpanded
                                            ? delivery.items
                                            : firstItem
                                              ? [firstItem]
                                              : [];
                                        const transactionDateKey =
                                            getTransactionDateKey(
                                                delivery.created_at,
                                            );
                                        const previousDateKey =
                                            deliveryIndex > 0
                                                ? getTransactionDateKey(
                                                      filteredDeliveries[
                                                          deliveryIndex - 1
                                                      ].created_at,
                                                  )
                                                : null;
                                        const showDateHeader =
                                            deliveryIndex === 0 ||
                                            transactionDateKey !==
                                                previousDateKey;
                                        const transactionDateLabel =
                                            formatTransactionDateLabel(
                                                transactionDateKey,
                                            );
                                        const transactionTimeLabel =
                                            formatTransactionTime(
                                                delivery.created_at,
                                            );
                                        // Check if cart has items from a different sale
                                        const cartHasOtherSale =
                                            cart.length > 0 &&
                                            cart[0].saleNumber !==
                                                delivery.sale_number;
                                        const isDisabled =
                                            !hasAvailableItems ||
                                            cartHasOtherSale;

                                        return (
                                            <div
                                                key={delivery.id}
                                                className="space-y-3"
                                            >
                                                {showDateHeader ? (
                                                    <div className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 py-2 text-center backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
                                                        <span className="text-xs font-semibold text-muted-foreground">
                                                            {
                                                                transactionDateLabel
                                                            }
                                                        </span>
                                                    </div>
                                                ) : null}

                                                <div
                                                    className={`flex flex-col rounded-lg border-2 border-slate-200 bg-white shadow-sm transition-all duration-200 ${
                                                        isDisabled
                                                            ? 'cursor-not-allowed opacity-60'
                                                            : 'transform cursor-pointer hover:scale-[1.02] hover:shadow-md'
                                                    }`}
                                                    onClick={() => {
                                                        if (isDisabled) {
                                                            if (
                                                                cartHasOtherSale
                                                            ) {
                                                                toast.error(
                                                                    'Please process items from one sale at a time. Clear cart first.',
                                                                );
                                                            }
                                                            return;
                                                        }

                                                        // Add all available items to cart at once
                                                        const itemsToAdd: CartItem[] =
                                                            [];
                                                        delivery.items.forEach(
                                                            (item) => {
                                                                if (
                                                                    item.remaining_quantity >
                                                                    0
                                                                ) {
                                                                    // Check if item already exists in cart
                                                                    const existingItemIndex =
                                                                        cart.findIndex(
                                                                            (
                                                                                cartItem,
                                                                            ) =>
                                                                                cartItem.productVariantId ===
                                                                                    item.product_variant_id &&
                                                                                cartItem.deliveryId ===
                                                                                    delivery.id,
                                                                        );

                                                                    if (
                                                                        existingItemIndex >=
                                                                        0
                                                                    ) {
                                                                        // Update quantity (but check remaining)
                                                                        const existingItem =
                                                                            cart[
                                                                                existingItemIndex
                                                                            ];
                                                                        const newQuantity =
                                                                            Math.min(
                                                                                existingItem.remainingQuantity,
                                                                                existingItem.quantity +
                                                                                    0.5,
                                                                            );
                                                                        if (
                                                                            newQuantity >
                                                                            existingItem.quantity
                                                                        ) {
                                                                            const newCart =
                                                                                [
                                                                                    ...cart,
                                                                                ];
                                                                            newCart[
                                                                                existingItemIndex
                                                                            ].quantity =
                                                                                newQuantity;
                                                                            setCart(
                                                                                newCart,
                                                                            );
                                                                        }
                                                                    } else {
                                                                        // Add new item
                                                                        itemsToAdd.push(
                                                                            {
                                                                                deliveryId:
                                                                                    delivery.id,
                                                                                saleNumber:
                                                                                    delivery.sale_number,
                                                                                productVariantId:
                                                                                    item.product_variant_id,
                                                                                productName:
                                                                                    item
                                                                                        .product_variant
                                                                                        .product
                                                                                        .name,
                                                                                description:
                                                                                    item
                                                                                        .product_variant
                                                                                        .description,
                                                                                unitPrice:
                                                                                    item.unit_price,
                                                                                quantity: 0.5,
                                                                                remainingQuantity:
                                                                                    item.remaining_quantity,
                                                                                saleItemId:
                                                                                    item.id,
                                                                            },
                                                                        );
                                                                    }
                                                                }
                                                            },
                                                        );

                                                        // Add all new items at once
                                                        if (
                                                            itemsToAdd.length >
                                                            0
                                                        ) {
                                                            // Auto-populate date/time and notes from sale when first items are added
                                                            if (
                                                                cart.length ===
                                                                0
                                                            ) {
                                                                const saleDate =
                                                                    new Date(
                                                                        delivery.created_at,
                                                                    );
                                                                const localDateTime =
                                                                    new Date(
                                                                        saleDate.getTime() -
                                                                            saleDate.getTimezoneOffset() *
                                                                                60000,
                                                                    )
                                                                        .toISOString()
                                                                        .slice(
                                                                            0,
                                                                            16,
                                                                        );
                                                                setDeliveredAt(
                                                                    localDateTime,
                                                                );
                                                                setNotes(
                                                                    delivery.notes ||
                                                                        '',
                                                                );
                                                            }
                                                            setCart([
                                                                ...cart,
                                                                ...itemsToAdd,
                                                            ]);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex flex-1 flex-col p-3">
                                                        {/* Header */}
                                                        <div className="mb-2">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <h3 className="text-base font-semibold text-slate-900">
                                                                    {
                                                                        delivery.sale_number
                                                                    }
                                                                </h3>
                                                                {delivery.delivery_status ===
                                                                'PENDING' ? (
                                                                    <span className="inline-flex items-center rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                                                                        <Clock className="mr-1 h-3 w-3" />
                                                                        Pending
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                                                        <Package className="mr-1 h-3 w-3" />
                                                                        Partial
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="mt-1 line-clamp-1 text-xs text-slate-600">
                                                                <span className="font-medium text-slate-700">
                                                                    To:
                                                                </span>{' '}
                                                                {recipientInfo ||
                                                                    'Walk-in customer'}
                                                            </p>
                                                            {isDisabled && (
                                                                <p className="mt-1 text-xs font-medium text-red-600">
                                                                    {!hasAvailableItems
                                                                        ? 'No remaining items to deliver'
                                                                        : 'Clear cart first to switch sale'}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Notes if available */}
                                                        {delivery.notes && (
                                                            <div className="mb-3 flex items-start gap-2">
                                                                <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                                                                <p className="line-clamp-2 text-xs text-slate-700">
                                                                    {
                                                                        delivery.notes
                                                                    }
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Items List */}
                                                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                                                            {displayedItems.map(
                                                                (item) => (
                                                                    <div
                                                                        key={
                                                                            item.id
                                                                        }
                                                                        className="flex items-start gap-3 border-b border-slate-200/80 pb-2.5 last:border-b-0 last:pb-0"
                                                                    >
                                                                        <ProductImage
                                                                            src={
                                                                                item
                                                                                    .product_variant
                                                                                    ?.product
                                                                                    ?.image ??
                                                                                null
                                                                            }
                                                                            alt={
                                                                                item
                                                                                    .product_variant
                                                                                    ?.product
                                                                                    ?.name ||
                                                                                'Product'
                                                                            }
                                                                            className="h-14 w-14 rounded-md border border-slate-200 bg-white object-cover"
                                                                            fallbackClassName="h-14 w-14 rounded-md border border-slate-200 bg-slate-100"
                                                                        />
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-start justify-between gap-3">
                                                                                <div className="min-w-0 flex-1">
                                                                                    <p className="truncate text-sm font-semibold text-slate-900">
                                                                                        {item
                                                                                            .product_variant
                                                                                            ?.product
                                                                                            ?.name ||
                                                                                            'N/A'}
                                                                                    </p>
                                                                                    <p className="mt-0.5 truncate text-xs text-slate-600">
                                                                                        {item
                                                                                            .product_variant
                                                                                            ?.description ||
                                                                                            'No variant'}
                                                                                    </p>
                                                                                </div>
                                                                                <span className="shrink-0 self-end text-sm font-semibold text-slate-900">
                                                                                    Qty:
                                                                                    x
                                                                                    {formatItemQuantity(
                                                                                        item.remaining_quantity,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>

                                                        {hasAdditionalItems ? (
                                                            <button
                                                                type="button"
                                                                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
                                                                onClick={(
                                                                    event,
                                                                ) => {
                                                                    event.stopPropagation();
                                                                    setExpandedDeliveryId(
                                                                        (
                                                                            current,
                                                                        ) =>
                                                                            current ===
                                                                            delivery.id
                                                                                ? null
                                                                                : delivery.id,
                                                                    );
                                                                }}
                                                            >
                                                                {isExpanded
                                                                    ? 'View Less'
                                                                    : 'View More'}
                                                                {isExpanded ? (
                                                                    <ChevronUp className="h-4 w-4" />
                                                                ) : (
                                                                    <ChevronDown className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        ) : null}

                                                        <div className="mt-3 border-t border-slate-200 pt-2.5">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="text-xs font-medium text-slate-600">
                                                                        {
                                                                            transactionTimeLabel
                                                                        }
                                                                    </span>
                                                                </div>
                                                                <span className="shrink-0 text-sm font-semibold text-slate-900">
                                                                    Remaining: x
                                                                    {formatItemQuantity(
                                                                        totalRemainingQuantity,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    },
                                )}
                            </div>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center text-slate-500">
                                <Truck className="mb-4 h-16 w-16 opacity-50" />
                                <p className="text-lg">No deliveries found</p>
                                <p className="text-sm">
                                    Try selecting a different status
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop Cart Panel */}
                <div className="hidden h-screen flex-col overflow-hidden border-l border-slate-200 bg-white lg:flex lg:w-[28%]">
                    <div className="flex-shrink-0 border-b border-slate-200 p-5">
                        <div className="mb-2 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">
                                Delivery Cart
                            </h2>
                            <span className="text-sm text-slate-500">
                                {currentTime}
                            </span>
                        </div>
                        <p className="text-sm text-slate-600">
                            {cart.length} item(s) ready for delivery
                        </p>
                    </div>

                    <div
                        className="min-h-0 flex-1 overflow-y-auto p-5"
                        style={{ overflowY: 'auto' }}
                    >
                        {cart.length > 0 ? (
                            <div className="space-y-4">
                                {Object.entries(cartByDelivery).map(
                                    ([deliveryId, items]) => {
                                        const delivery =
                                            filteredDeliveries.find(
                                                (d) =>
                                                    d.id ===
                                                    parseInt(deliveryId),
                                            );
                                        return (
                                            <div
                                                key={deliveryId}
                                                className="space-y-2"
                                            >
                                                <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                                    {delivery?.sale_number ||
                                                        'Unknown'}
                                                </div>
                                                {items.map((item, index) => {
                                                    const cartIndex =
                                                        cart.findIndex(
                                                            (c) =>
                                                                c.deliveryId ===
                                                                    parseInt(
                                                                        deliveryId,
                                                                    ) &&
                                                                c.productVariantId ===
                                                                    item.productVariantId,
                                                        );
                                                    return (
                                                        <div
                                                            key={`${deliveryId}-${item.productVariantId}`}
                                                            className="relative rounded-lg border border-slate-200 bg-slate-50 p-4"
                                                        >
                                                            <button
                                                                onClick={() =>
                                                                    removeFromCart(
                                                                        cartIndex,
                                                                    )
                                                                }
                                                                className="absolute top-3 right-3 text-slate-400 transition-colors hover:text-red-600"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                            <div className="flex gap-4 pr-8">
                                                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-slate-200">
                                                                    <Package className="h-6 w-6 text-slate-400" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <h4 className="mb-1 truncate text-sm font-medium text-slate-900">
                                                                        {
                                                                            item.productName
                                                                        }
                                                                    </h4>
                                                                    <p className="mb-1 truncate text-xs text-slate-500">
                                                                        {
                                                                            item.description
                                                                        }
                                                                    </p>
                                                                    <div className="mt-3 flex items-center gap-2">
                                                                        <button
                                                                            onClick={(
                                                                                e,
                                                                            ) => {
                                                                                e.stopPropagation();
                                                                                updateQuantity(
                                                                                    cartIndex,
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
                                                                                    cartIndex,
                                                                                    0.5,
                                                                                );
                                                                            }}
                                                                            className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white transition-colors hover:bg-slate-50"
                                                                        >
                                                                            <Plus className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                    <div className="mt-1 text-xs text-slate-500">
                                                                        Remaining:{' '}
                                                                        {item.remainingQuantity.toFixed(
                                                                            2,
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    },
                                )}
                            </div>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center py-16 text-slate-500">
                                <ShoppingCart className="mb-4 h-16 w-16 opacity-50" />
                                <p className="text-sm">Your cart is empty</p>
                                <p className="mt-1 text-xs">
                                    Click on items to add them
                                </p>
                            </div>
                        )}
                    </div>

                    {cart.length > 0 && (
                        <div className="flex-shrink-0 space-y-5 border-t border-slate-200 bg-white p-5">
                            {/* Notes */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Notes (Optional)
                                </label>
                                <textarea
                                    placeholder="Add delivery notes or special instructions..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    rows={3}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 border-t border-slate-200 pt-3">
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
                                    <Truck className="mr-2 h-4 w-4" />
                                    Process Delivery
                                </Button>
                            </div>
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
                                    Delivery Cart
                                </SheetTitle>
                                {cart.length > 0 && (
                                    <p className="mt-1 text-sm text-slate-600">
                                        {cart.length} item(s)
                                    </p>
                                )}
                            </SheetHeader>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                            {cart.length > 0 ? (
                                <div className="space-y-3 sm:space-y-4">
                                    {Object.entries(cartByDelivery).map(
                                        ([deliveryId, items]) => {
                                            const delivery =
                                                filteredDeliveries.find(
                                                    (d) =>
                                                        d.id ===
                                                        parseInt(deliveryId),
                                                );
                                            return (
                                                <div
                                                    key={deliveryId}
                                                    className="space-y-2"
                                                >
                                                    <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                                        {delivery?.sale_number ||
                                                            'Unknown'}
                                                    </div>
                                                    {items.map(
                                                        (item, index) => {
                                                            const cartIndex =
                                                                cart.findIndex(
                                                                    (c) =>
                                                                        c.deliveryId ===
                                                                            parseInt(
                                                                                deliveryId,
                                                                            ) &&
                                                                        c.productVariantId ===
                                                                            item.productVariantId,
                                                                );
                                                            return (
                                                                <div
                                                                    key={`${deliveryId}-${item.productVariantId}`}
                                                                    className="relative rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4"
                                                                >
                                                                    <button
                                                                        onClick={() =>
                                                                            removeFromCart(
                                                                                cartIndex,
                                                                            )
                                                                        }
                                                                        className="absolute top-2 right-2 touch-manipulation text-slate-400 transition-colors hover:text-red-600 active:text-red-700 sm:top-3 sm:right-3"
                                                                        aria-label="Remove item"
                                                                    >
                                                                        <X className="h-4 w-4 sm:h-5 sm:w-5" />
                                                                    </button>
                                                                    <div className="flex gap-3 pr-8 sm:gap-4 sm:pr-10">
                                                                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-slate-200 sm:h-16 sm:w-16">
                                                                            <Package className="h-6 w-6 text-slate-400 sm:h-8 sm:w-8" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <h4 className="mb-1 truncate text-sm font-medium text-slate-900">
                                                                                {
                                                                                    item.productName
                                                                                }
                                                                            </h4>
                                                                            <p className="mb-1 truncate text-xs text-slate-500">
                                                                                {
                                                                                    item.description
                                                                                }
                                                                            </p>
                                                                            <div className="mt-2 flex items-center gap-2 sm:mt-3 sm:gap-3">
                                                                                <button
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        updateQuantity(
                                                                                            cartIndex,
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
                                                                                            cartIndex,
                                                                                            0.5,
                                                                                        );
                                                                                    }}
                                                                                    className="flex h-8 w-8 touch-manipulation items-center justify-center rounded border border-slate-200 bg-white transition-colors hover:bg-slate-50 active:bg-slate-100 sm:h-9 sm:w-9"
                                                                                    aria-label="Increase quantity"
                                                                                >
                                                                                    <Plus className="h-4 w-4" />
                                                                                </button>
                                                                            </div>
                                                                            <div className="mt-1 text-xs text-slate-500">
                                                                                Remaining:{' '}
                                                                                {item.remainingQuantity.toFixed(
                                                                                    2,
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        },
                                                    )}
                                                </div>
                                            );
                                        },
                                    )}
                                </div>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center py-16 text-slate-500">
                                    <ShoppingCart className="mb-4 h-16 w-16 opacity-50" />
                                    <p className="text-sm">
                                        Your cart is empty
                                    </p>
                                    <p className="mt-1 text-xs">
                                        Click on items to add them
                                    </p>
                                </div>
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="flex-shrink-0 space-y-4 border-t border-slate-200 bg-white p-5">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                        Notes (Optional)
                                    </label>
                                    <textarea
                                        placeholder="Add delivery notes or special instructions..."
                                        value={notes}
                                        onChange={(e) =>
                                            setNotes(e.target.value)
                                        }
                                        className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        rows={3}
                                    />
                                </div>

                                <div className="flex gap-3 border-t border-slate-200 pt-3">
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
                                        disabled={
                                            isProcessing || cart.length === 0
                                        }
                                    >
                                        <Truck className="mr-2 h-4 w-4" />
                                        Process
                                    </Button>
                                </div>
                            </div>
                        )}
                    </SheetContent>
                </Sheet>

                {/* PIN Dialog */}
                <Dialog
                    open={isPinDialogOpen}
                    onOpenChange={setIsPinDialogOpen}
                >
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>
                                Confirm Delivery Processing
                            </DialogTitle>
                            <DialogDescription>
                                Enter your PIN to process this delivery and
                                generate the delivery receipt.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
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
                                    <p className="mt-2 text-sm text-red-600">
                                        {pinError}
                                    </p>
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
                                {isProcessing
                                    ? 'Processing...'
                                    : 'Process Delivery'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
