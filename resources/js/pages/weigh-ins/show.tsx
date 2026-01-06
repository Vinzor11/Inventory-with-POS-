import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { formatCurrency } from '@/lib/format-currency';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Weigh-Ins', href: '/weigh-ins' }, { title: 'Details', href: '#' }];

interface WeighIn {
    id: number;
    type: 'cooked_copra' | 'uncooked_copra' | 'coconut';
    weight_kg: number | null;
    count: number | null;
    unit_price: number;
    total_amount: number;
    weighed_by: { id: number; name: string };
    weighed_at: string;
    notes: string | null;
}

interface WeighInsShowProps {
    weighIn: WeighIn;
}

export default function WeighInsShow({ weighIn }: WeighInsShowProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Weigh-In #${weighIn.id}`} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Weigh-In Details</h1>
                </div>
                <div className="max-w-2xl">
                    <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                        <h2 className="text-lg font-semibold mb-4">Weigh-In Information</h2>
                        <div className="space-y-3">
                            <div>
                                <strong>Type:</strong> <span className="capitalize">{weighIn.type.replace('_', ' ')}</span>
                            </div>
                            {(weighIn.type === 'cooked_copra' || weighIn.type === 'uncooked_copra') ? (
                                <div>
                                    <strong>Weight:</strong> {weighIn.weight_kg} kg
                                </div>
                            ) : (
                                <div>
                                    <strong>Count:</strong> {weighIn.count} pieces
                                </div>
                            )}
                            <div>
                                <strong>Unit Price:</strong> ₱{formatCurrency(weighIn.unit_price)} {(weighIn.type === 'cooked_copra' || weighIn.type === 'uncooked_copra') ? 'per kg' : 'per piece'}
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                <strong>Total Amount:</strong> <span className="text-2xl font-bold ml-2">₱{formatCurrency(weighIn.total_amount)}</span>
                            </div>
                            <div>
                                <strong>Weighed By:</strong> {weighIn.weighed_by.name}
                            </div>
                            <div>
                                <strong>Weighed At:</strong> {new Date(weighIn.weighed_at).toLocaleString()}
                            </div>
                            {weighIn.notes && (
                                <div>
                                    <strong>Notes:</strong> {weighIn.notes}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

