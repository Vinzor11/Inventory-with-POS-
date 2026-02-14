import { Head, router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { toast } from '@/lib/toast';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Weigh-Ins', href: '/weigh-ins' },
    { title: 'Prices', href: '/weigh-ins/prices' },
];

const KNOWN_TYPE_ORDER = ['cooked_copra', 'uncooked_copra', 'bagol', 'coconut'];

interface WeighInPricesProps {
    prices: Record<string, number | null>;
}

const getTypeLabel = (type: string): string =>
    type
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());

const getTypeUnit = (type: string): string =>
    type === 'coconut' ? 'per piece' : 'per kg';

export default function WeighInPrices({ prices }: WeighInPricesProps) {
    const { auth } = usePage<SharedData>().props;
    const isAdmin = auth.user?.role === 'admin';
    const [processingType, setProcessingType] = useState<string | null>(null);
    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(
            Object.entries(prices).map(([type, value]) => [
                type,
                value !== null ? String(value) : '0.00',
            ]),
        ),
    );

    const priceTypes = useMemo(() => {
        const types = Array.from(new Set(Object.keys(prices)));

        types.sort((a, b) => {
            const aIndex = KNOWN_TYPE_ORDER.indexOf(a);
            const bIndex = KNOWN_TYPE_ORDER.indexOf(b);
            const aKnown = aIndex !== -1;
            const bKnown = bIndex !== -1;

            if (aKnown && bKnown) return aIndex - bIndex;
            if (aKnown) return -1;
            if (bKnown) return 1;
            return a.localeCompare(b);
        });

        return types;
    }, [prices]);

    const handleChange = (type: string, value: string) => {
        setValues((prev) => ({
            ...prev,
            [type]: value,
        }));
    };

    const handleSubmit = (event: React.FormEvent, type: string) => {
        event.preventDefault();

        if (!isAdmin) {
            toast.error('Only administrators can update prices.');
            return;
        }

        setProcessingType(type);

        router.put(
            `/weigh-ins/prices/${type}`,
            {
                price: values[type] ?? '0',
            },
            {
                preserveScroll: true,
                onError: (errors) => {
                    const firstError = Object.values(errors)[0];
                    const errorMessage = Array.isArray(firstError)
                        ? firstError[0]
                        : firstError;
                    toast.error(errorMessage || `Failed to update ${getTypeLabel(type)} price.`);
                },
                onFinish: () => {
                    setProcessingType(null);
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Weigh-In Prices" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="hidden text-2xl font-bold md:block">Weigh-In Prices</h1>
                </div>

                {!isAdmin && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Prices are read-only. Only administrators can update weigh-in prices.
                    </div>
                )}

                <div className="max-w-2xl space-y-6">
                    {priceTypes.map((type) => {
                        const label = getTypeLabel(type);
                        const unit = getTypeUnit(type);
                        const isProcessing = processingType === type;

                        return (
                            <div
                                key={type}
                                className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border"
                            >
                                <h2 className="mb-4 text-lg font-semibold">{label} Price</h2>
                                <form
                                    onSubmit={(event) => handleSubmit(event, type)}
                                    className="space-y-4"
                                >
                                    <div>
                                        <Label htmlFor={`${type}_price`}>
                                            Price {unit} (PHP) *
                                        </Label>
                                        <Input
                                            id={`${type}_price`}
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={values[type] ?? '0.00'}
                                            onChange={(event) =>
                                                handleChange(type, event.target.value)
                                            }
                                            disabled={!isAdmin}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" disabled={!isAdmin || isProcessing}>
                                        {isProcessing ? 'Updating...' : `Update ${label} Price`}
                                    </Button>
                                </form>
                            </div>
                        );
                    })}

                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => router.visit('/weigh-ins')}>
                            Back to Weigh-Ins
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
