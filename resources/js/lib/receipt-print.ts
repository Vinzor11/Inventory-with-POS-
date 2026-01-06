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
 * This function attempts multiple print methods in order:
 * 1. Local HTTP print service (localhost:3002)
 * 2. Electron/Node print service (if available)
 * 3. Browser extension (if available)
 * 4. Web Serial API (for direct USB printer connection)
 * 5. Fallback: Download as text file for manual printing
 */
async function sendToPrinter(
    receiptData: ArrayBuffer | string,
    options: PrintOptions = {}
): Promise<void> {
    // Convert ArrayBuffer to string for methods that need it
    const receiptText = typeof receiptData === 'string' 
        ? receiptData 
        : new TextDecoder('latin1').decode(new Uint8Array(receiptData));
    
    // Method 1: Try local HTTP print service (Node.js service on localhost:3002)
    try {
        await printViaHttpService(receiptData, options);
        return;
    } catch (error) {
        console.warn('HTTP print service failed:', error);
    }

    // Method 2: Try Electron/Node print service
    if (window.electron?.print) {
        try {
            await window.electron.print(receiptText, options);
            return;
        } catch (error) {
            console.warn('Electron print failed:', error);
        }
    }

    // Method 3: Try browser extension
    if (window.printExtension?.print) {
        try {
            await window.printExtension.print(receiptText, options);
            return;
        } catch (error) {
            console.warn('Extension print failed:', error);
        }
    }

    // Method 4: Try Web Serial API (for direct USB printer connection)
    if (navigator.serial) {
        try {
            await printViaSerial(receiptText, options);
            return;
        } catch (error) {
            console.warn('Serial print failed:', error);
        }
    }

    // Fallback: Download as text file
    downloadReceipt(receiptText);
    
    // Show notification with instructions
    alert(
        'Receipt downloaded as text file.\n\n' +
        'To print directly:\n' +
        '1. Install and start the local print service (see print-service/README.md)\n' +
        '2. Or manually print the downloaded file using your thermal printer software.\n\n' +
        'The print service runs on http://localhost:3002'
    );
}

/**
 * Print via local HTTP print service
 * This connects to a Node.js service running on localhost:3002
 */
async function printViaHttpService(
    receiptData: ArrayBuffer | string,
    options: PrintOptions
): Promise<void> {
    const printServiceUrl = 'http://localhost:3002/print';
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

