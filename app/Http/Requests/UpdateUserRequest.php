<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($this->route('user')),
            ],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'pin' => [
                'nullable',
                'string',
                'regex:/^\d{4,6}$/',
                Rule::unique(User::class)->ignore($this->route('user')),
            ],
            'role' => ['nullable', 'string', Rule::in(['admin', 'staff'])],
        ];
    }
}
