<?php

namespace App\Services;

use App\Models\Sale;
use App\Models\Delivery;
use App\Models\WeighInTransaction;

class ReceiptPrintService
{
    private const WIDTH_58MM = 32;
    private const WIDTH_80MM = 48;
    
    private int $width;
    private string $storeName = 'JOSHUA Construction Supply & Trading';
    private string $storeAddress = 'Brgy. Tamoso, Borongan City';
    private string $storeContact = '0927-848-9348';

    public function __construct(int $width = self::WIDTH_80MM)
    {
        $this->width = $width;
    }

    // ========================================================================
    // SALES RECEIPT (POS CHECKOUT)
    // ========================================================================

    public function generateSalesReceipt(Sale $sale, array $paymentSummary): string
    {
        $lines = [];
        
        // Header - initialize printer and set minimal margins
        // ESC @ = Initialize, ESC 3 n = Set line spacing to n/180 inch (0 = minimal)
        $init = "\x1B\x40" . "\x1B\x33\x00";
        $lines[] = $init . $this->centerTextBoldLarge('JOSHUA Construction');
        $lines[] = $this->centerTextBoldLarge('Supply & Trading');
        $lines[] = $this->centerText($this->storeAddress);
        $lines[] = $this->centerText("Mobile No: {$this->storeContact}");
        $lines[] = "";
        $lines[] = $this->separator('=');
        
        // Receipt title with disclaimer
        $lines[] = $this->centerText("SALES INVOICE");
        $lines[] = $this->centerText("NOT AN OFFICIAL RECEIPT");
        $lines[] = $this->separator('-');
        
        // Transaction info
        $lines[] = "SI No: " . $sale->sale_number;
        $lines[] = "Date: " . $this->formatDateTime($sale->created_at);
        $lines[] = "Cashier: " . ($sale->cashier->name ?? 'N/A');
        $lines[] = $this->separator('-');
        
        // Items Header
        $lines[] = $this->formatSalesItemHeader();
        $lines[] = $this->separator('-');
        
        // Items
        foreach ($sale->items as $item) {
            $variant = $item->productVariant;
            $product = $variant->product;
            $itemName = $this->buildItemName($product, $variant);
            
            $lines = array_merge($lines, $this->formatSalesItem(
                $itemName,
                (float)$item->quantity,
                (float)$item->unit_price,
                (float)$item->line_total
            ));
        }
        
        $lines[] = $this->separator('-');
        
        // Totals
        $lines[] = $this->formatAmountLine("Subtotal", (float)$sale->subtotal);
        $discount = $paymentSummary['discount'] ?? 0;
        if ($discount > 0) {
            $lines[] = $this->formatAmountLine("Discount", -$discount);
        }
        $lines[] = $this->separator('-');
        $grossTotal = (float)($paymentSummary['gross_total'] ?? $sale->total);
        $totalRefunded = (float)($paymentSummary['total_refunded'] ?? 0);
        $netTotal = (float)($paymentSummary['net_total'] ?? $grossTotal);
        $lines[] = $this->formatAmountLineBold("TOTAL DUE", $grossTotal);
        if ($totalRefunded > 0) {
            $lines[] = $this->formatAmountLine("Total Refunded", -$totalRefunded);
            $lines[] = $this->formatAmountLineBold("NET TOTAL", $netTotal);
        }
        
        // Payment info
        $totalPaid = $paymentSummary['total_paid'] ?? 0;
        if ($totalPaid > 0) {
            $paymentMethod =
                ucfirst(
                    strtolower(
                        $sale->payments
                            ->first(fn ($payment) => (float) $payment->amount > 0)
                            ?->payment_method ?? 'Cash'
                    )
                );
            $lines[] = $this->formatAmountLine($paymentMethod, $totalPaid);
            $change = $paymentSummary['change'] ?? 0;
            if ($change > 0) {
                $lines[] = $this->formatAmountLine("Change", $change);
            }
            $balance = $paymentSummary['balance'] ?? 0;
            if ($balance > 0) {
                $lines[] = $this->formatAmountLine("Balance", $balance);
            }
        } else {
            $lines[] = "";
            $lines[] = $this->centerText("** UNPAID **");
        }
        
        // Delivery info
        if ($sale->is_for_delivery) {
            $lines[] = $this->separator('-');
            $deliveryLine = "DELIVER TO: " . ($sale->delivery_name ?? 'N/A');
            $lines[] = $deliveryLine;
            
            $addressParts = [];
            if ($sale->delivery_address) {
                $addressParts[] = $sale->delivery_address;
            }
            if ($sale->delivery_contact) {
                $addressParts[] = "Mobile No: " . $sale->delivery_contact;
            }
            if ($addressParts) {
                $addressLine = implode('  ', $addressParts);
                $wrapped = wordwrap($addressLine, $this->width, "\n", true);
                foreach (explode("\n", $wrapped) as $line) {
                    $lines[] = $line;
                }
            }
        }
        
        // Footer
        $lines[] = $this->separator('-');
        $lines[] = $this->centerText("Thank you for shopping!");
        $lines[] = $this->centerText("Please keep this receipt.");
        $lines[] = $this->separator('-');
        $lines[] = "";
        $lines[] = "Printed: " . $this->formatDateTime(now());
        $lines[] = $this->separator('=');
        
        // Feed and cut
        $lines[] = "\n\n\n";
        $lines[] = "\x1D\x56\x00";
        
        return implode("\n", $lines);
    }

    /**
     * Generate plain text sales receipt (no ESC/POS commands)
     * For use with RawBT and text sharing on mobile devices
     */
    public function generateSalesReceiptPlain(Sale $sale, array $paymentSummary): string
    {
        $lines = [];
        
        // Header - plain text, centered manually
        $lines[] = $this->centerText("JOSHUA Construction");
        $lines[] = $this->centerText("Supply & Trading");
        $lines[] = $this->centerText($this->storeAddress);
        $lines[] = $this->centerText("Mobile No: {$this->storeContact}");
        $lines[] = "";
        $lines[] = $this->separator('=');
        
        // Receipt title with disclaimer
        $lines[] = $this->centerText("SALES INVOICE");
        $lines[] = $this->centerText("NOT AN OFFICIAL RECEIPT");
        $lines[] = $this->separator('-');
        
        // Transaction info
        $lines[] = "SI No: " . $sale->sale_number;
        $lines[] = "Date: " . $this->formatDateTime($sale->created_at);
        $lines[] = "Cashier: " . ($sale->cashier->name ?? 'N/A');
        $lines[] = $this->separator('-');
        
        // Items Header
        $lines[] = $this->formatSalesItemHeader();
        $lines[] = $this->separator('-');
        
        // Items
        foreach ($sale->items as $item) {
            $variant = $item->productVariant;
            $product = $variant->product;
            $itemName = $this->buildItemName($product, $variant);
            
            $lines = array_merge($lines, $this->formatSalesItem(
                $itemName,
                (float)$item->quantity,
                (float)$item->unit_price,
                (float)$item->line_total
            ));
        }
        
        $lines[] = $this->separator('-');
        
        // Totals (plain text, no bold)
        $lines[] = $this->formatAmountLine("Subtotal", (float)$sale->subtotal);
        $discount = $paymentSummary['discount'] ?? 0;
        if ($discount > 0) {
            $lines[] = $this->formatAmountLine("Discount", -$discount);
        }
        $lines[] = $this->separator('-');
        $grossTotal = (float)($paymentSummary['gross_total'] ?? $sale->total);
        $totalRefunded = (float)($paymentSummary['total_refunded'] ?? 0);
        $netTotal = (float)($paymentSummary['net_total'] ?? $grossTotal);
        $lines[] = $this->formatAmountLine("TOTAL DUE", $grossTotal);
        if ($totalRefunded > 0) {
            $lines[] = $this->formatAmountLine("Total Refunded", -$totalRefunded);
            $lines[] = $this->formatAmountLine("NET TOTAL", $netTotal);
        }
        
        // Payment info
        $totalPaid = $paymentSummary['total_paid'] ?? 0;
        if ($totalPaid > 0) {
            $paymentMethod =
                ucfirst(
                    strtolower(
                        $sale->payments
                            ->first(fn ($payment) => (float) $payment->amount > 0)
                            ?->payment_method ?? 'Cash'
                    )
                );
            $lines[] = $this->formatAmountLine($paymentMethod, $totalPaid);
            $change = $paymentSummary['change'] ?? 0;
            if ($change > 0) {
                $lines[] = $this->formatAmountLine("Change", $change);
            }
            $balance = $paymentSummary['balance'] ?? 0;
            if ($balance > 0) {
                $lines[] = $this->formatAmountLine("Balance", $balance);
            }
        } else {
            $lines[] = "";
            $lines[] = $this->centerText("** UNPAID **");
        }
        
        // Delivery info
        if ($sale->is_for_delivery) {
            $lines[] = $this->separator('-');
            $deliveryLine = "DELIVER TO: " . ($sale->delivery_name ?? 'N/A');
            $lines[] = $deliveryLine;
            
            $addressParts = [];
            if ($sale->delivery_address) {
                $addressParts[] = $sale->delivery_address;
            }
            if ($sale->delivery_contact) {
                $addressParts[] = "Mobile No: " . $sale->delivery_contact;
            }
            if ($addressParts) {
                $addressLine = implode('  ', $addressParts);
                $wrapped = wordwrap($addressLine, $this->width, "\n", true);
                foreach (explode("\n", $wrapped) as $line) {
                    $lines[] = $line;
                }
            }
        }
        
        // Footer
        $lines[] = $this->separator('-');
        $lines[] = $this->centerText("Thank you for shopping!");
        $lines[] = $this->centerText("Please keep this receipt.");
        $lines[] = $this->separator('-');
        $lines[] = "";
        $lines[] = "Printed: " . $this->formatDateTime(now());
        $lines[] = $this->separator('=');
        
        // Just add some blank lines at the end (no cut command)
        $lines[] = "";
        $lines[] = "";
        
        return implode("\n", $lines);
    }

    // ========================================================================
    // DELIVERY RECEIPT
    // ========================================================================

    public function generateDeliveryReceipt(Delivery $delivery, array $deliverySummary = []): string
    {
        $lines = [];
        
        // Header - initialize printer and set minimal margins
        $init = "\x1B\x40" . "\x1B\x33\x00";
        $lines[] = $init . $this->centerTextBoldLarge('JOSHUA Construction');
        $lines[] = $this->centerTextBoldLarge('Supply & Trading');
        $lines[] = $this->centerText($this->storeAddress);
        $lines[] = $this->centerText("Mobile No: {$this->storeContact}");
        $lines[] = "";
        $lines[] = $this->separator('=');
        
        // Title with disclaimer
        $lines[] = $this->centerText("DELIVERY RECEIPT");
        $lines[] = $this->centerText("NOT AN OFFICIAL RECEIPT");
        $lines[] = $this->separator('-');
        
        // Info
        $lines[] = "Date: " . $this->formatDateTime($delivery->delivered_at ?? $delivery->created_at);
        if ($delivery->sale) {
            $lines[] = "SI Ref: " . ($delivery->sale->sale_number ?? 'N/A');
        }
        if ($delivery->deliveredBy) {
            $lines[] = "Driver: " . ($delivery->deliveredBy->name ?? 'N/A');
        }
        
        // Status
        $statusText = strtoupper($delivery->status ?? 'PENDING');
        $lines[] = "Status: " . $statusText;
        $lines[] = $this->separator('-');
        
        // Delivery Address - compact format
        if ($delivery->sale) {
            $deliveryLine = "DELIVER TO: " . ($delivery->sale->delivery_name ?? 'N/A');
            $lines[] = $deliveryLine;
            
            $addressParts = [];
            if ($delivery->sale->delivery_address) {
                $addressParts[] = $delivery->sale->delivery_address;
            }
            if ($delivery->sale->delivery_contact) {
                $addressParts[] = "Mobile No: " . $delivery->sale->delivery_contact;
            }
            if ($addressParts) {
                $addressLine = implode('  ', $addressParts);
                $wrapped = wordwrap($addressLine, $this->width, "\n", true);
                foreach (explode("\n", $wrapped) as $line) {
                    $lines[] = $line;
                }
            }
            $lines[] = $this->separator('-');
        }
        
        // Items - indented format
        $lines[] = "ITEMS:";
        foreach ($delivery->items as $item) {
            $variant = $item->productVariant;
            $product = $variant->product;
            $itemName = $this->buildItemName($product, $variant);
            $qty = number_format((float)$item->quantity, (float)$item->quantity == floor((float)$item->quantity) ? 0 : 1);
            $unit = $product->base_unit ?? 'pcs';
            $lines[] = "  {$itemName}  {$qty} {$unit}";
        }
        
        $lines[] = $this->separator('-');
        $lines[] = "Total: " . number_format($delivery->items->sum('quantity'), 0) . " items";
        
        // Remaining items for partial delivery
        if ($delivery->status === 'partial' && $delivery->sale) {
            $lines[] = $this->separator('=');
            $lines[] = $this->centerText("REMAINING ITEMS");
            $lines[] = $this->separator('-');
            
            $remainingItems = $this->calculateRemainingItems($delivery);
            
            if (count($remainingItems) > 0) {
                foreach ($remainingItems as $remaining) {
                    $qty = number_format($remaining['quantity'], 0);
                    $lines[] = "  {$remaining['name']}  {$qty} {$remaining['unit']}";
                }
            } else {
                $lines[] = "None";
            }
        }
        
        $lines[] = $this->separator('=');
        
        // Compact acknowledgment
        $lines[] = "Received by:";
        $lines[] = "Name: _________________ Sign: _________";
        $lines[] = "Date: _________________________________";
        
        // Footer
        $lines[] = $this->separator('-');
        $lines[] = "";
        $lines[] = "Printed: " . $this->formatDateTime(now());
        $lines[] = $this->separator('=');
        
        $lines[] = "\n\n\n";
        $lines[] = "\x1D\x56\x00";
        
        return implode("\n", $lines);
    }

    /**
     * Generate plain text delivery receipt (no ESC/POS commands)
     * For use with RawBT and text sharing on mobile devices
     */
    public function generateDeliveryReceiptPlain(Delivery $delivery, array $deliverySummary = []): string
    {
        $lines = [];
        
        // Header - plain text
        $lines[] = $this->centerText("JOSHUA Construction");
        $lines[] = $this->centerText("Supply & Trading");
        $lines[] = $this->centerText($this->storeAddress);
        $lines[] = $this->centerText("Mobile No: {$this->storeContact}");
        $lines[] = "";
        $lines[] = $this->separator('=');
        
        // Title with disclaimer
        $lines[] = $this->centerText("DELIVERY RECEIPT");
        $lines[] = $this->centerText("NOT AN OFFICIAL RECEIPT");
        $lines[] = $this->separator('-');
        
        // Info
        $lines[] = "Date: " . $this->formatDateTime($delivery->delivered_at ?? $delivery->created_at);
        if ($delivery->sale) {
            $lines[] = "SI Ref: " . ($delivery->sale->sale_number ?? 'N/A');
        }
        if ($delivery->deliveredBy) {
            $lines[] = "Driver: " . ($delivery->deliveredBy->name ?? 'N/A');
        }
        
        // Status
        $statusText = strtoupper($delivery->status ?? 'PENDING');
        $lines[] = "Status: " . $statusText;
        $lines[] = $this->separator('-');
        
        // Delivery Address - compact format
        if ($delivery->sale) {
            $deliveryLine = "DELIVER TO: " . ($delivery->sale->delivery_name ?? 'N/A');
            $lines[] = $deliveryLine;
            
            $addressParts = [];
            if ($delivery->sale->delivery_address) {
                $addressParts[] = $delivery->sale->delivery_address;
            }
            if ($delivery->sale->delivery_contact) {
                $addressParts[] = "Mobile No: " . $delivery->sale->delivery_contact;
            }
            if ($addressParts) {
                $addressLine = implode('  ', $addressParts);
                $wrapped = wordwrap($addressLine, $this->width, "\n", true);
                foreach (explode("\n", $wrapped) as $line) {
                    $lines[] = $line;
                }
            }
            $lines[] = $this->separator('-');
        }
        
        // Items - indented format
        $lines[] = "ITEMS:";
        foreach ($delivery->items as $item) {
            $variant = $item->productVariant;
            $product = $variant->product;
            $itemName = $this->buildItemName($product, $variant);
            $qty = number_format((float)$item->quantity, (float)$item->quantity == floor((float)$item->quantity) ? 0 : 1);
            $unit = $product->base_unit ?? 'pcs';
            $lines[] = "  {$itemName}  {$qty} {$unit}";
        }
        
        $lines[] = $this->separator('-');
        $lines[] = "Total: " . number_format($delivery->items->sum('quantity'), 0) . " items";
        
        // Remaining items for partial delivery
        if ($delivery->status === 'partial' && $delivery->sale) {
            $lines[] = $this->separator('=');
            $lines[] = $this->centerText("REMAINING ITEMS");
            $lines[] = $this->separator('-');
            
            $remainingItems = $this->calculateRemainingItems($delivery);
            
            if (count($remainingItems) > 0) {
                foreach ($remainingItems as $remaining) {
                    $qty = number_format($remaining['quantity'], 0);
                    $lines[] = "  {$remaining['name']}  {$qty} {$remaining['unit']}";
                }
            } else {
                $lines[] = "None";
            }
        }
        
        $lines[] = $this->separator('=');
        
        // Compact acknowledgment
        $lines[] = "Received by:";
        $lines[] = "Name: _________________ Sign: _________";
        $lines[] = "Date: _________________________________";
        
        // Footer
        $lines[] = $this->separator('-');
        $lines[] = "";
        $lines[] = "Printed: " . $this->formatDateTime(now());
        $lines[] = $this->separator('=');
        
        // Just blank lines at the end (no cut command)
        $lines[] = "";
        $lines[] = "";
        
        return implode("\n", $lines);
    }

    private function calculateRemainingItems(Delivery $delivery): array
    {
        $remainingItems = [];
        
        if (!$delivery->sale) {
            return $remainingItems;
        }
        
        $delivery->sale->load(['items.productVariant.product', 'deliveries.items']);
        
        $deliveredByVariant = [];
        foreach ($delivery->sale->deliveries as $del) {
            foreach ($del->items as $delItem) {
                $variantId = $delItem->product_variant_id;
                $deliveredByVariant[$variantId] = ($deliveredByVariant[$variantId] ?? 0) + (float)$delItem->quantity;
            }
        }
        
        foreach ($delivery->sale->items as $saleItem) {
            $variantId = $saleItem->product_variant_id;
            $variant = $saleItem->productVariant;
            $product = $variant->product;
            
            $soldQty = (float)$saleItem->quantity;
            $canceledQty = (float)($saleItem->canceled_quantity ?? 0);
            $requiredQty = $soldQty - $canceledQty;
            $deliveredQty = $deliveredByVariant[$variantId] ?? 0;
            $remainingQty = $requiredQty - $deliveredQty;
            
            if ($remainingQty > 0) {
                $remainingItems[] = [
                    'name' => $this->buildItemName($product, $variant),
                    'quantity' => $remainingQty,
                    'unit' => $product->base_unit ?? 'pcs',
                ];
            }
        }
        
        return $remainingItems;
    }

    // ========================================================================
    // WEIGH-IN RECEIPT (AGRICULTURAL PRODUCTS)
    // ========================================================================

    public function generateWeighInReceipt(WeighInTransaction $transaction): string
    {
        $lines = [];
        
        // Header - initialize printer and set minimal margins
        $init = "\x1B\x40" . "\x1B\x33\x00";
        $lines[] = $init . $this->centerTextBoldLarge('JOSHUA Construction');
        $lines[] = $this->centerTextBoldLarge('Supply & Trading');
        $lines[] = $this->centerText($this->storeAddress);
        $lines[] = $this->centerText("Mobile No: {$this->storeContact}");
        $lines[] = "";
        $lines[] = $this->separator('=');
        
        // Title with disclaimer
        $lines[] = $this->centerText("WEIGH-IN SLIP");
        $lines[] = $this->centerText("NOT AN OFFICIAL RECEIPT");
        $lines[] = $this->separator('-');
        
        // Info
        $lines[] = "Ref No: " . $transaction->ref_num;
        $lines[] = "Date: " . $this->formatDateTime($transaction->weighed_at ?? $transaction->created_at);
        if ($transaction->weighedBy) {
            $lines[] = "Weighed by: " . ($transaction->weighedBy->name ?? 'N/A');
        }
        $lines[] = $this->separator('-');
        
        // Group items by type - Hybrid format (Option 3)
        $itemsByType = $transaction->weighIns->groupBy('type');
        
        foreach ($itemsByType as $type => $items) {
            $typeName = $this->formatWeighInType($type);
            $unitPrice = (float)$items->first()->unit_price;
            $isCoconut = $type === 'coconut';
            $unit = $isCoconut ? 'pcs' : 'kg';
            
            // Type header with price
            $priceLabel = $isCoconut ? "/pc" : "/kg";
            $lines[] = "{$typeName} @ P" . number_format($unitPrice, 2) . $priceLabel;
            
            // Individual weights/counts on one line
            $quantities = [];
            foreach ($items as $item) {
                if ($isCoconut) {
                    $quantities[] = (int)$item->count;
                } else {
                    $quantities[] = number_format((float)$item->weight_kg, 2);
                }
            }
            
            // Calculate totals
            if ($isCoconut) {
                $totalQty = $items->sum('count');
            } else {
                $totalQty = $items->sum('weight_kg');
            }
            
            // If only one item, just show the count/weight without the "= total" part
            if (count($items) === 1) {
                if ($isCoconut) {
                    $qtyLine = "  {$totalQty} {$unit}";
                } else {
                    $qtyLine = "  " . number_format($totalQty, 2) . " {$unit}";
                }
                $lines[] = $qtyLine;
            } else {
                // Multiple items: show "item1 + item2 + ... = total"
                if ($isCoconut) {
                    $qtyLine = "  " . implode(' + ', $quantities) . " = {$totalQty} {$unit}";
                } else {
                    $qtyLine = "  " . implode(' + ', $quantities) . " = " . number_format($totalQty, 2) . " {$unit}";
                }
                
                // Wrap if too long
                if (strlen($qtyLine) > $this->width) {
                    $lines[] = "  " . implode(' + ', $quantities);
                    if ($isCoconut) {
                        $lines[] = "  = {$totalQty} {$unit}";
                    } else {
                        $lines[] = "  = " . number_format($totalQty, 2) . " {$unit}";
                    }
                } else {
                    $lines[] = $qtyLine;
                }
            }
            
            // Subtotal for this type
            $typeTotal = $items->sum('total_amount');
            $lines[] = $this->formatAmountLine("  Subtotal", (float)$typeTotal);
            $lines[] = $this->separator('-');
        }
        
        // Grand Total
        $lines[] = $this->formatAmountLineBold("TOTAL AMOUNT", (float)($transaction->total_amount ?? 0));
        $lines[] = $this->separator('=');
        
        // Payment status
        if ($transaction->status === 'paid') {
            $lines[] = $this->centerText("*** PAID ***");
        } else {
            $lines[] = $this->centerText("** UNPAID **");
            $lines[] = $this->centerText("Present this to cashier");
        }
        
        // Notes
        if ($transaction->notes) {
            $lines[] = $this->separator('-');
            $lines[] = "Notes: " . $transaction->notes;
        }
        
        // Footer
        $lines[] = $this->separator('-');
        $lines[] = $this->centerText("Thank you!");
        $lines[] = "";
        $lines[] = "Printed: " . $this->formatDateTime(now());
        $lines[] = $this->separator('=');
        
        $lines[] = "\n\n\n";
        $lines[] = "\x1D\x56\x00";
        
        return implode("\n", $lines);
    }

    private function formatWeighInType(string $type): string
    {
        return match ($type) {
            'cooked_copra' => 'Cooked Copra',
            'uncooked_copra' => 'Uncooked Copra',
            'coconut' => 'Coconut',
            'bagol' => 'Bagol',
            default => ucfirst(str_replace('_', ' ', $type)),
        };
    }

    /**
     * Generate plain text weigh-in receipt (no ESC/POS commands)
     * For use with RawBT and text sharing on mobile devices
     */
    public function generateWeighInReceiptPlain(WeighInTransaction $transaction): string
    {
        $lines = [];
        
        // Header - plain text
        $lines[] = $this->centerText("JOSHUA Construction");
        $lines[] = $this->centerText("Supply & Trading");
        $lines[] = $this->centerText($this->storeAddress);
        $lines[] = $this->centerText("Mobile No: {$this->storeContact}");
        $lines[] = "";
        $lines[] = $this->separator('=');
        
        // Title with disclaimer
        $lines[] = $this->centerText("WEIGH-IN SLIP");
        $lines[] = $this->centerText("NOT AN OFFICIAL RECEIPT");
        $lines[] = $this->separator('-');
        
        // Info
        $lines[] = "Ref No: " . $transaction->ref_num;
        $lines[] = "Date: " . $this->formatDateTime($transaction->weighed_at ?? $transaction->created_at);
        if ($transaction->weighedBy) {
            $lines[] = "Weighed by: " . ($transaction->weighedBy->name ?? 'N/A');
        }
        $lines[] = $this->separator('-');
        
        // Group items by type
        $itemsByType = $transaction->weighIns->groupBy('type');
        
        foreach ($itemsByType as $type => $items) {
            $typeName = $this->formatWeighInType($type);
            $unitPrice = (float)$items->first()->unit_price;
            $isCoconut = $type === 'coconut';
            $unit = $isCoconut ? 'pcs' : 'kg';
            
            // Type header with price
            $priceLabel = $isCoconut ? "/pc" : "/kg";
            $lines[] = "{$typeName} @ P" . number_format($unitPrice, 2) . $priceLabel;
            
            // Individual weights/counts
            $quantities = [];
            foreach ($items as $item) {
                if ($isCoconut) {
                    $quantities[] = (int)$item->count;
                } else {
                    $quantities[] = number_format((float)$item->weight_kg, 2);
                }
            }
            
            // Calculate totals
            if ($isCoconut) {
                $totalQty = $items->sum('count');
            } else {
                $totalQty = $items->sum('weight_kg');
            }
            
            // Show quantities
            if (count($items) === 1) {
                if ($isCoconut) {
                    $qtyLine = "  {$totalQty} {$unit}";
                } else {
                    $qtyLine = "  " . number_format($totalQty, 2) . " {$unit}";
                }
                $lines[] = $qtyLine;
            } else {
                if ($isCoconut) {
                    $qtyLine = "  " . implode(' + ', $quantities) . " = {$totalQty} {$unit}";
                } else {
                    $qtyLine = "  " . implode(' + ', $quantities) . " = " . number_format($totalQty, 2) . " {$unit}";
                }
                
                if (strlen($qtyLine) > $this->width) {
                    $lines[] = "  " . implode(' + ', $quantities);
                    if ($isCoconut) {
                        $lines[] = "  = {$totalQty} {$unit}";
                    } else {
                        $lines[] = "  = " . number_format($totalQty, 2) . " {$unit}";
                    }
                } else {
                    $lines[] = $qtyLine;
                }
            }
            
            // Subtotal for this type
            $typeTotal = $items->sum('total_amount');
            $lines[] = $this->formatAmountLine("  Subtotal", (float)$typeTotal);
            $lines[] = $this->separator('-');
        }
        
        // Grand Total (plain text, no bold)
        $lines[] = $this->formatAmountLine("TOTAL AMOUNT", (float)($transaction->total_amount ?? 0));
        $lines[] = $this->separator('=');
        
        // Payment status
        if ($transaction->status === 'paid') {
            $lines[] = $this->centerText("*** PAID ***");
        } else {
            $lines[] = $this->centerText("** UNPAID **");
            $lines[] = $this->centerText("Present this to cashier");
        }
        
        // Notes
        if ($transaction->notes) {
            $lines[] = $this->separator('-');
            $lines[] = "Notes: " . $transaction->notes;
        }
        
        // Footer
        $lines[] = $this->separator('-');
        $lines[] = $this->centerText("Thank you!");
        $lines[] = "";
        $lines[] = "Printed: " . $this->formatDateTime(now());
        $lines[] = $this->separator('=');
        
        // Just blank lines at the end (no cut command)
        $lines[] = "";
        $lines[] = "";
        
        return implode("\n", $lines);
    }

    // ========================================================================
    // FORMATTING HELPERS
    // ========================================================================

    private function buildItemName($product, $variant): string
    {
        $name = $product->name;
        $parts = [];
        
        // Include all variant attributes if they exist (removed regex restriction on size)
        if ($variant->size) {
            $parts[] = $variant->size;
        }
        if ($variant->thickness) {
            $parts[] = $variant->thickness;
        }
        if ($variant->diameter) {
            $parts[] = $variant->diameter;
        }
        
        // If we have physical attributes, show them
        if ($parts) {
            $name .= ' (' . implode('x', $parts) . ')';
        } elseif ($variant->description) {
            // If no physical attributes but description exists, use description
            $name .= ' (' . $variant->description . ')';
        }
        
        return $name;
    }

    private function formatAmountLine(string $label, float $amount): string
    {
        $amountStr = "P" . number_format($amount, 2);
        $spaces = max(1, $this->width - strlen($label) - strlen($amountStr));
        return $label . str_repeat(' ', $spaces) . $amountStr;
    }

    private function formatAmountLineBold(string $label, float $amount): string
    {
        // ESC/POS commands for bold
        $boldOn = "\x1B\x45\x01";  // 1B 45 01 → Bold ON
        $boldOff = "\x1B\x45\x00"; // 1B 45 00 → Bold OFF
        
        $amountStr = "P" . number_format($amount, 2);
        $spaces = max(1, $this->width - strlen($label) - strlen($amountStr));
        return $boldOn . $label . str_repeat(' ', $spaces) . $amountStr . $boldOff;
    }

    private function formatSalesItemHeader(): string
    {
        if ($this->width >= 48) {
            return str_pad("DESCRIPTION", 20) . 
                   str_pad("QTY", 6, ' ', STR_PAD_LEFT) . 
                   str_pad("PRICE", 10, ' ', STR_PAD_LEFT) . 
                   str_pad("AMOUNT", 12, ' ', STR_PAD_LEFT);
        }
        return str_pad("DESC", 12) . 
               str_pad("QTY", 4, ' ', STR_PAD_LEFT) . 
               str_pad("PRC", 8, ' ', STR_PAD_LEFT) . 
               str_pad("AMT", 8, ' ', STR_PAD_LEFT);
    }

    private function formatSalesItem(string $name, float $qty, float $price, float $total): array
    {
        $lines = [];
        
        if ($this->width >= 48) {
            $maxLen = 20;
            $qtyStr = number_format($qty, $qty == floor($qty) ? 0 : 1);
            $priceStr = number_format($price, 2);
            $totalStr = number_format($total, 2);
            
            if (strlen($name) > $maxLen) {
                $lines[] = $name;
                $lines[] = str_pad("", 20) . 
                          str_pad($qtyStr, 6, ' ', STR_PAD_LEFT) . 
                          str_pad($priceStr, 10, ' ', STR_PAD_LEFT) . 
                          str_pad($totalStr, 12, ' ', STR_PAD_LEFT);
            } else {
                $lines[] = str_pad($name, 20) . 
                          str_pad($qtyStr, 6, ' ', STR_PAD_LEFT) . 
                          str_pad($priceStr, 10, ' ', STR_PAD_LEFT) . 
                          str_pad($totalStr, 12, ' ', STR_PAD_LEFT);
            }
        } else {
            $maxLen = 12;
            $qtyStr = number_format($qty, 0);
            $priceStr = number_format($price, 0);
            $totalStr = number_format($total, 2);
            
            if (strlen($name) > $maxLen) {
                $lines[] = $name;
                $lines[] = str_pad("", 12) . 
                          str_pad($qtyStr, 4, ' ', STR_PAD_LEFT) . 
                          str_pad($priceStr, 8, ' ', STR_PAD_LEFT) . 
                          str_pad($totalStr, 8, ' ', STR_PAD_LEFT);
            } else {
                $lines[] = str_pad($name, 12) . 
                          str_pad($qtyStr, 4, ' ', STR_PAD_LEFT) . 
                          str_pad($priceStr, 8, ' ', STR_PAD_LEFT) . 
                          str_pad($totalStr, 8, ' ', STR_PAD_LEFT);
            }
        }
        
        return $lines;
    }

    private function formatWeighInItemHeader(): string
    {
        if ($this->width >= 48) {
            return str_pad("TYPE", 16) . 
                   str_pad("QTY", 10, ' ', STR_PAD_LEFT) . 
                   str_pad("PRICE", 10, ' ', STR_PAD_LEFT) . 
                   str_pad("AMOUNT", 12, ' ', STR_PAD_LEFT);
        }
        return str_pad("TYPE", 10) . 
               str_pad("QTY", 7, ' ', STR_PAD_LEFT) . 
               str_pad("PRC", 7, ' ', STR_PAD_LEFT) . 
               str_pad("AMT", 8, ' ', STR_PAD_LEFT);
    }

    private function formatWeighInItem(string $type, float $qty, string $unit, float $price, float $total): array
    {
        $lines = [];
        
        $qtyStr = number_format($qty, $unit === 'pcs' ? 0 : 2) . $unit;
        $priceStr = number_format($price, 2);
        $totalStr = number_format($total, 2);
        
        if ($this->width >= 48) {
            $maxLen = 16;
            if (strlen($type) > $maxLen) {
                $type = substr($type, 0, $maxLen - 1) . '.';
            }
            
            $lines[] = str_pad($type, 16) . 
                      str_pad($qtyStr, 10, ' ', STR_PAD_LEFT) . 
                      str_pad($priceStr, 10, ' ', STR_PAD_LEFT) . 
                      str_pad($totalStr, 12, ' ', STR_PAD_LEFT);
        } else {
            $maxLen = 10;
            $qtyStr = number_format($qty, 0);
            $priceStr = number_format($price, 0);
            $totalStr = number_format($total, 0);
            
            if (strlen($type) > $maxLen) {
                $type = substr($type, 0, $maxLen - 1) . '.';
            }
            
            $lines[] = str_pad($type, 10) . 
                      str_pad($qtyStr, 7, ' ', STR_PAD_LEFT) . 
                      str_pad($priceStr, 7, ' ', STR_PAD_LEFT) . 
                      str_pad($totalStr, 8, ' ', STR_PAD_LEFT);
        }
        
        return $lines;
    }

    private function centerText(string $text): string
    {
        if (strlen($text) >= $this->width) {
            return substr($text, 0, $this->width);
        }
        $padding = (int)(($this->width - strlen($text)) / 2);
        return str_repeat(' ', $padding) . $text;
    }

    private function centerTextBoldLarge(string $text): string
    {
        // ESC/POS commands
        $boldOn = "\x1B\x45\x01";      // 1B 45 01 → Bold ON
        $boldOff = "\x1B\x45\x00";     // 1B 45 00 → Bold OFF
        $doubleStrikeOn = "\x1B\x47\x01";  // ESC G 1 → Double-Strike ON
        $doubleStrikeOff = "\x1B\x47\x00"; // ESC G 0 → Double-Strike OFF
        $sizeLarge = "\x1D\x21\x11";   // Double width and height (to make text bigger)
        $sizeNormal = "\x1D\x21\x00";  // Normal size
        
        // Truncate if text would exceed width when double-size
        $maxTextLength = (int)($this->width / 2);
        if (strlen($text) > $maxTextLength) {
            $text = substr($text, 0, $maxTextLength);
        }
        
        // Calculate padding: double-size text takes 2 columns per character
        // So text width = strlen($text) * 2, padding = (total_width - text_width) / 2
        $textWidth = strlen($text) * 2;
        $padding = (int)(($this->width - $textWidth) / 2);
        
        // Ensure padding is not negative
        if ($padding < 0) {
            $padding = 0;
        }
        
        // Build the line: padding (normal) + control codes + text (double-size) + reset codes
        return str_repeat(' ', $padding) 
            . $boldOn . $doubleStrikeOn . $sizeLarge 
            . $text 
            . $sizeNormal . $doubleStrikeOff . $boldOff;
    }

    private function separator(string $char = '-'): string
    {
        return str_repeat($char, $this->width);
    }

    private function formatDateTime(string|\DateTime|\Illuminate\Support\Carbon $dateTime): string
    {
        if ($dateTime instanceof \Illuminate\Support\Carbon) {
            $date = $dateTime->copy();
        } elseif ($dateTime instanceof \DateTime) {
            $date = \Illuminate\Support\Carbon::instance($dateTime);
        } else {
            $date = \Illuminate\Support\Carbon::parse($dateTime);
        }
        
        // Laravel stores timestamps in UTC, convert to Philippine timezone for display
        // This matches the frontend JavaScript toLocaleString() behavior
        $date = $date->setTimezone('Asia/Manila');
        
        // Format: m/d/Y, g:i:s A (e.g., "12/31/2025, 2:19:50 PM")
        return $date->format('m/d/Y, g:i:s A');
    }
}
