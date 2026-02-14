<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Sale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    /**
     * Get payments for a sale
     */
    public function index(Sale $sale): JsonResponse
    {
        $payments = $sale->payments()->with('receivedBy')->get();

        return response()->json([
            'success' => true,
            'data' => $payments,
        ]);
    }

    /**
     * Add payment to a sale
     */
    public function store(Request $request, Sale $sale): JsonResponse
    {
        $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|in:cash,gcash,cheque,credit',
            'notes' => 'nullable|string|max:500',
        ]);

        if ($sale->status === 'VOIDED') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot add payment to a voided sale',
            ], 422);
        }

        if ($sale->payment_status === 'FULLY_PAID') {
            return response()->json([
                'success' => false,
                'message' => 'Sale is already fully paid',
            ], 422);
        }

        $payment = Payment::create([
            'sale_id' => $sale->id,
            'amount' => $request->amount,
            'payment_method' => $request->payment_method,
            'received_by_user_id' => $request->user()->id,
            'received_at' => now(),
            'notes' => $request->notes,
        ]);

        $sale->refresh();
        $sale->load('payments');
        $sale->updatePaymentStatus();
        $sale->computeSaleStatus();

        return response()->json([
            'success' => true,
            'message' => 'Payment added successfully',
            'data' => [
                'payment' => $payment->load('receivedBy'),
                'sale' => $sale->fresh()->load(['payments.receivedBy']),
            ],
        ]);
    }
}

