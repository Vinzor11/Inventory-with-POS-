<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePaymentRequest;
use App\Models\Payment;
use App\Models\Sale;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

class PaymentController extends Controller
{
    /**
     * Store a new payment for a sale
     * 
     * Business Rules:
     * 1. Validates payment amount (cannot exceed balance for payments, cannot exceed total_paid for refunds)
     * 2. Creates payment record
     * 3. Automatically updates sale payment_status
     * 4. All operations in DB transaction
     * 
     * IMPORTANT: Payments are additive - never edit or delete
     * Refunds are recorded as negative payments (admin only)
     */
    public function store(StorePaymentRequest $request, Sale $sale): RedirectResponse
    {
        try {
            DB::transaction(function () use ($request, $sale) {
                // Ensure we have an authenticated user
                $user = $request->user();
                if (!$user) {
                    throw new \Exception('User must be authenticated to record payments.');
                }

                // Create payment record
                $payment = Payment::create([
                    'sale_id' => $sale->id,
                    'amount' => $request->amount,
                    'payment_method' => $request->payment_method,
                    'received_by_user_id' => $user->id,
                    'received_at' => now(),
                    'notes' => $request->notes,
                ]);

                // Refresh sale and reload payments relationship to get updated total
                $sale->refresh();
                $sale->load('payments.receivedBy');

                // Automatically update payment status based on total payments
                // This ensures payment_status is always accurate
                $sale->updatePaymentStatus();
                // Also compute sale_status (may change from COMPLETED to PARTIAL if partial payment)
                $sale->computeSaleStatus();
            });

            $message = $request->amount < 0 
                ? 'Refund recorded successfully.' 
                : 'Payment recorded successfully.';

            return redirect()->route('sales.show', $sale)
                ->with('success', $message);
        } catch (\Exception $e) {
            return redirect()->back()
                ->with('error', 'Failed to record payment: ' . $e->getMessage());
        }
    }
}
