<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use App\Models\Delivery;
use App\Models\WeighInTransaction;
use App\Services\ReceiptPrintService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class ReceiptController extends Controller
{
    /**
     * Generate sales receipt text
     */
    public function salesReceipt(Request $request, Sale $sale): Response
    {
        // Verify user has access
        if (!Auth::check()) {
            abort(403);
        }

        // Load relationships
        $sale->load([
            'items.productVariant.product',
            'cashier',
            'payments.receivedBy'
        ]);

        // Calculate payment summary
        $totalPaid = $sale->payments->sum('amount');
        $change = max(0, $totalPaid - $sale->total);
        $balance = max(0, $sale->total - $totalPaid);

        $paymentSummary = [
            'total_paid' => $totalPaid,
            'change' => $change,
            'balance' => $balance,
        ];

        // Get printer width from request or use default
        $width = (int)$request->get('width', 80); // 58 or 80
        $charWidth = $width === 58 ? 32 : 48;
        
        // Check if plain text format is requested (for RawBT/sharing)
        $format = $request->get('format', 'escpos');

        $printService = new ReceiptPrintService($charWidth);
        
        if ($format === 'plain') {
            // Generate plain text receipt without ESC/POS commands
            $receiptText = $printService->generateSalesReceiptPlain($sale, $paymentSummary);
            return response($receiptText, 200)
                ->header('Content-Type', 'text/plain; charset=utf-8')
                ->header('Content-Disposition', 'inline; filename="receipt-' . $sale->sale_number . '.txt"');
        }
        
        // Default: ESC/POS formatted receipt
        $receiptText = $printService->generateSalesReceipt($sale, $paymentSummary);

        return response($receiptText, 200)
            ->header('Content-Type', 'application/octet-stream')
            ->header('Content-Disposition', 'inline; filename="receipt-' . $sale->sale_number . '.txt"');
    }

    /**
     * Generate delivery receipt text
     * Note: This endpoint is accessible without authentication for delivery landing page
     */
    public function deliveryReceipt(Request $request, Delivery $delivery): Response
    {
        try {
            // Load relationships - ensure sale is loaded with all needed fields
            $delivery->load([
                'items.productVariant.product',
                'sale:id,sale_number,created_at,delivery_name,delivery_address,delivery_contact,cashier_user_id,total',
                'sale.cashier:id,name',
                'deliveredBy:id,name'
            ]);

            // Calculate delivery summary
            $deliverySummary = [
                'total_items' => $delivery->items->sum('quantity'),
                'total_value' => $delivery->sale ? ($delivery->sale->total ?? 0) : 0,
            ];

            // Get printer width from request or use default
            $width = (int)$request->get('width', 80); // 58 or 80
            $charWidth = $width === 58 ? 32 : 48;

            $printService = new ReceiptPrintService($charWidth);
            $receiptText = $printService->generateDeliveryReceipt($delivery, $deliverySummary);

            return response($receiptText, 200)
                ->header('Content-Type', 'application/octet-stream')
                ->header('Content-Disposition', 'inline; filename="delivery-' . $delivery->id . '.txt"');
        } catch (\Exception $e) {
            \Log::error('Delivery receipt generation failed', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response('Error generating receipt: ' . $e->getMessage(), 500)
                ->header('Content-Type', 'text/plain; charset=utf-8');
        }
    }

    /**
     * Generate weigh-in receipt for agricultural products
     */
    public function weighInReceipt(Request $request, WeighInTransaction $transaction): Response
    {
        try {
            // Load relationships
            $transaction->load([
                'weighIns',
                'weighedBy:id,name'
            ]);

            // Get printer width from request or use default
            $width = (int)$request->get('width', 80); // 58 or 80
            $charWidth = $width === 58 ? 32 : 48;
            
            // Check if plain text format is requested (for RawBT/sharing)
            $format = $request->get('format', 'escpos');

            $printService = new ReceiptPrintService($charWidth);
            
            if ($format === 'plain') {
                // Generate plain text receipt without ESC/POS commands
                $receiptText = $printService->generateWeighInReceiptPlain($transaction);
                return response($receiptText, 200)
                    ->header('Content-Type', 'text/plain; charset=utf-8')
                    ->header('Content-Disposition', 'inline; filename="weighin-' . $transaction->ref_num . '.txt"');
            }
            
            // Default: ESC/POS formatted receipt
            $receiptText = $printService->generateWeighInReceipt($transaction);

            return response($receiptText, 200)
                ->header('Content-Type', 'application/octet-stream')
                ->header('Content-Disposition', 'inline; filename="weighin-' . $transaction->ref_num . '.txt"');
        } catch (\Exception $e) {
            Log::error('Weigh-in receipt generation failed', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response('Error generating receipt: ' . $e->getMessage(), 500)
                ->header('Content-Type', 'text/plain; charset=utf-8');
        }
    }
}

