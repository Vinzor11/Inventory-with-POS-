<?php

namespace App\Http\Requests;

use App\Models\Sale;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePaymentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * Staff and admins can add payments
     */
    public function authorize(): bool
    {
        return auth()->check();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * Business Rules:
     * - amount: required, must be > 0 for payments, < 0 for refunds
     * - payment_method: required, must be valid enum value
     * - notes: optional
     * - amount cannot exceed remaining balance (for payments)
     * - refunds cannot reduce total_paid below zero
     */
    public function rules(): array
    {
        $sale = $this->route('sale');
        
        // Refresh sale to ensure we have latest payment data
        $sale->refresh();
        $sale->load('payments');
        
        // Get current total_paid (includes previous refunds as negative payments)
        $totalPaid = $sale->total_paid;
        $balance = $sale->balance;

        return [
            'amount' => [
                'required',
                'numeric',
                function ($attribute, $value, $fail) use ($sale, $totalPaid, $balance) {
                    // Refresh to get latest total_paid in case of concurrent updates
                    $sale->refresh();
                    $sale->load('payments');
                    $currentTotalPaid = $sale->total_paid;
                    
                    // For payments (positive amount)
                    if ($value > 0) {
                        // Cannot exceed remaining balance
                        if ($value > $balance) {
                            $fail("Payment amount cannot exceed remaining balance of $" . number_format($balance, 2));
                        }
                    }
                    // For refunds (negative amount)
                    elseif ($value < 0) {
                        // Only admins can create refunds
                        if (!$this->user()?->isAdmin()) {
                            $fail('Only administrators can process refunds.');
                        }
                        // Cannot reduce total paid below zero
                        // Use currentTotalPaid which reflects all payments including previous refunds
                        if (abs($value) > $currentTotalPaid) {
                            $fail("Refund amount cannot exceed remaining refundable amount of $" . number_format($currentTotalPaid, 2) . " (current total paid after previous refunds)");
                        }
                    }
                    // Zero is not allowed
                    else {
                        $fail('Payment amount must be greater than or less than zero.');
                    }
                },
            ],
            'payment_method' => ['required', 'string', Rule::in(['cash', 'gcash', 'cheque', 'credit'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'amount.required' => 'Payment amount is required.',
            'amount.numeric' => 'Payment amount must be a valid number.',
            'payment_method.required' => 'Payment method is required.',
            'payment_method.in' => 'Invalid payment method selected.',
        ];
    }
}
