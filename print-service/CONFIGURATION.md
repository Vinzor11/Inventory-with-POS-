# Print Service Configuration

## ✅ Current Configuration

- **Printer Name:** POS-80
- **Port:** 3002
- **Status:** Ready to use

## Quick Start

1. **Start the service:**
   ```bash
   cd print-service
   npm start
   ```
   Or double-click `start.bat`

2. **Keep the service running** (don't close the window)

3. **Print receipts** from your browser - they will print automatically!

## Verification

1. **Check if service is running:**
   - Open browser: http://localhost:3002/health
   - Should show: `{"status":"ok","printer":"POS-80","platform":"win32"}`

2. **List available printers:**
   - Open browser: http://localhost:3002/printers
   - Should show all installed printers

## Changing Printer

If you need to use a different printer:

1. **Find printer name:**
   ```bash
   wmic printer get name
   ```

2. **Update server.js:**
   Change line 29:
   ```javascript
   const PRINTER_NAME = process.env.PRINTER_NAME || 'Your-Printer-Name';
   ```

3. **Or set environment variable:**
   ```bash
   set PRINTER_NAME="Your Printer Name"
   npm start
   ```

## Troubleshooting

- **Service won't start:** Make sure Node.js is installed (node --version)
- **Printer not found:** Check printer name matches exactly (case-sensitive)
- **Port in use:** Change PORT in server.js or use different port
- **Print fails:** Make sure printer is online and set as default

