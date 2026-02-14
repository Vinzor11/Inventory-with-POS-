<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Models\WeighInPrice;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWeighInRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled by policies
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $allowedTypes = $this->getAllowedWeighInTypes();
        $weightBasedTypes = array_values(array_filter($allowedTypes, function (string $type) {
            return $type !== 'coconut';
        }));

        $singleWeightRequiredRule = !empty($weightBasedTypes)
            ? 'required_if:type,' . implode(',', $weightBasedTypes)
            : 'nullable';

        $batchWeightRequiredRule = !empty($weightBasedTypes)
            ? 'required_if:items.*.type,' . implode(',', $weightBasedTypes)
            : 'nullable';

        // Check if this is a batch transaction (has items array)
        if ($this->has('items') && is_array($this->input('items'))) {
            return [
                'items' => ['required', 'array', 'min:1'],
                'items.*.type' => ['required', Rule::in($allowedTypes)],
                'items.*.weight_kg' => [
                    $batchWeightRequiredRule,
                    'nullable',
                    'numeric',
                    'min:0.01',
                ],
                'items.*.count' => [
                    'required_if:items.*.type,coconut',
                    'nullable',
                    'integer',
                    'min:1',
                ],
                'items.*.notes' => ['nullable', 'string', 'max:1000'],
                'weighed_by_user_id' => ['required', 'exists:users,id'],
                'weighed_at' => ['required', 'date'],
                'notes' => ['nullable', 'string', 'max:1000'],
            ];
        }

        // Single weigh-in (backward compatible)
        return [
            'type' => ['required', Rule::in($allowedTypes)],
            'weight_kg' => [
                $singleWeightRequiredRule,
                'nullable',
                'numeric',
                'min:0.01',
            ],
            'count' => [
                'required_if:type,coconut',
                'nullable',
                'integer',
                'min:1',
            ],
            'weighed_by_user_id' => ['required', 'exists:users,id'],
            'weighed_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'weight_kg.required_if' => 'Weight is required for kg-based weigh-ins.',
            'count.required_if' => 'Count is required for coconut weigh-ins.',
            'items.required' => 'At least one item is required for batch transaction.',
            'items.min' => 'At least one item is required for batch transaction.',
            'items.*.weight_kg.required_if' => 'Weight is required for kg-based weigh-ins.',
            'items.*.count.required_if' => 'Count is required for coconut weigh-ins.',
        ];
    }

    /**
     * @return array<int, string>
     */
    private function getAllowedWeighInTypes(): array
    {
        $agriTypes = Product::query()
            ->whereHas('category', function ($query) {
                $query->where('name', 'Agricultural Products');
            })
            ->get(['name', 'sku'])
            ->map(function (Product $product) {
                return $this->inferTypeKeyFromProduct($product);
            })
            ->filter()
            ->unique()
            ->values()
            ->all();

        return array_values(array_unique(array_merge(
            ['cooked_copra', 'uncooked_copra', 'bagol', 'coconut'],
            WeighInPrice::query()->pluck('type')->all(),
            $agriTypes
        )));
    }

    private function inferTypeKeyFromProduct(Product $product): ?string
    {
        $sku = trim((string) $product->sku);
        if ($sku !== '') {
            return strtolower(str_replace('-', '_', $sku));
        }

        $name = trim((string) $product->name);
        if ($name === '') {
            return null;
        }

        $normalized = strtolower(trim((string) preg_replace('/[^a-z0-9]+/i', '_', $name), '_'));
        return $normalized !== '' ? $normalized : null;
    }
}
