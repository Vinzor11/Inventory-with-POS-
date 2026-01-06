<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class InventoryAdjustmentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * Only admins can perform inventory adjustments
     */
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin') ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     * 
     * Adjustments require:
     * - product_variant_id: must exist
     * - quantity: can be positive or negative (for adjustments)
     * - reason: required (damage, loss, recount, initial_stock, etc.)
     * - notes: required for audit trail
     */
    public function rules(): array
    {
        return [
            'product_variant_id' => 'required|exists:product_variants,id',
            'quantity' => 'required|numeric',
            'reason' => 'required|string|max:255',
            'notes' => 'required|string|max:1000',
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
            'reason.required' => 'Reason is required for inventory adjustments.',
            'notes.required' => 'Notes are required for audit trail.',
        ];
    }
}
