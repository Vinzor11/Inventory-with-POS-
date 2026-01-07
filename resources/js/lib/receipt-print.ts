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
 * Fetch receipt text for preview
 */
export async function fetchReceiptText(
    url: string
): Promise<string> {
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

        // Get as text for preview (remove ESC/POS commands for display)
        const buffer = await response.arrayBuffer();
        const text = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
        
        // Remove ESC/POS control sequences for preview (preserve spaces and newlines)
        let cleanedText = text
            .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '') // Remove ANSI escape sequences
            .replace(/\x1B\x40/g, '') // Remove ESC @ (initialize)
            .replace(/\x1B\x33[\x00-\xFF]/g, '') // Remove ESC 3 n (line spacing)
            .replace(/\x1D\x56\x00/g, '') // Remove GS V 0 (cut)
            .replace(/\x1B\x61/g, '') // Remove ESC a (alignment)
            .replace(/\x1B\x45\x01/g, '') // Remove ESC E 1 (Bold ON - 1B 45 01)
            .replace(/\x1B\x45\x00/g, '') // Remove ESC E 0 (Bold OFF - 1B 45 00)
            .replace(/\x1B\x47\x01/g, '') // Remove ESC G 1 (Double-Strike ON)
            .replace(/\x1B\x47\x00/g, '') // Remove ESC G 0 (Double-Strike OFF)
            .replace(/\x1D\x21\x11/g, '') // Remove GS ! 11 (Double width and height)
            .replace(/\x1D\x21\x00/g, '') // Remove GS ! 00 (Normal size)
            .replace(/[\x00-\x08\x0B-\x1C\x1E-\x1F\x7F]/g, ''); // Remove control chars but keep \n, \t, and space
        
        // Remove leading empty lines
        cleanedText = cleanedText.replace(/^\n+/, '');
        
        return cleanedText;
    } catch (error) {
        console.error('Error fetching receipt text:', error);
        throw error;
    }
}

/**
 * Fetch sales receipt text for preview
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
 */
export async function fetchWeighInReceiptText(
    transactionId: number,
    width: 58 | 80 = 80
): Promise<string> {
    const url = `/receipts/weigh-ins/${transactionId}?width=${width}`;
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

