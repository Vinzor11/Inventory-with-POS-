/**
 * HIMS Print Service
 * 
 * A local HTTP server that receives receipt text and prints it directly
 * to the configured thermal printer using Windows print commands.
 * 
 * Usage:
 *   1. Install: npm install
 *   2. Configure printer name in .env or environment variable
 *   3. Run: npm start
 *   4. The service will listen on http://localhost:3002
 */

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
// Accept both text/plain (for backward compatibility) and raw binary data
app.use(express.raw({ type: ['text/plain', 'application/octet-stream'], limit: '10mb' }));

// Get printer name from environment or use default
const PRINTER_NAME = process.env.PRINTER_NAME || 'POS-80'; // Change to your printer name

/**
 * Print receipt using raw binary data to preserve ESC/POS commands
 * Writes as binary and uses copy /B to send raw data to printer
 */
function printToWindowsPrinter(receiptBuffer, printerName) {
    return new Promise((resolve, reject) => {
        // Create temporary file
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `receipt-${Date.now()}.raw`);
        
        // receiptBuffer is already a Buffer with raw binary data (including ESC/POS commands)
        // Write directly as binary file
        fs.writeFileSync(tempFile, receiptBuffer);
        
        // Use Windows Print Spooler API via PowerShell
        // This is the most reliable method for USB printers with drivers and preserves ESC/POS commands
        const filePath = tempFile.replace(/\\/g, '\\\\');
        const psScript = `
$ErrorActionPreference = "Stop"
try {
    $bytes = [System.IO.File]::ReadAllBytes('${filePath}');
    Write-Host "Read $($bytes.Length) bytes from file"
    
    $printer = Get-Printer -Name '${printerName}' -ErrorAction Stop;
    Write-Host "Found printer: $($printer.Name) on port: $($printer.PortName)"
    
    # Use Windows Print Spooler API (most reliable for USB printers)
    Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        
        public class Win32Print {
            [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
            public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPTStr)] string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
            
            [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
            public static extern bool ClosePrinter(IntPtr hPrinter);
            
            [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
            public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);
            
            [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
            public static extern bool EndDocPrinter(IntPtr hPrinter);
            
            [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
            public static extern bool StartPagePrinter(IntPtr hPrinter);
            
            [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
            public static extern bool EndPagePrinter(IntPtr hPrinter);
            
            [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
            public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
            
            [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
            public class DOCINFOA {
                [MarshalAs(UnmanagedType.LPTStr)]
                public string pDocName;
                [MarshalAs(UnmanagedType.LPTStr)]
                public string pOutputFile;
                [MarshalAs(UnmanagedType.LPTStr)]
                public string pDataType;
            }
        }
"@
    
    $printerName = '${printerName}'
    $hPrinter = [IntPtr]::Zero
    
    try {
        Write-Host "Attempting to open printer: $printerName"
        $result = [Win32Print]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)
        if (-not $result) {
            $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
            throw "Failed to open printer. Error code: $errorCode"
        }
        Write-Host "Printer opened successfully. Handle: $hPrinter"
        
        $di = New-Object Win32Print+DOCINFOA
        $di.pDocName = "Receipt"
        $di.pOutputFile = $null
        $di.pDataType = "RAW"
        
        Write-Host "Starting document..."
        $result = [Win32Print]::StartDocPrinter($hPrinter, 1, $di)
        if (-not $result) {
            $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
            throw "Failed to start document. Error code: $errorCode"
        }
        Write-Host "Document started successfully"
        
        Write-Host "Starting page..."
        $result = [Win32Print]::StartPagePrinter($hPrinter)
        if (-not $result) {
            $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
            throw "Failed to start page. Error code: $errorCode"
        }
        Write-Host "Page started successfully"
        
        Write-Host "Allocating memory for $($bytes.Length) bytes..."
        $pBytes = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
        [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $pBytes, $bytes.Length)
        
        Write-Host "Writing to printer..."
        $dwWritten = 0
        $result = [Win32Print]::WritePrinter($hPrinter, $pBytes, $bytes.Length, [ref]$dwWritten)
        if (-not $result) {
            $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
            throw "Failed to write to printer. Error code: $errorCode, Written: $dwWritten"
        }
        Write-Host "Written $dwWritten of $($bytes.Length) bytes to printer"
        
        [System.Runtime.InteropServices.Marshal]::FreeHGlobal($pBytes)
        
        [Win32Print]::EndPagePrinter($hPrinter) | Out-Null
        [Win32Print]::EndDocPrinter($hPrinter) | Out-Null
        Write-Host "SUCCESS: Document sent to printer spooler"
    } finally {
        if ($hPrinter -ne [IntPtr]::Zero) {
            [Win32Print]::ClosePrinter($hPrinter) | Out-Null
        }
    }
    
    exit 0
} catch {
    Write-Host "ERROR: $_"
    Write-Host $_.Exception.Message
    Write-Host $_.ScriptStackTrace
    exit 1
}
        `.trim();
        
            const psScriptFile = path.join(tempDir, `print-${Date.now()}.ps1`);
            fs.writeFileSync(psScriptFile, psScript, 'utf8');
            
            console.log(`Attempting to print to: ${printerName}`);
            console.log(`Temp file: ${tempFile}`);
            console.log(`File size: ${receiptBuffer.length} bytes`);
            
            const powershellCommand = `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptFile}"`;
            
            exec(powershellCommand, { timeout: 15000 }, (error, stdout, stderr) => {
            // Clean up PowerShell script
            try {
                if (fs.existsSync(psScriptFile)) {
                    fs.unlinkSync(psScriptFile);
                }
            } catch (err) {
                console.error('Error deleting PS script:', err);
            }
            
            // Log output for debugging
            if (stdout) {
                console.log('PowerShell output:');
                console.log(stdout);
            }
            if (stderr) {
                console.error('PowerShell errors:');
                console.error(stderr);
            }
            
                if (error) {
                    console.error('PowerShell Print Spooler API failed:', error.message);
                    if (error.code) console.error('Exit code:', error.code);
                    if (stdout) console.log('PowerShell output:', stdout);
                    if (stderr) console.error('PowerShell errors:', stderr);
                    
                    // Method 2: Try copy /B to printer share (will fail if printer not shared)
                const hostname = os.hostname();
                const copyCommand = `copy /B "${tempFile}" "\\\\${hostname}\\${printerName}"`;
                console.log(`Trying copy command: ${copyCommand}`);
                
                exec(copyCommand, { timeout: 10000 }, (error2, stdout2, stderr2) => {
                    if (stdout2) console.log('Copy stdout:', stdout2);
                    if (stderr2) console.error('Copy stderr:', stderr2);
                    
                        if (error2) {
                            console.error('Copy command failed:', error2.message);
                            
                            // Method 3: Try using print command (may not preserve ESC/POS)
                        const printCommand = `print /D:"${printerName}" "${tempFile}"`;
                        console.log(`Trying print command: ${printCommand}`);
                        
                        exec(printCommand, { timeout: 10000 }, (error3, stdout3, stderr3) => {
                            if (stdout3) console.log('Print stdout:', stdout3);
                            if (stderr3) console.error('Print stderr:', stderr3);
                            
                            // Clean up temp file
                            setTimeout(() => {
                                try {
                                    if (fs.existsSync(tempFile)) {
                                        fs.unlinkSync(tempFile);
                                    }
                                } catch (err) {
                                    console.error('Error deleting temp file:', err);
                                }
                            }, 2000);
                            
                            // Check if print command actually failed (even if exit code is 0)
                            const output = (stdout3 || '').toLowerCase();
                            const hasError = output.includes('unable to initialize') || 
                                           output.includes('error') || 
                                           output.includes('cannot') ||
                                           output.includes('failed');
                            
                            if (error3 || hasError) {
                                reject(new Error(
                                    `All print methods failed.\n` +
                                    `PowerShell Print Spooler API: ${error.message}\n` +
                                    `Copy /B: ${error2.message}\n` +
                                    `Print command: ${error3 ? error3.message : (stdout3 || 'Unknown error')}\n\n` +
                                    `Please ensure printer "${printerName}" is:\n` +
                                    `1. Installed and online\n` +
                                    `2. Not paused or in error state\n` +
                                    `3. Try restarting the print spooler service`
                                ));
                            } else {
                                console.log('Print command succeeded');
                                resolve();
                            }
                        });
                    } else {
                        // Clean up temp file
                        setTimeout(() => {
                            try {
                                if (fs.existsSync(tempFile)) {
                                    fs.unlinkSync(tempFile);
                                }
                            } catch (err) {
                                console.error('Error deleting temp file:', err);
                            }
                        }, 2000);
                        console.log('Copy command succeeded');
                        resolve();
                    }
                });
            } else {
                // Clean up temp file
                setTimeout(() => {
                    try {
                        if (fs.existsSync(tempFile)) {
                            fs.unlinkSync(tempFile);
                        }
                    } catch (err) {
                        console.error('Error deleting temp file:', err);
                    }
                }, 2000);
                console.log('PowerShell print succeeded');
                resolve();
            }
        });
    });
}

/**
 * Print endpoint
 */
app.post('/print', async (req, res) => {
    try {
        // req.body is now a Buffer containing raw binary data (including ESC/POS commands)
        const receiptBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body, 'latin1');
        const printerName = req.query.printer || PRINTER_NAME;
        
        if (!receiptBuffer || receiptBuffer.length === 0) {
            return res.status(400).json({ error: 'No receipt data provided' });
        }
        
        console.log(`\n=== Print Request ===`);
        console.log(`Printer: ${printerName}`);
        console.log(`Data size: ${receiptBuffer.length} bytes`);
        console.log(`First 50 bytes (hex): ${receiptBuffer.slice(0, 50).toString('hex')}`);
        console.log(`First 200 chars (text): ${receiptBuffer.slice(0, 200).toString('latin1').replace(/[\x00-\x1F]/g, '.')}`);
        
        try {
            await printToWindowsPrinter(receiptBuffer, printerName);
            console.log(`✓ Print job completed successfully\n`);
            res.json({ success: true, message: 'Receipt sent to printer', bytes: receiptBuffer.length });
        } catch (printError) {
            console.error(`✗ Print job failed:`, printError);
            res.status(500).json({ error: printError.message, bytes: receiptBuffer.length });
        }
    } catch (error) {
        console.error('Print error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        printer: PRINTER_NAME,
        platform: os.platform()
    });
});

/**
 * List available printers (Windows) with details
 */
app.get('/printers', (req, res) => {
    exec('powershell -Command "Get-Printer | Select-Object Name, PortName, PrinterStatus, DriverName | ConvertTo-Json"', (error, stdout, stderr) => {
        if (error) {
            // Fallback to wmic
            exec('wmic printer get name', (error2, stdout2) => {
                if (error2) {
                    return res.status(500).json({ error: 'Failed to list printers', details: error2.message });
                }
                
                const printers = stdout2
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && line !== 'Name' && !line.startsWith('---'))
                    .filter(Boolean);
                
                res.json({ printers, method: 'wmic' });
            });
        } else {
            try {
                const printerData = JSON.parse(stdout);
                const printers = Array.isArray(printerData) ? printerData : [printerData];
                res.json({ printers, method: 'powershell', configured: PRINTER_NAME });
            } catch (parseError) {
                res.json({ printers: [], raw: stdout, error: parseError.message });
            }
        }
    });
});

/**
 * Test print endpoint - sends a simple test receipt
 * Supports both GET and POST for easy testing
 */
app.get('/test', async (req, res) => {
    await handleTestPrint(req, res);
});

app.post('/test', async (req, res) => {
    await handleTestPrint(req, res);
});

async function handleTestPrint(req, res) {
    try {
        const printerName = req.query.printer || PRINTER_NAME;
        
        // Create a simple test receipt with ESC/POS commands
        const testReceipt = Buffer.from(
            '\x1B\x40' + // Initialize
            '\x1B\x61\x01' + // Center align
            'TEST RECEIPT\n' +
            '============\n' +
            '\x1B\x61\x00' + // Left align
            'This is a test print.\n' +
            'If you see this, printing works!\n' +
            '\n\n\n' + // Feed paper
            '\x1D\x56\x00' // Cut paper
        );
        
        console.log(`\n=== Test Print Request ===`);
        console.log(`Printer: ${printerName}`);
        
        await printToWindowsPrinter(testReceipt, printerName);
        
        res.json({ success: true, message: 'Test receipt sent to printer', printer: printerName });
    } catch (error) {
        console.error('Test print error:', error);
        res.status(500).json({ error: error.message, printer: req.query.printer || PRINTER_NAME });
    }
}

app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`HIMS Print Service running on port ${PORT}`);
    console.log(`Configured printer: ${PRINTER_NAME}`);
    console.log(`\nTo change printer, set PRINTER_NAME environment variable`);
    console.log(`or use ?printer=PRINTER_NAME in the print request`);
    console.log(`\nHealth check: http://localhost:${PORT}/health`);
    console.log(`List printers: http://localhost:${PORT}/printers`);
    console.log(`========================================\n`);
});

