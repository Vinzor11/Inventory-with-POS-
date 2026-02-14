import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { MobileRecordCard, MobileRecordRow } from '@/components/mobile/record-card';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Deliveries', href: '/deliveries' }, { title: 'Details', href: '#' }];

interface Delivery {
    id: number;
    sale: { id: number; sale_number: string };
    delivered_by: { id: number; name: string } | null;
    delivered_at: string | null;
    status: 'pending' | 'partial' | 'delivered';
    notes: string | null;
    items: Array<{
        id: number;
        quantity: number;
        product_variant: { id: number; description: string; product: { id: number; name: string } };
    }>;
}

interface DeliveriesShowProps {
    delivery: Delivery;
}

export default function DeliveriesShow({ delivery }: DeliveriesShowProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Delivery ${delivery.sale.sale_number}`} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="hidden text-2xl font-bold md:block">Delivery Details</h1>
                </div>
                <div className="max-w-4xl space-y-6">
                    <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                        <h2 className="text-lg font-semibold mb-4">Delivery Information</h2>
                        <div className="space-y-2">
                            <p><strong>Sale Number:</strong> {delivery.sale.sale_number}</p>
                            <p><strong>Delivered By:</strong> {delivery.delivered_by?.name || 'Not assigned'}</p>
                            <p><strong>Delivered At:</strong> {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleString() : 'Pending'}</p>
                            <p><strong>Status:</strong> <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                delivery.status === 'delivered' 
                                    ? 'bg-green-100 text-green-800' 
                                    : delivery.status === 'partial'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-yellow-100 text-yellow-800'
                            }`}>{delivery.status}</span></p>
                            {delivery.notes && <p><strong>Notes:</strong> {delivery.notes}</p>}
                        </div>
                    </div>
                    <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                        <h2 className="text-lg font-semibold mb-4">Delivery Items</h2>
                        <div className="space-y-3 md:hidden">
                            {delivery.items.map((item) => (
                                <MobileRecordCard
                                    key={item.id}
                                    title={item.product_variant.product.name}
                                    subtitle={item.product_variant.description}
                                    value={String(item.quantity)}
                                >
                                    <MobileRecordRow label="Quantity" value={String(item.quantity)} />
                                </MobileRecordCard>
                            ))}
                        </div>
                        <div className="hidden md:block">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2">Product</th>
                                        <th className="text-left p-2">Variant</th>
                                        <th className="text-left p-2">Quantity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {delivery.items.map((item) => (
                                        <tr key={item.id} className="border-b">
                                            <td className="p-2">{item.product_variant.product.name}</td>
                                            <td className="p-2">{item.product_variant.description}</td>
                                            <td className="p-2">{item.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}


