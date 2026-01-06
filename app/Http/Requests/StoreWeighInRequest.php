<?php

namespace App\Http\Requests;

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
        // Check if this is a batch transaction (has items array)
        if ($this->has('items') && is_array($this->input('items'))) {
            return [
                'items' => ['required', 'array', 'min:1'],
                'items.*.type' => ['required', Rule::in(['cooked_copra', 'uncooked_copra', 'coconut'])],
                'items.*.weight_kg' => [
                    'required_if:items.*.type,cooked_copra,uncooked_copra',
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
            'type' => ['required', Rule::in(['cooked_copra', 'uncooked_copra', 'coconut'])],
            'weight_kg' => [
                'required_if:type,cooked_copra,uncooked_copra',
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
            'weight_kg.required_if' => 'Weight is required for copra weigh-ins.',
            'count.required_if' => 'Count is required for coconut weigh-ins.',
            'items.required' => 'At least one item is required for batch transaction.',
            'items.min' => 'At least one item is required for batch transaction.',
            'items.*.weight_kg.required_if' => 'Weight is required for copra weigh-ins.',
            'items.*.count.required_if' => 'Count is required for coconut weigh-ins.',
        ];
    }
}
