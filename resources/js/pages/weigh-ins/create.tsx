import { Head, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { toast } from '@/lib/toast';
import { useEffect } from 'react';
import { formatCurrency } from '@/lib/format-currency';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Weigh-Ins', href: '/weigh-ins' }, { title: 'Create', href: '/weigh-ins/create' }];

interface User {
    id: number;
    name: string;
}

interface WeighInsCreateProps {
    users: User[];
    prices: {
        cooked_copra: number | null;
        uncooked_copra: number | null;
        coconut: number | null;
    };
}

export default function WeighInsCreate({ users, prices }: WeighInsCreateProps) {
    const { data, setData, post, processing, errors } = useForm({
        type: 'cooked_copra',
        weight_kg: '',
        count: '',
        weighed_by_user_id: '',
        weighed_at: new Date().toISOString().slice(0, 16),
        notes: '',
    });

    const getCurrentPrice = () => {
        return prices[data.type as keyof typeof prices] || null;
    };

    const isCopraType = () => {
        return data.type === 'cooked_copra' || data.type === 'uncooked_copra';
    };

    const calculateTotal = () => {
        const unitPrice = getCurrentPrice();
        if (!unitPrice) return '0.00';
        
        if (isCopraType() && data.weight_kg) {
            return (parseFloat(data.weight_kg) * unitPrice).toFixed(2);
        } else if (data.type === 'coconut' && data.count) {
            return (parseInt(data.count) * unitPrice).toFixed(2);
        }
        return '0.00';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/weigh-ins', {
            onSuccess: () => {},
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                if (firstError) {
                    const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
                    toast.error(errorMessage);
                } else {
                    toast.error('Failed to create weigh-in.');
                }
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Weigh-In" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Create Weigh-In</h1>
                </div>
                <div className="max-w-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="rounded-lg border border-sidebar-border/70 p-6 dark:border-sidebar-border">
                            <h2 className="text-lg font-semibold mb-4">Weigh-In Information</h2>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="type">Type *</Label>
                                    <Select value={data.type} onValueChange={(value) => {
                                        setData('type', value);
                                        // Clear fields when switching types
                                        if (value === 'coconut') {
                                            setData('weight_kg', '');
                                        } else {
                                            setData('count', '');
                                        }
                                    }}>
                                        <SelectTrigger id="type">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cooked_copra">Cooked Copra</SelectItem>
                                            <SelectItem value="uncooked_copra">Uncooked Copra</SelectItem>
                                            <SelectItem value="coconut">Coconut</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.type && <p className="text-sm text-red-600 mt-1">{errors.type}</p>}
                                </div>

                                {isCopraType() && (
                                    <div>
                                        <Label htmlFor="weight_kg">Weight (kg) *</Label>
                                        <Input 
                                            id="weight_kg" 
                                            type="number" 
                                            step="0.01" 
                                            min="0.01" 
                                            value={data.weight_kg || ''} 
                                            onChange={(e) => setData('weight_kg', e.target.value)} 
                                            required 
                                        />
                                        {errors.weight_kg && <p className="text-sm text-red-600 mt-1">{errors.weight_kg}</p>}
                                    </div>
                                )}

                                {data.type === 'coconut' && (
                                    <div>
                                        <Label htmlFor="count">Count (pieces) *</Label>
                                        <Input 
                                            id="count" 
                                            type="number" 
                                            min="1" 
                                            value={data.count || ''} 
                                            onChange={(e) => setData('count', e.target.value)} 
                                            required 
                                        />
                                        {errors.count && <p className="text-sm text-red-600 mt-1">{errors.count}</p>}
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="unit_price">
                                        Unit Price ({isCopraType() ? 'per kg' : 'per piece'})
                                    </Label>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-600">
                                        {getCurrentPrice() !== null ? (
                                            <div className="text-lg font-semibold">₱{formatCurrency(getCurrentPrice())}</div>
                                        ) : (
                                            <div className="text-sm text-red-600">
                                                Price not set. Please set the price for {data.type} first.
                                            </div>
                                        )}
                                    </div>
                                    {getCurrentPrice() === null && (
                                        <p className="text-sm text-gray-500 mt-1">
                                            <a href="/weigh-ins/prices" className="text-blue-600 hover:underline">Set price here</a>
                                        </p>
                                    )}
                                </div>

                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                    <Label>Total Amount</Label>
                                    <div className="text-2xl font-bold mt-1">
                                        ₱{calculateTotal()}
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="weighed_by_user_id">Weighed By *</Label>
                                    <Select value={data.weighed_by_user_id || ''} onValueChange={(value) => setData('weighed_by_user_id', value)}>
                                        <SelectTrigger id="weighed_by_user_id">
                                            <SelectValue placeholder="Select a user" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users.map((user) => (
                                                <SelectItem key={user.id} value={user.id.toString()}>{user.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.weighed_by_user_id && <p className="text-sm text-red-600 mt-1">{errors.weighed_by_user_id}</p>}
                                </div>

                                <div>
                                    <Label htmlFor="weighed_at">Weighed At *</Label>
                                    <Input id="weighed_at" type="datetime-local" value={data.weighed_at || ''} onChange={(e) => setData('weighed_at', e.target.value)} required />
                                    {errors.weighed_at && <p className="text-sm text-red-600 mt-1">{errors.weighed_at}</p>}
                                </div>

                                <div>
                                    <Label htmlFor="notes">Notes</Label>
                                    <Textarea id="notes" value={data.notes || ''} onChange={(e) => setData('notes', e.target.value)} rows={3} />
                                    {errors.notes && <p className="text-sm text-red-600 mt-1">{errors.notes}</p>}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => router.visit('/weigh-ins')}>Cancel</Button>
                            <Button type="submit" disabled={processing}>{processing ? 'Creating...' : 'Create Weigh-In'}</Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

