import {
    MobileRecordCard,
    MobileRecordRow,
} from '@/components/mobile/record-card';
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
import { Label } from '@/components/ui/label';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/toaster';
import { formatCurrency } from '@/lib/format-currency';
import { toast } from '@/lib/toast';
import { type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    Check,
    CreditCard,
    LayoutGrid,
    LogIn,
    Minus,
    Plus,
    Scale,
    X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

interface ProductInfo {
    id: number;
    name: string;
    sku: string;
    image: string | null;
}

interface WeighInsLandingProps {
    prices: {
        cooked_copra: number | null;
        uncooked_copra: number | null;
        coconut: number | null;
    };
    products: {
        cooked_copra: ProductInfo | null;
        uncooked_copra: ProductInfo | null;
        coconut: ProductInfo | null;
    };
}

interface CartItem {
    id: string; // Temporary ID for cart items
    type: 'cooked_copra' | 'uncooked_copra' | 'coconut';
    weight_kg: number | null;
    count: number | null;
    unit_price: number;
    total_amount: number;
}

const categories = [
    {
        type: 'cooked_copra' as const,
        label: 'Cooked Copra',
        description: 'Record cooked copra weigh-in',
        icon: Scale,
        color: 'bg-orange-100 text-orange-800 border-orange-200',
    },
    {
        type: 'uncooked_copra' as const,
        label: 'Uncooked Copra',
        description: 'Record uncooked copra weigh-in',
        icon: Scale,
        color: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
        type: 'coconut' as const,
        label: 'Coconut',
        description: 'Record coconut weigh-in',
        icon: Scale,
        color: 'bg-green-100 text-green-800 border-green-200',
    },
];

export default function WeighInsLanding({
    prices,
    products,
}: WeighInsLandingProps) {
    const { auth } = usePage<SharedData>().props;
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showUnpaid, setShowUnpaid] = useState(false);
    const [unpaidTransactions, setUnpaidTransactions] = useState<any[]>([]);
    const [isLoadingUnpaid, setIsLoadingUnpaid] = useState(false);

    // Get current price for selected type
    const getCurrentPrice = useCallback(
        (type: 'cooked_copra' | 'uncooked_copra' | 'coconut') => {
            return prices[type] || null;
        },
        [prices],
    );

    // Handle category click - add to cart directly (like POS)
    const handleCategoryClick = (
        type: 'cooked_copra' | 'uncooked_copra' | 'coconut',
    ) => {
        const unitPrice = getCurrentPrice(type);
        if (!unitPrice) {
            toast.error(
                'Price not set for this type. Please set the price first.',
            );
            return;
        }

        // Default values
        const defaultWeight = type === 'coconut' ? null : 1;
        const defaultCount = type === 'coconut' ? 1 : null;

        const totalAmount =
            type === 'coconut'
                ? defaultCount! * unitPrice
                : defaultWeight! * unitPrice;

        const cartItem: CartItem = {
            id: `temp-${Date.now()}-${Math.random()}`,
            type,
            weight_kg: defaultWeight,
            count: defaultCount,
            unit_price: unitPrice,
            total_amount: totalAmount,
        };

        setCart((prev) => [...prev, cartItem]);
    };

    // Remove from cart
    const removeFromCart = useCallback((id: string) => {
        setCart((prev) => prev.filter((item) => item.id !== id));
    }, []);

    // Update cart item
    const updateCartItem = useCallback(
        (id: string, updates: Partial<CartItem>) => {
            setCart((prev) =>
                prev.map((item) => {
                    if (item.id === id) {
                        const updated = { ...item, ...updates };
                        // Recalculate total_amount
                        if (
                            updated.type === 'coconut' &&
                            updated.count !== null
                        ) {
                            updated.total_amount =
                                updated.count * updated.unit_price;
                        } else if (
                            (updated.type === 'cooked_copra' ||
                                updated.type === 'uncooked_copra') &&
                            updated.weight_kg !== null
                        ) {
                            updated.total_amount =
                                updated.weight_kg * updated.unit_price;
                        }
                        return updated;
                    }
                    return item;
                }),
            );
        },
        [],
    );

    // Clear cart
    const clearCart = useCallback(() => {
        setCart([]);
    }, []);

    // Calculate cart totals
    const cartTotals = useMemo(() => {
        return {
            totalItems: cart.length,
            totalAmount: cart.reduce((sum, item) => sum + item.total_amount, 0),
        };
    }, [cart]);

    // Handle PIN submission and process weigh-ins (or mark as paid)
    const handleProcessWeighIns = useCallback(
        (e?: React.FormEvent | React.KeyboardEvent) => {
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

            // Check if we're marking a transaction as paid
            const transactionId = (window as any).__currentTransactionId;
            if (transactionId) {
                // Use Inertia's router which handles CSRF automatically
                router.post(
                    `/weigh-ins-landing/${transactionId}/mark-as-paid`,
                    {
                        pin,
                    },
                    {
                        preserveScroll: true,
                        onSuccess: () => {
                            // Reset state
                            setIsPinDialogOpen(false);
                            setPin('');
                            setIsProcessing(false);

                            // Remove the transaction from the list
                            setUnpaidTransactions((prev) =>
                                prev.filter((t) => t.id !== transactionId),
                            );
                            (window as any).__currentTransactionId = null;

                            // Flash message from backend will be shown by Toaster component automatically
                        },
                        onError: (errors) => {
                            setIsProcessing(false);
                            if (errors.pin) {
                                const pinError = Array.isArray(errors.pin)
                                    ? errors.pin[0]
                                    : errors.pin;
                                setPinError(pinError);
                            } else {
                                toast.error(
                                    'Failed to mark transaction as paid. Please try again.',
                                );
                            }
                        },
                        onFinish: () => {
                            // Ensure processing state is reset
                            setIsProcessing(false);
                        },
                    },
                );
                return;
            }

            // Otherwise, process normal weigh-in cart
            if (cart.length === 0) {
                setPinError('Please add weigh-ins to the cart first.');
                setIsProcessing(false);
                return;
            }

            // Prepare weigh-ins data - all items in cart will be grouped into ONE transaction
            // Multiple types (cooked_copra, uncooked_copra, coconut) = multiple weigh-ins in same transaction
            // weighed_by_user_id and weighed_at will be set by backend based on PIN and current time
            const weighInsData = cart.map((item) => ({
                type: item.type,
                weight_kg: item.weight_kg,
                count: item.count,
            }));

            // Process all weigh-ins in a single batch transaction
            // All items (regardless of type) will be grouped under one transaction
            router.post(
                '/weigh-ins-landing/batch-store',
                {
                    pin,
                    weigh_ins: weighInsData,
                },
                {
                    onSuccess: () => {
                        setIsProcessing(false);
                        setIsPinDialogOpen(false);
                        setPin('');
                        setCart([]);
                        // Flash message will be shown automatically
                    },
                    onError: (errors) => {
                        setIsProcessing(false);
                        if (errors.pin) {
                            const pinError = Array.isArray(errors.pin)
                                ? errors.pin[0]
                                : errors.pin;
                            setPinError(pinError);
                        } else if (errors.weigh_ins) {
                            const weighInsError = Array.isArray(
                                errors.weigh_ins,
                            )
                                ? errors.weigh_ins[0]
                                : errors.weigh_ins;
                            setPinError(weighInsError);
                        } else {
                            const firstError = Object.values(errors)[0];
                            const errorMessage = Array.isArray(firstError)
                                ? firstError[0]
                                : firstError;
                            setPinError(
                                errorMessage ||
                                    'Failed to process weigh-ins. Please try again.',
                            );
                        }
                    },
                },
            );
        },
        [pin, cart, isProcessing, unpaidTransactions],
    );

    const getTypeLabel = (
        type: 'cooked_copra' | 'uncooked_copra' | 'coconut',
    ) => {
        switch (type) {
            case 'cooked_copra':
                return 'Cooked Copra';
            case 'uncooked_copra':
                return 'Uncooked Copra';
            case 'coconut':
                return 'Coconut';
        }
    };

    const getCurrentTime = useMemo(() => {
        return new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }, []);

    // Fetch unpaid transactions
    const fetchUnpaidTransactions = useCallback(() => {
        setIsLoadingUnpaid(true);
        fetch('/weigh-ins-landing/unpaid?json=1', {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then((data) => {
                console.log('Fetched unpaid transactions:', data);
                // Handle both Inertia response format and direct JSON format
                const transactions =
                    data.props?.transactions || data.transactions || [];
                setUnpaidTransactions(transactions);
                setIsLoadingUnpaid(false);
            })
            .catch((error) => {
                console.error('Error fetching unpaid transactions:', error);
                toast.error('Failed to load unpaid transactions');
                setIsLoadingUnpaid(false);
            });
    }, []);

    // Handle showing unpaid transactions
    const handleShowUnpaid = useCallback(() => {
        setShowUnpaid(true);
        // Always fetch to get latest data
        fetchUnpaidTransactions();
    }, [fetchUnpaidTransactions]);

    // Handle showing new weigh-ins (reset to category view)
    const handleShowNewWeighIns = useCallback(() => {
        setShowUnpaid(false);
    }, []);

    const formatWeighInType = (type: string): string => {
        return type
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    return (
        <>
            <Head title="Weigh-Ins" />
            <div className="flex h-screen overflow-hidden bg-slate-50">
                {/* Left Sidebar - Desktop Only */}
                <div className="hidden lg:flex lg:w-[7%] lg:flex-col lg:items-center lg:border-r lg:border-slate-200 lg:bg-white lg:py-4">
                    <div className="space-y-2">
                        <Button
                            variant={!showUnpaid ? 'default' : 'ghost'}
                            className={`flex h-20 w-20 flex-col items-center justify-center ${!showUnpaid ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}`}
                            onClick={handleShowNewWeighIns}
                        >
                            <Scale className="mb-1 h-6 w-6" />
                            <span className="text-xs">New Weigh-Ins</span>
                        </Button>
                        <Button
                            variant={showUnpaid ? 'default' : 'ghost'}
                            className={`flex h-20 w-20 flex-col items-center justify-center ${showUnpaid ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}`}
                            onClick={handleShowUnpaid}
                        >
                            <CreditCard className="mb-1 h-6 w-6" />
                            <span className="text-xs">Unpaid Weigh-Ins</span>
                        </Button>
                    </div>
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
                    {/* Mobile Category Bar */}
                    <div className="overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
                        <div className="flex gap-2">
                            <Button
                                variant={!showUnpaid ? 'default' : 'outline'}
                                size="sm"
                                className={
                                    !showUnpaid ? 'bg-blue-600 text-white' : ''
                                }
                                onClick={handleShowNewWeighIns}
                            >
                                <Scale className="mr-1 h-4 w-4" />
                                New Weigh-Ins
                            </Button>
                            <Button
                                variant={showUnpaid ? 'default' : 'outline'}
                                size="sm"
                                className={
                                    showUnpaid ? 'bg-blue-600 text-white' : ''
                                }
                                onClick={handleShowUnpaid}
                            >
                                <CreditCard className="mr-1 h-4 w-4" />
                                Unpaid Weigh-Ins
                            </Button>
                        </div>
                    </div>

                    {/* Category Cards Grid or Unpaid Transactions */}
                    <div className="flex-1 overflow-y-auto p-4 pb-28 lg:pb-4">
                        {!showUnpaid ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {categories.map((category) => {
                                    const Icon = category.icon;
                                    const price = getCurrentPrice(
                                        category.type,
                                    );
                                    const product = products[category.type];

                                    return (
                                        <div
                                            key={category.type}
                                            className="flex transform cursor-pointer flex-col rounded-lg border-2 border-slate-200 bg-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
                                            onClick={() =>
                                                handleCategoryClick(
                                                    category.type,
                                                )
                                            }
                                        >
                                            {/* Image Section - Square aspect ratio */}
                                            <div
                                                className={`aspect-square ${category.color} relative flex items-center justify-center overflow-hidden rounded-t-lg`}
                                            >
                                                {product?.image ? (
                                                    <ProductImage
                                                        src={product.image}
                                                        alt={category.label}
                                                        className="absolute inset-0 h-full w-full object-cover"
                                                        fallbackClassName="absolute inset-0 flex items-center justify-center"
                                                    />
                                                ) : (
                                                    <Icon className="h-16 w-16" />
                                                )}
                                            </div>

                                            {/* Content Section */}
                                            <div className="flex flex-col p-3">
                                                <h3 className="mb-0.5 text-base font-semibold text-slate-900">
                                                    {category.label}
                                                </h3>
                                                <p className="mb-2 text-xs text-slate-500">
                                                    {category.description}
                                                </p>
                                                {price !== null ? (
                                                    <p className="text-base font-bold text-slate-900">
                                                        ₱{formatCurrency(price)}{' '}
                                                        <span className="text-xs font-normal text-slate-500">
                                                            {category.type ===
                                                            'coconut'
                                                                ? '/pc'
                                                                : '/kg'}
                                                        </span>
                                                    </p>
                                                ) : (
                                                    <p className="text-xs font-medium text-red-600">
                                                        Price not set
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                                {isLoadingUnpaid ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="text-slate-500">
                                            Loading unpaid transactions...
                                        </div>
                                    </div>
                                ) : unpaidTransactions.length === 0 ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="text-slate-500">
                                            No unpaid transactions found.
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-3 p-4 md:hidden">
                                            {unpaidTransactions.map(
                                                (transaction) => (
                                                    <MobileRecordCard
                                                        key={`unpaid-mobile-${transaction.id}`}
                                                        title={
                                                            transaction.ref_num
                                                        }
                                                        subtitle={
                                                            transaction
                                                                .weighed_by
                                                                ?.name || 'N/A'
                                                        }
                                                        value={`₱${formatCurrency(transaction.total_amount)}`}
                                                        badges={[
                                                            {
                                                                label: 'Unpaid',
                                                                className:
                                                                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                                                            },
                                                        ]}
                                                        footer={
                                                            <Button
                                                                type="button"
                                                                className="h-11 w-full text-green-700 hover:text-green-800"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setPin('');
                                                                    setPinError(
                                                                        '',
                                                                    );
                                                                    setIsPinDialogOpen(
                                                                        true,
                                                                    );
                                                                    (
                                                                        window as any
                                                                    ).__currentTransactionId =
                                                                        transaction.id;
                                                                }}
                                                                disabled={
                                                                    isProcessing
                                                                }
                                                            >
                                                                <Check className="mr-1 h-4 w-4" />
                                                                Mark as Paid
                                                            </Button>
                                                        }
                                                    >
                                                        <MobileRecordRow
                                                            label="Date"
                                                            value={new Date(
                                                                transaction.weighed_at,
                                                            ).toLocaleDateString(
                                                                'en-US',
                                                                {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric',
                                                                },
                                                            )}
                                                        />
                                                        <MobileRecordRow
                                                            label="Items"
                                                            value={`${transaction.weigh_ins.length}`}
                                                        />
                                                    </MobileRecordCard>
                                                ),
                                            )}
                                        </div>

                                        <div className="hidden overflow-x-auto md:block">
                                            <table className="w-full">
                                                <thead className="border-b border-slate-200 bg-slate-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-700 uppercase">
                                                            Ref Number
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-700 uppercase">
                                                            Date
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-700 uppercase">
                                                            Weighed By
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-700 uppercase">
                                                            Items
                                                        </th>
                                                        <th className="px-4 py-3 text-right text-xs font-semibold tracking-wider text-slate-700 uppercase">
                                                            Total Amount
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-semibold tracking-wider text-slate-700 uppercase">
                                                            Action
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {unpaidTransactions.map(
                                                        (transaction) => (
                                                            <tr
                                                                key={
                                                                    transaction.id
                                                                }
                                                                className="hover:bg-slate-50"
                                                            >
                                                                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                                                    {
                                                                        transaction.ref_num
                                                                    }
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                                    {new Date(
                                                                        transaction.weighed_at,
                                                                    ).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                                    {transaction
                                                                        .weighed_by
                                                                        ?.name ||
                                                                        'N/A'}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    <div className="space-y-1">
                                                                        {transaction.weigh_ins.map(
                                                                            (
                                                                                weighIn: any,
                                                                            ) => (
                                                                                <div
                                                                                    key={
                                                                                        weighIn.id
                                                                                    }
                                                                                    className="text-xs text-slate-700"
                                                                                >
                                                                                    {formatWeighInType(
                                                                                        weighIn.type,
                                                                                    )}

                                                                                    :{' '}
                                                                                    {weighIn.count !==
                                                                                    null
                                                                                        ? `${weighIn.count} pcs`
                                                                                        : `${weighIn.weight_kg ? Number(weighIn.weight_kg).toFixed(2) : '0.00'} kg`}{' '}
                                                                                    @
                                                                                    ₱
                                                                                    {formatCurrency(
                                                                                        weighIn.unit_price,
                                                                                    )}
                                                                                </div>
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                                                                    ₱
                                                                    {formatCurrency(
                                                                        transaction.total_amount,
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            // Open PIN dialog for this transaction
                                                                            setPin(
                                                                                '',
                                                                            );
                                                                            setPinError(
                                                                                '',
                                                                            );
                                                                            setIsPinDialogOpen(
                                                                                true,
                                                                            );
                                                                            // Store transaction ID for later use
                                                                            (
                                                                                window as any
                                                                            ).__currentTransactionId =
                                                                                transaction.id;
                                                                        }}
                                                                        disabled={
                                                                            isProcessing
                                                                        }
                                                                        className="text-green-600 hover:bg-green-50 hover:text-green-700"
                                                                    >
                                                                        <Check className="mr-1 h-4 w-4" />
                                                                        Mark as
                                                                        Paid
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop Cart Panel */}
                <div className="hidden h-screen flex-col overflow-hidden border-l border-slate-200 bg-white lg:flex lg:w-[28%]">
                    <div className="flex-shrink-0 border-b border-slate-200 p-5">
                        <div className="mb-2 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">
                                Weigh-Ins Cart
                            </h2>
                            <span className="text-sm text-slate-500">
                                {getCurrentTime}
                            </span>
                        </div>
                        <p className="text-sm text-slate-600">
                            {cart.length} weigh-in{cart.length !== 1 ? 's' : ''}{' '}
                            in cart
                        </p>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-5">
                        {cart.length > 0 ? (
                            <div className="space-y-4">
                                {cart.map((item) => (
                                    <div
                                        key={item.id}
                                        className="relative rounded-lg border border-slate-200 bg-slate-50 p-4"
                                    >
                                        <button
                                            onClick={() =>
                                                removeFromCart(item.id)
                                            }
                                            className="absolute top-3 right-3 text-slate-400 transition-colors hover:text-red-600"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                        <div className="space-y-3 pr-8">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium text-slate-900">
                                                    {getTypeLabel(item.type)}
                                                </h4>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    ₱
                                                    {formatCurrency(
                                                        item.total_amount,
                                                    )}
                                                </p>
                                            </div>

                                            {item.type === 'coconut' ? (
                                                <div>
                                                    <Label
                                                        htmlFor={`count-${item.id}`}
                                                        className="text-xs"
                                                    >
                                                        Count (pcs)
                                                    </Label>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                const newCount =
                                                                    Math.max(
                                                                        1,
                                                                        (item.count ||
                                                                            1) -
                                                                            1,
                                                                    );
                                                                updateCartItem(
                                                                    item.id,
                                                                    {
                                                                        count: newCount,
                                                                    },
                                                                );
                                                            }}
                                                            className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50"
                                                        >
                                                            <Minus className="h-3 w-3" />
                                                        </button>
                                                        <Input
                                                            id={`count-${item.id}`}
                                                            type="number"
                                                            step="1"
                                                            min="1"
                                                            value={
                                                                item.count || ''
                                                            }
                                                            onChange={(e) => {
                                                                const value =
                                                                    e.target
                                                                        .value;
                                                                if (
                                                                    value === ''
                                                                ) {
                                                                    updateCartItem(
                                                                        item.id,
                                                                        {
                                                                            count: null,
                                                                        },
                                                                    );
                                                                } else {
                                                                    const newCount =
                                                                        Math.max(
                                                                            1,
                                                                            parseInt(
                                                                                value,
                                                                            ) ||
                                                                                1,
                                                                        );
                                                                    updateCartItem(
                                                                        item.id,
                                                                        {
                                                                            count: newCount,
                                                                        },
                                                                    );
                                                                }
                                                            }}
                                                            onBlur={(e) => {
                                                                const value =
                                                                    e.target
                                                                        .value;
                                                                if (
                                                                    !value ||
                                                                    parseInt(
                                                                        value,
                                                                    ) < 1
                                                                ) {
                                                                    updateCartItem(
                                                                        item.id,
                                                                        {
                                                                            count: 1,
                                                                        },
                                                                    );
                                                                }
                                                            }}
                                                            className="w-24 text-center text-sm"
                                                            placeholder="Enter count"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const newCount =
                                                                    (item.count ||
                                                                        1) + 1;
                                                                updateCartItem(
                                                                    item.id,
                                                                    {
                                                                        count: newCount,
                                                                    },
                                                                );
                                                            }}
                                                            className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50"
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <Label
                                                        htmlFor={`weight-${item.id}`}
                                                        className="text-xs"
                                                    >
                                                        Weight (kg)
                                                    </Label>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                const newWeight =
                                                                    Math.max(
                                                                        0.01,
                                                                        (item.weight_kg ||
                                                                            1) -
                                                                            0.5,
                                                                    );
                                                                updateCartItem(
                                                                    item.id,
                                                                    {
                                                                        weight_kg:
                                                                            newWeight,
                                                                    },
                                                                );
                                                            }}
                                                            className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50"
                                                        >
                                                            <Minus className="h-3 w-3" />
                                                        </button>
                                                        <Input
                                                            id={`weight-${item.id}`}
                                                            type="number"
                                                            step="0.01"
                                                            min="0.01"
                                                            value={
                                                                item.weight_kg ||
                                                                ''
                                                            }
                                                            onChange={(e) => {
                                                                const value =
                                                                    e.target
                                                                        .value;
                                                                if (
                                                                    value === ''
                                                                ) {
                                                                    updateCartItem(
                                                                        item.id,
                                                                        {
                                                                            weight_kg:
                                                                                null,
                                                                        },
                                                                    );
                                                                } else {
                                                                    const newWeight =
                                                                        Math.max(
                                                                            0.01,
                                                                            parseFloat(
                                                                                value,
                                                                            ) ||
                                                                                0.01,
                                                                        );
                                                                    updateCartItem(
                                                                        item.id,
                                                                        {
                                                                            weight_kg:
                                                                                newWeight,
                                                                        },
                                                                    );
                                                                }
                                                            }}
                                                            onBlur={(e) => {
                                                                const value =
                                                                    e.target
                                                                        .value;
                                                                if (
                                                                    !value ||
                                                                    parseFloat(
                                                                        value,
                                                                    ) < 0.01
                                                                ) {
                                                                    updateCartItem(
                                                                        item.id,
                                                                        {
                                                                            weight_kg: 1,
                                                                        },
                                                                    );
                                                                }
                                                            }}
                                                            className="w-24 text-center text-sm"
                                                            placeholder="Enter weight"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const newWeight =
                                                                    (item.weight_kg ||
                                                                        1) +
                                                                    0.5;
                                                                updateCartItem(
                                                                    item.id,
                                                                    {
                                                                        weight_kg:
                                                                            newWeight,
                                                                    },
                                                                );
                                                            }}
                                                            className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50"
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="border-t border-slate-200 pt-2 text-xs text-slate-500">
                                                @ ₱
                                                {formatCurrency(
                                                    item.unit_price,
                                                )}{' '}
                                                {item.type === 'coconut'
                                                    ? '/pc'
                                                    : '/kg'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center py-16 text-slate-500">
                                <Scale className="mb-4 h-16 w-16 opacity-50" />
                                <p className="text-sm">Your cart is empty</p>
                                <p className="mt-1 text-xs">
                                    Click on a category to add weigh-ins
                                </p>
                            </div>
                        )}
                    </div>

                    {cart.length > 0 && (
                        <div className="flex-shrink-0 space-y-5 border-t border-slate-200 bg-white p-5">
                            {/* Totals */}
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-bold">
                                    <span className="text-slate-900">
                                        Total Weigh-Ins
                                    </span>
                                    <span className="text-slate-900">
                                        {cartTotals.totalItems}
                                    </span>
                                </div>
                                <div className="flex justify-between text-lg font-bold">
                                    <span className="text-slate-900">
                                        Total Amount
                                    </span>
                                    <span className="text-slate-900">
                                        ₱
                                        {formatCurrency(cartTotals.totalAmount)}
                                    </span>
                                </div>
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
                                    onClick={() => setIsPinDialogOpen(true)}
                                    disabled={cart.length === 0}
                                >
                                    <Scale className="mr-2 h-4 w-4" />
                                    Process All
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
                        <Scale className="h-6 w-6" />
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
                                    Weigh-Ins Cart
                                </SheetTitle>
                                {cart.length > 0 && (
                                    <p className="mt-1 text-sm text-slate-600">
                                        {cart.length} weigh-in
                                        {cart.length !== 1 ? 's' : ''} in cart
                                    </p>
                                )}
                            </SheetHeader>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                            {cart.length > 0 ? (
                                <div className="space-y-3 sm:space-y-4">
                                    {cart.map((item) => (
                                        <div
                                            key={item.id}
                                            className="relative rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4"
                                        >
                                            <button
                                                onClick={() =>
                                                    removeFromCart(item.id)
                                                }
                                                className="absolute top-2 right-2 touch-manipulation text-slate-400 transition-colors hover:text-red-600 active:text-red-700 sm:top-3 sm:right-3"
                                            >
                                                <X className="h-4 w-4 sm:h-5 sm:w-5" />
                                            </button>
                                            <div className="space-y-3 pr-8 sm:pr-10">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-medium text-slate-900">
                                                        {getTypeLabel(
                                                            item.type,
                                                        )}
                                                    </h4>
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        ₱
                                                        {formatCurrency(
                                                            item.total_amount,
                                                        )}
                                                    </p>
                                                </div>

                                                {item.type === 'coconut' ? (
                                                    <div>
                                                        <Label
                                                            htmlFor={`count-mobile-${item.id}`}
                                                            className="text-xs"
                                                        >
                                                            Count (pcs)
                                                        </Label>
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    const newCount =
                                                                        Math.max(
                                                                            1,
                                                                            (item.count ||
                                                                                1) -
                                                                                1,
                                                                        );
                                                                    updateCartItem(
                                                                        item.id,
                                                                        {
                                                                            count: newCount,
                                                                        },
                                                                    );
                                                                }}
                                                                className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50"
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </button>
                                                            <Input
                                                                id={`count-mobile-${item.id}`}
                                                                type="number"
                                                                step="1"
                                                                min="1"
                                                                value={
                                                                    item.count ||
                                                                    ''
                                                                }
                                                                onChange={(
                                                                    e,
                                                                ) => {
                                                                    const value =
                                                                        e.target
                                                                            .value;
                                                                    if (
                                                                        value ===
                                                                        ''
                                                                    ) {
                                                                        updateCartItem(
                                                                            item.id,
                                                                            {
                                                                                count: null,
                                                                            },
                                                                        );
                                                                    } else {
                                                                        const newCount =
                                                                            Math.max(
                                                                                1,
                                                                                parseInt(
                                                                                    value,
                                                                                ) ||
                                                                                    1,
                                                                            );
                                                                        updateCartItem(
                                                                            item.id,
                                                                            {
                                                                                count: newCount,
                                                                            },
                                                                        );
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    const value =
                                                                        e.target
                                                                            .value;
                                                                    if (
                                                                        !value ||
                                                                        parseInt(
                                                                            value,
                                                                        ) < 1
                                                                    ) {
                                                                        updateCartItem(
                                                                            item.id,
                                                                            {
                                                                                count: 1,
                                                                            },
                                                                        );
                                                                    }
                                                                }}
                                                                className="w-24 text-center text-sm"
                                                                placeholder="Enter count"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const newCount =
                                                                        (item.count ||
                                                                            1) +
                                                                        1;
                                                                    updateCartItem(
                                                                        item.id,
                                                                        {
                                                                            count: newCount,
                                                                        },
                                                                    );
                                                                }}
                                                                className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <Label
                                                            htmlFor={`weight-mobile-${item.id}`}
                                                            className="text-xs"
                                                        >
                                                            Weight (kg)
                                                        </Label>
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    const newWeight =
                                                                        Math.max(
                                                                            0.01,
                                                                            (item.weight_kg ||
                                                                                1) -
                                                                                0.5,
                                                                        );
                                                                    updateCartItem(
                                                                        item.id,
                                                                        {
                                                                            weight_kg:
                                                                                newWeight,
                                                                        },
                                                                    );
                                                                }}
                                                                className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50"
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </button>
                                                            <Input
                                                                id={`weight-mobile-${item.id}`}
                                                                type="number"
                                                                step="0.01"
                                                                min="0.01"
                                                                value={
                                                                    item.weight_kg ||
                                                                    ''
                                                                }
                                                                onChange={(
                                                                    e,
                                                                ) => {
                                                                    const value =
                                                                        e.target
                                                                            .value;
                                                                    if (
                                                                        value ===
                                                                        ''
                                                                    ) {
                                                                        updateCartItem(
                                                                            item.id,
                                                                            {
                                                                                weight_kg:
                                                                                    null,
                                                                            },
                                                                        );
                                                                    } else {
                                                                        const newWeight =
                                                                            Math.max(
                                                                                0.01,
                                                                                parseFloat(
                                                                                    value,
                                                                                ) ||
                                                                                    0.01,
                                                                            );
                                                                        updateCartItem(
                                                                            item.id,
                                                                            {
                                                                                weight_kg:
                                                                                    newWeight,
                                                                            },
                                                                        );
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    const value =
                                                                        e.target
                                                                            .value;
                                                                    if (
                                                                        !value ||
                                                                        parseFloat(
                                                                            value,
                                                                        ) < 0.01
                                                                    ) {
                                                                        updateCartItem(
                                                                            item.id,
                                                                            {
                                                                                weight_kg: 1,
                                                                            },
                                                                        );
                                                                    }
                                                                }}
                                                                className="w-24 text-center text-sm"
                                                                placeholder="Enter weight"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const newWeight =
                                                                        (item.weight_kg ||
                                                                            1) +
                                                                        0.5;
                                                                    updateCartItem(
                                                                        item.id,
                                                                        {
                                                                            weight_kg:
                                                                                newWeight,
                                                                        },
                                                                    );
                                                                }}
                                                                className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="border-t border-slate-200 pt-2 text-xs text-slate-500">
                                                    @ ₱
                                                    {formatCurrency(
                                                        item.unit_price,
                                                    )}{' '}
                                                    {item.type === 'coconut'
                                                        ? '/pc'
                                                        : '/kg'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center py-16 text-slate-500">
                                    <Scale className="mb-4 h-16 w-16 opacity-50" />
                                    <p className="text-sm">
                                        Your cart is empty
                                    </p>
                                    <p className="mt-1 text-xs">
                                        Click on a category to add weigh-ins
                                    </p>
                                </div>
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="flex-shrink-0 space-y-4 border-t border-slate-200 bg-white px-6 py-4">
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-bold">
                                        <span className="text-slate-900">
                                            Total Weigh-Ins
                                        </span>
                                        <span className="text-slate-900">
                                            {cartTotals.totalItems}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold">
                                        <span className="text-slate-900">
                                            Total Amount
                                        </span>
                                        <span className="text-slate-900">
                                            ₱
                                            {formatCurrency(
                                                cartTotals.totalAmount,
                                            )}
                                        </span>
                                    </div>
                                </div>

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
                                        onClick={() => {
                                            setIsMobileCartOpen(false);
                                            setIsPinDialogOpen(true);
                                        }}
                                        disabled={cart.length === 0}
                                    >
                                        <Scale className="mr-2 h-4 w-4" />
                                        Process All
                                    </Button>
                                </div>
                            </div>
                        )}
                    </SheetContent>
                </Sheet>

                {/* PIN Dialog */}
                <Dialog
                    open={isPinDialogOpen}
                    onOpenChange={(open) => {
                        setIsPinDialogOpen(open);
                        if (!open) {
                            setPin('');
                            setPinError('');
                            (window as any).__currentTransactionId = null;
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>
                                {(window as any).__currentTransactionId
                                    ? 'Confirm Payment'
                                    : 'Enter PIN to Process Weigh-Ins'}
                            </DialogTitle>
                            <DialogDescription>
                                {(window as any).__currentTransactionId
                                    ? 'Enter your PIN to mark this transaction as paid. Only administrators can perform this action.'
                                    : 'Please enter your PIN to confirm and process all weigh-ins in the cart.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label htmlFor="pin">PIN</Label>
                                <Input
                                    id="pin"
                                    type="password"
                                    placeholder="Enter PIN"
                                    value={pin}
                                    onChange={(e) => {
                                        setPin(e.target.value);
                                        setPinError('');
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleProcessWeighIns(e);
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
                                    (window as any).__currentTransactionId =
                                        null;
                                }}
                                disabled={isProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleProcessWeighIns}
                                disabled={isProcessing || !pin}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {isProcessing
                                    ? 'Processing...'
                                    : (window as any).__currentTransactionId
                                      ? 'Mark as Paid'
                                      : 'Process All'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <Toaster />
        </>
    );
}
