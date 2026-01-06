<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaleCheckoutRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * Staff and admins can create sales
     */
    public function authorize(): bool
    {
        return auth()->check();
    }

    /**
     * Get the validation rules that apply to the request.
     * 
     * Business Rules:
     * - items: array of cart items, each with product_variant_id, quantity
     * - pin: required for cashier authentication
     * - payment_amount: optional, but if provided must be >= 0
     * - payment_method: required if payment_amount > 0
     * - notes: optional
     * - Agricultural products cannot be sold through POS
     */
    public function rules(): array
    {
        $paymentAmount = $this->input('payment_amount', 0);

        return [
            'items' => 'required|array|min:1',
            'items.*.product_variant_id' => [
                'required',
                'exists:product_variants,id',
                function ($attribute, $value, $fail) {
                    // Check if product variant belongs to Agricultural Products category
                    $variant = \App\Models\ProductVariant::with('product.category')->find($value);
                    if ($variant && $variant->product->category && $variant->product->category->name === 'Agricultural Products') {
                        $fail('Agricultural products (copra/coconut) cannot be sold through the POS. Please use the agricultural sales system instead.');
                    }
                },
            ],
            'items.*.quantity' => 'required|numeric|min:0.01',
            'pin' => 'required|string',
            'payment_amount' => 'nullable|numeric|min:0',
            'payment_method' => [
                $paymentAmount > 0 ? 'required' : 'nullable',
                'string',
                Rule::in(['cash', 'gcash', 'cheque', 'credit']),
            ],
            'notes' => 'nullable|string|max:1000',
            'is_for_delivery' => 'nullable|boolean',
            'delivery_name' => 'nullable|string|max:255|required_if:is_for_delivery,true',
            'delivery_address' => 'nullable|string|max:1000|required_if:is_for_delivery,true',
            'delivery_contact' => 'nullable|string|max:50|required_if:is_for_delivery,true',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'items.required' => 'Cart cannot be empty.',
            'items.min' => 'Cart must contain at least one item.',
            'items.*.product_variant_id.required' => 'Product variant is required for each item.',
            'items.*.product_variant_id.exists' => 'One or more product variants are invalid.',
            'items.*.quantity.required' => 'Quantity is required for each item.',
            'items.*.quantity.min' => 'Quantity must be greater than zero.',
            'pin.required' => 'PIN is required to complete the transaction.',
        ];
    }
}

