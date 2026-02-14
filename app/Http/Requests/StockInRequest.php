<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StockInRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * Only admins can perform stock-in operations
     */
    public function authorize(): bool
    {
        return $this->user()?->can('can_receive_stock') ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     * 
     * Stock-in requires:
     * - product_variant_id: must exist
     * - quantity: must be positive
     * - unit_cost: must be positive (required for IN movements)
     * - notes: optional
     */
    public function rules(): array
    {
        return [
            'product_variant_id' => 'required|exists:product_variants,id',
            'quantity' => 'required|numeric|min:0.0001',
            'unit_cost' => 'required|numeric|min:0.0001',
            'received_at' => 'nullable|date',
            'notes' => 'nullable|string|max:1000',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'product_variant_id.required' => 'Please select a product variant.',
            'product_variant_id.exists' => 'The selected product variant does not exist.',
            'quantity.required' => 'Quantity is required.',
            'quantity.min' => 'Quantity must be greater than zero.',
            'unit_cost.required' => 'Unit cost is required for stock-in operations.',
            'unit_cost.min' => 'Unit cost must be greater than zero.',
        ];
    }
}
