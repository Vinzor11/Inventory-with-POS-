/**
 * Receipt Printing Utility
 * 
 * Handles printing receipts using ESC/POS commands or raw text
 * Supports multiple print methods:
 * - Local print service (Electron/Node)
 * - Browser extension
 * - Direct printer communication
 */

export interface PrintOptions {
    width?: 58 | 80; // Printer width in mm
    printerName?: string; // Optional printer name
    showPreview?: boolean; // Show preview before printing (default: true)
    printServerUrl?: string; // Custom print server URL (for network printing)
}

// Print method types
export type PrintMethod = 'browser' | 'network' | 'bluetooth' | 'usb';

// Storage keys
const PRINT_METHOD_KEY = 'hims_print_method';
const NETWORK_PRINTER_IP_KEY = 'hims_network_printer_ip';

/**
 * Get the configured print method
 */
export function getPrintMethod(): PrintMethod {
    if (typeof window === 'undefined') return 'browser';
    return (localStorage.getItem(PRINT_METHOD_KEY) as PrintMethod) || 'browser';
}

/**
 * Set the print method
 */
export function setPrintMethod(method: PrintMethod): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PRINT_METHOD_KEY, method);
}

/**
 * Get the configured network printer IP
 */
export function getNetworkPrinterIP(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(NETWORK_PRINTER_IP_KEY);
}

/**
 * Set the network printer IP address
 * @param ip - The printer's IP address (e.g., "192.168.1.100")
 */
export function setNetworkPrinterIP(ip: string | null): void {
    if (typeof window === 'undefined') return;
    if (ip) {
        localStorage.setItem(NETWORK_PRINTER_IP_KEY, ip);
    } else {
        localStorage.removeItem(NETWORK_PRINTER_IP_KEY);
    }
}

/**
 * Get print settings summary
 */
export function getPrintSettings(): { method: PrintMethod; networkIP: string | null } {
    return {
        method: getPrintMethod(),
        networkIP: getNetworkPrinterIP(),
    };
}

/**
 * Fetch receipt text (plain text format from backend)
 */
export async function fetchReceiptText(
    url: string
): Promise<string> {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'text/plain',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch receipt: ${response.statusText}`);
        }

        // Plain text format - no cleaning needed
        const text = await response.text();
        return text;
    } catch (error) {
        console.error('Error fetching receipt text:', error);
        throw error;
    }
}

/**
 * Fetch sales receipt text for preview
 * @param saleId - The sale ID
 * @param width - Printer width (58 or 80mm)
 * Note: Returns ESC/POS format by default (same as delivery receipt) for RawBT bold support
 */
export async function fetchSalesReceiptText(
    saleId: number,
    width: 58 | 80 = 80
): Promise<string> {
    const url = `/receipts/sales/${saleId}?width=${width}`;
    return fetchReceiptText(url);
}

/**
 * Print sales receipt
 */
export async function printSalesReceipt(
    saleId: number,
    options: PrintOptions = {}
): Promise<void> {
    const width = options.width || 80;
    const url = `/receipts/sales/${saleId}?width=${width}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'text/plain, application/octet-stream',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch receipt: ${response.statusText}`);
        }

        // Fetch as ArrayBuffer to preserve ESC/POS binary commands
        const receiptBuffer = await response.arrayBuffer();
        await sendToPrinter(receiptBuffer, options);
    } catch (error) {
        console.error('Print error:', error);
        throw error;
    }
}

/**
 * Fetch delivery receipt text for preview
 */
export async function fetchDeliveryReceiptText(
    deliveryId: number,
    width: 58 | 80 = 80
): Promise<string> {
    const url = `/receipts/deliveries/${deliveryId}?width=${width}`;
    return fetchReceiptText(url);
}

/**
 * Print delivery receipt
 */
export async function printDeliveryReceipt(
    deliveryId: number,
    options: PrintOptions = {}
): Promise<void> {
    const width = options.width || 80;
    const url = `/receipts/deliveries/${deliveryId}?width=${width}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'text/plain, application/octet-stream',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch receipt: ${response.statusText}`);
        }

        // Fetch as ArrayBuffer to preserve ESC/POS binary commands
        const receiptBuffer = await response.arrayBuffer();
        await sendToPrinter(receiptBuffer, options);
    } catch (error) {
        console.error('Print error:', error);
        throw error;
    }
}

/**
 * Fetch weigh-in receipt text for preview
 * @param transactionId - The transaction ID
 * @param width - Printer width (58 or 80mm)
 * @param plain - If true, returns plain text without ESC/POS commands (for sharing/RawBT)
 */
export async function fetchWeighInReceiptText(
    transactionId: number,
    width: 58 | 80 = 80,
    plain: boolean = true
): Promise<string> {
    const format = plain ? 'plain' : 'escpos';
    const url = `/receipts/weigh-ins/${transactionId}?width=${width}&format=${format}`;
    return fetchReceiptText(url);
}

/**
 * Print weigh-in receipt
 */
export async function printWeighInReceipt(
    transactionId: number,
    options: PrintOptions = {}
): Promise<void> {
    const width = options.width || 80;
    const url = `/receipts/weigh-ins/${transactionId}?width=${width}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'text/plain, application/octet-stream',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch receipt: ${response.statusText}`);
        }

        // Fetch as ArrayBuffer to preserve ESC/POS binary commands
        const receiptBuffer = await response.arrayBuffer();
        await sendToPrinter(receiptBuffer, options);
    } catch (error) {
        console.error('Print error:', error);
        throw error;
    }
}

/**
 * Send receipt data to printer
 * 
 * Uses the configured print method:
 * - 'browser': Opens browser print dialog (works with any printer the tablet can see)
 * - 'network': Sends directly to network printer via backend proxy (for LAN printers)
 * - 'bluetooth': Uses Web Bluetooth API (for Bluetooth printers)
 * - 'usb': Uses Web Serial API (for USB printers with OTG)
 */
async function sendToPrinter(
    receiptData: ArrayBuffer | string,
    options: PrintOptions = {}
): Promise<void> {
    const method = getPrintMethod();
    
    // Convert ArrayBuffer to string for methods that need it
    const receiptText = typeof receiptData === 'string' 
        ? receiptData 
        : new TextDecoder('latin1').decode(new Uint8Array(receiptData));
    
    // Convert to Uint8Array for binary methods
    const receiptBytes = receiptData instanceof ArrayBuffer 
        ? new Uint8Array(receiptData)
        : new TextEncoder().encode(receiptData);

    switch (method) {
        case 'network':
            const printerIP = getNetworkPrinterIP();
            if (!printerIP) {
                throw new Error('Network printer IP not configured. Please go to Settings > Printer to configure.');
            }
            await printViaNetworkPrinter(receiptBytes, printerIP);
            return;

        case 'usb':
            if (navigator.serial) {
                await printViaSerial(receiptText, options);
                return;
            }
            throw new Error('USB printing not supported on this device');

        case 'browser':
        default:
            // Use browser print dialog
            printViaBrowser(receiptText);
            return;
    }
}

/**
 * Print via network printer (sends to backend which proxies to printer)
 * Most thermal printers accept raw ESC/POS data on port 9100
 */
async function printViaNetworkPrinter(
    receiptData: Uint8Array,
    printerIP: string
): Promise<void> {
    // Send to backend endpoint that will proxy to the printer
    const response = await fetch('/api/print/network', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
            printer_ip: printerIP,
            printer_port: 9100,
            data: Array.from(receiptData), // Send as array of bytes
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `Print failed: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || 'Print failed');
    }
}

/**
 * Print via local HTTP print service
 * This connects to a Node.js service running on localhost:3002 or a configured network address
 */
async function printViaHttpService(
    receiptData: ArrayBuffer | string,
    options: PrintOptions
): Promise<void> {
    // Use custom URL from options, or saved URL, or default to localhost
    const baseUrl = options.printServerUrl || getPrintServerUrl() || 'http://localhost:3002';
    const printServiceUrl = `${baseUrl}/print`;
    const printerName = options.printerName;
    
    const url = printerName 
        ? `${printServiceUrl}?printer=${encodeURIComponent(printerName)}`
        : printServiceUrl;
    
    // Send as binary data to preserve ESC/POS commands
    const body = receiptData instanceof ArrayBuffer 
        ? new Uint8Array(receiptData) 
        : receiptData;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
        },
        body: body,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `Print service returned ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Print service returned error');
    }
}

/**
 * Print via Web Serial API (for USB thermal printers)
 */
async function printViaSerial(
    receiptText: string,
    options: PrintOptions
): Promise<void> {
    if (!navigator.serial) {
        throw new Error('Web Serial API not supported');
    }

    // Request port access
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    const writer = port.writable?.getWriter();
    if (!writer) {
        throw new Error('Failed to get writer');
    }

    try {
        // Convert text to Uint8Array
        const encoder = new TextEncoder();
        const data = encoder.encode(receiptText);
        
        await writer.write(data);
        await writer.releaseLock();
    } finally {
        await port.close();
    }
}

/**
 * Download receipt as text file (fallback)
 */
function downloadReceipt(receiptText: string): void {
    const blob = new Blob([receiptText], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Clean receipt text by removing all ESC/POS commands
 * Returns plain text suitable for sharing or display
 */
export function cleanReceiptText(receiptText: string): string {
    // First pass: Remove all ESC/POS command sequences
    // ESC commands start with \x1B (27) followed by command byte and optional parameters
    // GS commands start with \x1D (29) followed by command byte and optional parameters
    
    let cleaned = receiptText
        // Remove ESC @ (initialize printer) - \x1B\x40
        .replace(/\x1B@/g, '')
        .replace(/\x1B\x40/g, '')
        
        // Remove ESC 3 n (line spacing) - \x1B\x33 + 1 byte
        .replace(/\x1B3./g, '')
        .replace(/\x1B\x33./g, '')
        
        // Remove ESC a n (alignment) - \x1B\x61 + 1 byte  
        .replace(/\x1Ba./g, '')
        .replace(/\x1B\x61./g, '')
        
        // Remove ESC E n (bold) - \x1B\x45 + 1 byte
        .replace(/\x1BE./g, '')
        .replace(/\x1B\x45./g, '')
        
        // Remove ESC G n (double-strike) - \x1B\x47 + 1 byte
        .replace(/\x1BG./g, '')
        .replace(/\x1B\x47./g, '')
        
        // Remove GS ! n (character size) - \x1D\x21 + 1 byte
        .replace(/\x1D!./g, '')
        .replace(/\x1D\x21./g, '')
        
        // Remove GS V n (cut paper) - \x1D\x56 + 1 byte
        .replace(/\x1DV./g, '')
        .replace(/\x1D\x56./g, '')
        
        // Remove any remaining ESC sequences (ESC + any printable char + optional param)
        .replace(/\x1B[\x20-\x7E][\x00-\xFF]?/g, '')
        
        // Remove any remaining GS sequences (GS + any printable char + optional param)
        .replace(/\x1D[\x20-\x7E][\x00-\xFF]?/g, '')
        
        // Remove ANSI escape sequences
        .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
        
        // Remove any remaining control characters (except newline \x0A and carriage return \x0D)
        .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
        
        // Remove carriage returns
        .replace(/\r/g, '');
    
    // Second pass: Clean up the text
    return cleaned
        // Trim trailing whitespace from each line
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        // Remove excessive blank lines at the end (keep max 2)
        .replace(/\n{4,}$/g, '\n\n')
        // Remove leading blank lines
        .replace(/^\n+/, '')
        // Remove any stray single characters at start (remnants of commands)
        .replace(/^[a-zA-Z]{1,2}\s*\n/, '');
}

/**
 * Share receipt text via Android share menu (for RawBT)
 * This is the best method for Android tablets with thermal printers
 * Note: The text should already be clean (from backend with format=plain)
 */
export async function shareReceipt(receiptText: string): Promise<boolean> {
    // Check if Web Share API is available (Android Chrome supports this)
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Receipt',
                text: receiptText,
            });
            return true;
        } catch (error) {
            // User cancelled or share failed
            console.warn('Share failed:', error);
            return false;
        }
    }
    
    return false;
}

/**
 * Fetch raw ESC/POS receipt data (with commands for bold, etc.)
 */
export async function fetchReceiptRaw(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/octet-stream',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch receipt: ${response.statusText}`);
    }

    return response.arrayBuffer();
}

/**
 * Share receipt as a file (for RawBT with ESC/POS commands)
 * This preserves bold, large text, and other formatting
 * 
 * IMPORTANT: Uses .prn extension so RawBT recognizes it as raw printer data
 * and interprets ESC/POS commands (bold, size, etc.)
 */
export async function shareReceiptAsFile(
    saleId: number,
    width: 58 | 80 = 80
): Promise<boolean> {
    // Fetch raw ESC/POS data (with bold commands)
    const url = `/receipts/sales/${saleId}?width=${width}&format=escpos`;
    
    try {
        const rawData = await fetchReceiptRaw(url);
        
        // Create a file from the raw data with .prn extension
        // RawBT automatically treats .prn files as raw printer data with ESC/POS commands
        const blob = new Blob([rawData], { type: 'application/octet-stream' });
        const file = new File([blob], `receipt-${saleId}.prn`, { type: 'application/octet-stream' });
        
        // Check if we can share files
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'Receipt',
                files: [file],
            });
            return true;
        }
        
        // Fallback: try sharing as text
        const textDecoder = new TextDecoder('latin1');
        const text = textDecoder.decode(rawData);
        
        if (navigator.share) {
            await navigator.share({
                title: 'Receipt',
                text: text,
            });
            return true;
        }
        
        return false;
    } catch (error) {
        console.warn('Share as file failed:', error);
        return false;
    }
}

/**
 * Share weigh-in receipt as a file (for RawBT with ESC/POS commands)
 * Uses .prn extension so RawBT interprets ESC/POS commands
 */
export async function shareWeighInReceiptAsFile(
    transactionId: number,
    width: 58 | 80 = 80
): Promise<boolean> {
    const url = `/receipts/weigh-ins/${transactionId}?width=${width}&format=escpos`;
    
    try {
        const rawData = await fetchReceiptRaw(url);
        
        // Use .prn extension for RawBT to recognize as raw printer data
        const blob = new Blob([rawData], { type: 'application/octet-stream' });
        const file = new File([blob], `weighin-${transactionId}.prn`, { type: 'application/octet-stream' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'Weigh-In Receipt',
                files: [file],
            });
            return true;
        }
        
        // Fallback to text
        const textDecoder = new TextDecoder('latin1');
        const text = textDecoder.decode(rawData);
        
        if (navigator.share) {
            await navigator.share({
                title: 'Weigh-In Receipt',
                text: text,
            });
            return true;
        }
        
        return false;
    } catch (error) {
        console.warn('Share weigh-in as file failed:', error);
        return false;
    }
}

/**
 * Share delivery receipt as a file (for RawBT with ESC/POS commands)
 * Uses .prn extension so RawBT interprets ESC/POS commands
 */
export async function shareDeliveryReceiptAsFile(
    deliveryId: number,
    width: 58 | 80 = 80
): Promise<boolean> {
    const url = `/receipts/deliveries/${deliveryId}?width=${width}&format=escpos`;
    
    try {
        const rawData = await fetchReceiptRaw(url);
        
        // Use .prn extension for RawBT to recognize as raw printer data
        const blob = new Blob([rawData], { type: 'application/octet-stream' });
        const file = new File([blob], `delivery-${deliveryId}.prn`, { type: 'application/octet-stream' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'Delivery Receipt',
                files: [file],
            });
            return true;
        }
        
        // Fallback to text
        const textDecoder = new TextDecoder('latin1');
        const text = textDecoder.decode(rawData);
        
        if (navigator.share) {
            await navigator.share({
                title: 'Delivery Receipt',
                text: text,
            });
            return true;
        }
        
        return false;
    } catch (error) {
        console.warn('Share delivery as file failed:', error);
        return false;
    }
}

/**
 * Auto-print receipt by sharing to RawBT (for Android)
 * Falls back to browser print if share is not available
 */
export async function autoPrintReceipt(receiptText: string): Promise<void> {
    // Try sharing first (for RawBT on Android)
    if (canShare()) {
        const shared = await shareReceipt(receiptText);
        if (shared) {
            return;
        }
    }
    
    // Fall back to browser print
    printViaBrowser(receiptText);
}

/**
 * Check if sharing is supported (for Android)
 */
export function canShare(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.share;
}

/**
 * Print using browser's built-in print dialog
 * This is the best fallback for tablets and mobile devices
 */
export function printViaBrowser(receiptText: string): void {
    // Clean the receipt text (remove ESC/POS commands)
    const cleanedText = receiptText
        .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
        .replace(/\x1B\x40/g, '')
        .replace(/\x1B\x33[\x00-\xFF]/g, '')
        .replace(/\x1D\x56\x00/g, '')
        .replace(/\x1B\x61/g, '')
        .replace(/\x1B\x45\x01/g, '')
        .replace(/\x1B\x45\x00/g, '')
        .replace(/\x1B\x47\x01/g, '')
        .replace(/\x1B\x47\x00/g, '')
        .replace(/\x1D\x21\x11/g, '')
        .replace(/\x1D\x21\x00/g, '')
        .replace(/[\x00-\x08\x0B-\x1C\x1E-\x1F\x7F]/g, '')
        .replace(/^\n+/, '');

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
        alert('Please allow pop-ups to print receipts');
        return;
    }

    // Write the receipt content with monospace font styling
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt</title>
            <style>
                @page {
                    size: 80mm auto;
                    margin: 0;
                }
                body {
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 12px;
                    line-height: 1.2;
                    white-space: pre;
                    margin: 0;
                    padding: 10px;
                    width: 80mm;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                }
            </style>
        </head>
        <body>${cleanedText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
        </html>
    `);
    printWindow.document.close();

    // Wait for content to load, then print
    printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        // Close after a delay to allow print dialog to open
        setTimeout(() => {
            printWindow.close();
        }, 1000);
    };

    // Fallback if onload doesn't fire
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 500);
}

// Type declarations for window extensions
declare global {
    interface Window {
        electron?: {
            print: (text: string, options?: PrintOptions) => Promise<void>;
        };
        printExtension?: {
            print: (text: string, options?: PrintOptions) => Promise<void>;
        };
    }
}

