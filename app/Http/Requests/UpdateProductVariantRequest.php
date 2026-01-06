<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateProductVariantRequest extends FormRequest
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
        return [
            'size' => ['nullable', 'string', 'max:100'],
            'thickness' => ['nullable', 'string', 'max:100'],
            'diameter' => ['nullable', 'string', 'max:100'],
            'description' => ['required', 'string', 'max:500'],
            'unit_price' => ['required', 'numeric', 'min:0', 'decimal:0,2'],
            'purchase_price' => ['nullable', 'numeric', 'min:0', 'decimal:0,2'],
        ];
    }

    /**
     * Ensure at least one physical attribute is provided
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $hasPhysicalAttribute = !empty($this->size) ||
                                   !empty($this->thickness) ||
                                   !empty($this->diameter);

            if (!$hasPhysicalAttribute) {
                $validator->errors()->add('physical_attributes',
                    'At least one physical attribute (size, thickness, or diameter) must be specified.');
            }
        });
    }
}
