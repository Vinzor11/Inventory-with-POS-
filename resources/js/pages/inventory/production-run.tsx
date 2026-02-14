import { Head, Link, useForm } from '@inertiajs/react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { formatCurrency } from '@/lib/format-currency';
import { toast } from '@/lib/toast';
import { type BreadcrumbItem } from '@/types';

interface VariantSummary {
    id: number;
    product_id: number;
    product_name: string;
    description: string;
    unit: string;
    current_stock: number;
    average_cost: number;
}

interface WeighInOption {
    id: number;
    ref_num: string;
    weight_kg: number;
    weighed_at: string;
    notes: string | null;
}

interface RecentRun {
    id: number;
    batch_code: string;
    production_date: string;
    run_type: 'coconut_to_uncooked' | 'uncooked_to_cooked' | 'coconut_to_cooked';
    input_qty: number;
    output_qty: number;
    yield_percent: number | null;
    shrinkage_percent: number | null;
    created_by: { id: number; name: string } | null;
}

interface ProductionThresholds {
    warn_kg_per_pc: number;
    max_kg_per_pc: number;
}

interface ProductionRunPageProps {
    runType: 'coconut_to_uncooked' | 'uncooked_to_cooked' | 'coconut_to_cooked';
    inputVariant: VariantSummary;
    outputVariant: VariantSummary;
    latestWeighIns: WeighInOption[];
    recentRuns: RecentRun[];
    defaults: {
        production_date: string;
    };
    thresholds: ProductionThresholds;
}

export default function ProductionRunPage({
    runType,
    inputVariant,
    outputVariant,
    latestWeighIns,
    recentRuns,
    defaults,
    thresholds,
}: ProductionRunPageProps) {
    const runTypePath =
        runType === 'coconut_to_uncooked'
            ? '/inventory/production/coconut-to-uncooked'
            : runType === 'uncooked_to_cooked'
              ? '/inventory/production/uncooked-to-cooked'
              : '/inventory/production/coconut-to-cooked';

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Inventory', href: '/inventory' },
        { title: 'Production Run', href: runTypePath },
    ];

    const { data, setData, post, processing, errors, transform } = useForm({
        run_type: runType,
        input_variant_id: String(inputVariant.id),
        output_variant_id: String(outputVariant.id),
        input_qty: '',
        output_weight_kg: '',
        output_weigh_in_id: 'none',
        record_weigh_in: false,
        production_date: defaults.production_date,
        operator: '',
        supplier_source: '',
        drying_method: '',
        notes: '',
    });

    const selectedWeighIn = useMemo(
        () => latestWeighIns.find((item) => String(item.id) === data.output_weigh_in_id),
        [latestWeighIns, data.output_weigh_in_id],
    );

    const inputQty = Number(data.input_qty || 0);
    const outputQty = selectedWeighIn
        ? Number(selectedWeighIn.weight_kg || 0)
        : Number(data.output_weight_kg || 0);
    const normalizedInputUnit = inputVariant.unit.toLowerCase();
    const normalizedOutputUnit = outputVariant.unit.toLowerCase();
    const isPieceToKgRun = normalizedInputUnit === 'pcs' && normalizedOutputUnit === 'kg';

    const estimatedInputCost = inputQty * Number(inputVariant.average_cost || 0);
    const estimatedOutputCostPerKg = outputQty > 0 ? estimatedInputCost / outputQty : 0;
    const estimatedYieldPercent = !isPieceToKgRun && inputQty > 0 ? (outputQty / inputQty) * 100 : 0;
    const outputPerCoconut = isPieceToKgRun && inputQty > 0 ? outputQty / inputQty : null;
    const coconutsPerKg = isPieceToKgRun && outputQty > 0 ? inputQty / outputQty : null;
    const warningKgPerPc = Number(thresholds.warn_kg_per_pc || 0.4);
    const maxKgPerPc = Number(thresholds.max_kg_per_pc || 0.6);
    const isWarningOutputPerCoconut =
        outputPerCoconut !== null && outputPerCoconut > warningKgPerPc;
    const isCriticalOutputPerCoconut =
        outputPerCoconut !== null && outputPerCoconut > maxKgPerPc;

    const shrinkageQty = inputQty - outputQty;
    const shrinkagePercent = inputQty > 0 ? (shrinkageQty / inputQty) * 100 : 0;

    const runTypeTitle =
        runType === 'coconut_to_uncooked'
            ? 'Coconut -> Uncooked Copra'
            : runType === 'uncooked_to_cooked'
              ? 'Uncooked Copra -> Cooked Copra'
              : 'Coconut -> Cooked Copra';

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        if (isCriticalOutputPerCoconut) {
            toast.error('Output weight exceeds realistic biological limits.');
            return;
        }

        transform((formData) => ({
            ...formData,
            output_weigh_in_id:
                formData.output_weigh_in_id && formData.output_weigh_in_id !== 'none'
                    ? Number(formData.output_weigh_in_id)
                    : null,
            record_weigh_in: Boolean(formData.record_weigh_in),
        }));

        post('/inventory/production-runs', {
            preserveScroll: true,
            onError: (validationErrors) => {
                const firstError = Object.values(validationErrors)[0];
                if (firstError) {
                    toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
                }
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Production - ${runTypeTitle}`} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant={runType === 'coconut_to_uncooked' ? 'default' : 'outline'}
                        asChild
                    >
                        <Link href="/inventory/production/coconut-to-uncooked">
                            Coconut to Uncooked
                        </Link>
                    </Button>
                    <Button
                        variant={runType === 'uncooked_to_cooked' ? 'default' : 'outline'}
                        asChild
                    >
                        <Link href="/inventory/production/uncooked-to-cooked">
                            Uncooked to Cooked
                        </Link>
                    </Button>
                    <Button
                        variant={runType === 'coconut_to_cooked' ? 'default' : 'outline'}
                        asChild
                    >
                        <Link href="/inventory/production/coconut-to-cooked">
                            Coconut to Cooked
                        </Link>
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        <div className="rounded-lg border p-4">
                            <h2 className="mb-3 text-lg font-semibold">{runTypeTitle}</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <Label>Input Product</Label>
                                    <p className="text-sm font-medium">{inputVariant.product_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Stock: {inputVariant.current_stock} {inputVariant.unit}
                                    </p>
                                </div>
                                <div>
                                    <Label>Output Product</Label>
                                    <p className="text-sm font-medium">{outputVariant.product_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Stock: {outputVariant.current_stock} {outputVariant.unit}
                                    </p>
                                </div>
                                <div>
                                    <Label htmlFor="input_qty">Input Quantity ({inputVariant.unit}) *</Label>
                                    <Input
                                        id="input_qty"
                                        type="number"
                                        step="0.0001"
                                        min="0.0001"
                                        value={data.input_qty}
                                        onChange={(event) => setData('input_qty', event.target.value)}
                                        required
                                    />
                                    {errors.input_qty && (
                                        <p className="mt-1 text-sm text-red-600">{errors.input_qty}</p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="output_weight_kg">Output Weight ({outputVariant.unit}) *</Label>
                                    <Input
                                        id="output_weight_kg"
                                        type="number"
                                        step="0.0001"
                                        min="0.0001"
                                        value={selectedWeighIn ? selectedWeighIn.weight_kg : data.output_weight_kg}
                                        onChange={(event) => {
                                            setData('output_weigh_in_id', 'none');
                                            setData('output_weight_kg', event.target.value);
                                        }}
                                        disabled={Boolean(selectedWeighIn)}
                                        required={!selectedWeighIn}
                                    />
                                    {errors.output_weight_kg && (
                                        <p className="mt-1 text-sm text-red-600">{errors.output_weight_kg}</p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Use Existing Weigh-In (Optional)</Label>
                                    <Select
                                        value={data.output_weigh_in_id}
                                        onValueChange={(value) => {
                                            setData('output_weigh_in_id', value);
                                            if (value === 'none') {
                                                setData('output_weight_kg', '');
                                            } else {
                                                const selected = latestWeighIns.find(
                                                    (item) => String(item.id) === value,
                                                );
                                                if (selected) {
                                                    setData('output_weight_kg', String(selected.weight_kg));
                                                }
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select recent weigh-in" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None (enter weight manually)</SelectItem>
                                            {latestWeighIns.map((weighIn) => (
                                                <SelectItem key={weighIn.id} value={String(weighIn.id)}>
                                                    {weighIn.ref_num} - {weighIn.weight_kg} kg
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <label className="flex items-center gap-2 text-sm md:col-span-2">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(data.record_weigh_in)}
                                        onChange={(event) => setData('record_weigh_in', event.target.checked)}
                                    />
                                    Record new weigh-in inline when no weigh-in is selected
                                </label>
                            </div>
                        </div>

                        <div className="rounded-lg border p-4">
                            <h2 className="mb-3 text-lg font-semibold">Run Details</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <Label htmlFor="production_date">Production Date *</Label>
                                    <Input
                                        id="production_date"
                                        type="date"
                                        value={data.production_date}
                                        onChange={(event) => setData('production_date', event.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="operator">Operator</Label>
                                    <Input
                                        id="operator"
                                        value={data.operator}
                                        onChange={(event) => setData('operator', event.target.value)}
                                        placeholder="Operator name"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="supplier_source">Supplier Source</Label>
                                    <Input
                                        id="supplier_source"
                                        value={data.supplier_source}
                                        onChange={(event) => setData('supplier_source', event.target.value)}
                                        placeholder="Source of raw materials"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="drying_method">Drying Method</Label>
                                    <Input
                                        id="drying_method"
                                        value={data.drying_method}
                                        onChange={(event) => setData('drying_method', event.target.value)}
                                        placeholder="Sun dry, kiln dry, etc."
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor="notes">Notes</Label>
                                    <Textarea
                                        id="notes"
                                        value={data.notes}
                                        onChange={(event) => setData('notes', event.target.value)}
                                        rows={3}
                                        placeholder="Optional production notes"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-lg border p-4">
                            <h2 className="mb-3 text-lg font-semibold">Computed Preview</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span>Estimated Input Cost</span>
                                    <span className="font-medium">P {formatCurrency(estimatedInputCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Estimated Output Cost/kg</span>
                                    <span className="font-medium">P {formatCurrency(estimatedOutputCostPerKg)}</span>
                                </div>
                                {isPieceToKgRun ? (
                                    <>
                                        <div className="flex justify-between">
                                            <span>Output per Coconut</span>
                                            <span className="font-medium">
                                                {outputPerCoconut !== null ? outputPerCoconut.toFixed(2) : '0.00'} kg/pc
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Coconuts per 1kg</span>
                                            <span className="font-medium">
                                                {coconutsPerKg !== null ? coconutsPerKg.toFixed(2) : '0.00'} pcs/kg
                                            </span>
                                        </div>
                                        {isWarningOutputPerCoconut && !isCriticalOutputPerCoconut && (
                                            <div className="rounded border border-yellow-300 bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800">
                                                Warning: Output per coconut seems unusually high. Please verify weigh-in.
                                            </div>
                                        )}
                                        {isCriticalOutputPerCoconut && (
                                            <div className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                                                Output weight exceeds realistic biological limits. Saving is disabled.
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex justify-between">
                                        <span>Yield</span>
                                        <span className="font-medium">{formatCurrency(estimatedYieldPercent)}%</span>
                                    </div>
                                )}
                                {runType === 'uncooked_to_cooked' && (
                                    <>
                                        <div className="flex justify-between">
                                            <span>Shrinkage Qty</span>
                                            <span className="font-medium">{shrinkageQty.toFixed(4)} kg</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Shrinkage %</span>
                                            <span className="font-medium">{formatCurrency(shrinkagePercent)}%</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="rounded-lg border p-4">
                            <h2 className="mb-3 text-lg font-semibold">Recent Batches</h2>
                            <div className="space-y-2 text-xs">
                                {recentRuns.length === 0 && <p className="text-muted-foreground">No runs yet.</p>}
                                {recentRuns.map((run) => (
                                    <div key={run.id} className="rounded border p-2">
                                        <p className="font-semibold">{run.batch_code}</p>
                                        <p>{`${run.input_qty} -> ${run.output_qty}`}</p>
                                        {run.run_type === 'uncooked_to_cooked' ? (
                                            <p>Shrinkage: {run.shrinkage_percent ?? 0}%</p>
                                        ) : (
                                            <p>
                                                Output/Coconut:{' '}
                                                {run.input_qty > 0
                                                    ? (run.output_qty / run.input_qty).toFixed(2)
                                                    : '0.00'}{' '}
                                                kg/pc
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={processing || isCriticalOutputPerCoconut}
                            className="w-full"
                        >
                            {processing ? 'Saving...' : 'Save Production Run'}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
