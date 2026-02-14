<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductionRunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('can_produce') ?? false;
    }

    public function rules(): array
    {
        return [
            'run_type' => 'required|in:coconut_to_uncooked,uncooked_to_cooked,coconut_to_cooked',
            'input_variant_id' => 'nullable|exists:product_variants,id',
            'output_variant_id' => 'nullable|exists:product_variants,id',
            'input_qty' => 'required|numeric|min:0.0001',
            'output_weight_kg' => 'required_without:output_weigh_in_id|nullable|numeric|min:0.0001',
            'output_weigh_in_id' => 'nullable|exists:weigh_ins,id',
            'record_weigh_in' => 'nullable|boolean',
            'production_date' => 'required|date',
            'operator' => 'nullable|string|max:255',
            'supplier_source' => 'nullable|string|max:255',
            'drying_method' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ];
    }

    public function messages(): array
    {
        return [
            'run_type.required' => 'Production run type is required.',
            'input_qty.required' => 'Input quantity is required.',
            'output_weight_kg.required_without' => 'Output weight or a weigh-in reference is required.',
            'production_date.required' => 'Production date is required.',
        ];
    }
}
