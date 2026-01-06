import { Head, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { toast } from '@/lib/toast';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Weigh-Ins', href: '/weigh-ins' },
    { title: 'Prices', href: '/weigh-ins/prices' },
];

interface WeighInPricesProps {
    prices: {
        cooked_copra: number | null;
        uncooked_copra: number | null;
        coconut: number | null;
    };
}

export default function WeighInPrices({ prices }: WeighInPricesProps) {
    const cookedCopraForm = useForm({
        price: prices.cooked_copra?.toString() || '0.00',
    });

    const uncookedCopraForm = useForm({
        price: prices.uncooked_copra?.toString() || '0.00',
    });

    const coconutForm = useForm({
        price: prices.coconut?.toString() || '0.00',
    });

    const handleCookedCopraSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        cookedCopraForm.put(`/weigh-ins/prices/cooked_copra`, {
            onSuccess: () => {
                // Flash message will be shown automatically
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                if (firstError) {
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    toast.error(errorMessage);
                } else {
                    toast.error('Failed to update cooked copra price.');
                }
            },
        });
    };

    const handleUncookedCopraSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        uncookedCopraForm.put(`/weigh-ins/prices/uncooked_copra`, {
            onSuccess: () => {
                // Flash message will be shown automatically
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                if (firstError) {
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    toast.error(errorMessage);
                } else {
                    toast.error('Failed to update uncooked copra price.');
                }
            },
        });
    };

    const handleCoconutSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        coconutForm.put(`/weigh-ins/prices/coconut`, {
            onSuccess: () => {
                // Flash message will be shown automatically
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                if (firstError) {
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    toast.error(errorMessage);
                } else {
                    toast.error('Failed to update coconut price.');
                }
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Weigh-In Prices" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Weigh-In Prices</h1>
                </div>
                <div className="max-w-2xl space-y-6">
                    {/* Cooked Copra Price */}
                    <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                        <h2 className="text-lg font-semibold mb-4">Cooked Copra Price</h2>
                        <form onSubmit={handleCookedCopraSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="cooked_copra_price">Price per kg (₱) *</Label>
                                <Input
                                    id="cooked_copra_price"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={cookedCopraForm.data.price}
                                    onChange={(e) => cookedCopraForm.setData('price', e.target.value)}
                                    required
                                />
                                {cookedCopraForm.errors.price && (
                                    <p className="text-sm text-red-600 mt-1">{cookedCopraForm.errors.price}</p>
                                )}
                            </div>
                            <Button type="submit" disabled={cookedCopraForm.processing}>
                                {cookedCopraForm.processing ? 'Updating...' : 'Update Cooked Copra Price'}
                            </Button>
                        </form>
                    </div>

                    {/* Uncooked Copra Price */}
                    <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                        <h2 className="text-lg font-semibold mb-4">Uncooked Copra Price</h2>
                        <form onSubmit={handleUncookedCopraSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="uncooked_copra_price">Price per kg (₱) *</Label>
                                <Input
                                    id="uncooked_copra_price"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={uncookedCopraForm.data.price}
                                    onChange={(e) => uncookedCopraForm.setData('price', e.target.value)}
                                    required
                                />
                                {uncookedCopraForm.errors.price && (
                                    <p className="text-sm text-red-600 mt-1">{uncookedCopraForm.errors.price}</p>
                                )}
                            </div>
                            <Button type="submit" disabled={uncookedCopraForm.processing}>
                                {uncookedCopraForm.processing ? 'Updating...' : 'Update Uncooked Copra Price'}
                            </Button>
                        </form>
                    </div>

                    {/* Coconut Price */}
                    <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                        <h2 className="text-lg font-semibold mb-4">Coconut Price</h2>
                        <form onSubmit={handleCoconutSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="coconut_price">Price per piece (₱) *</Label>
                                <Input
                                    id="coconut_price"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={coconutForm.data.price}
                                    onChange={(e) => coconutForm.setData('price', e.target.value)}
                                    required
                                />
                                {coconutForm.errors.price && (
                                    <p className="text-sm text-red-600 mt-1">{coconutForm.errors.price}</p>
                                )}
                            </div>
                            <Button type="submit" disabled={coconutForm.processing}>
                                {coconutForm.processing ? 'Updating...' : 'Update Coconut Price'}
                            </Button>
                        </form>
                    </div>

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

