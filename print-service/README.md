# HIMS Print Service

A local print service for thermal receipt printing on Windows.

## Quick Start

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org/
   - Install version 18 or higher

2. **Install dependencies:**
   ```bash
   cd print-service
   npm install
   ```

3. **Find your printer name:**
   ```bash
   npm start
   # Then visit: http://localhost:3002/printers
   # Or run: wmic printer get name
   ```

4. **Configure printer name:**
   - Option 1: Set environment variable
     ```bash
     set PRINTER_NAME="Your Printer Name"
     npm start
     ```
   - Option 2: Create `.env` file
     ```
     PRINTER_NAME=Your Printer Name
     PORT=3002
     ```

5. **Start the service:**
   ```bash
   npm start
   ```

6. **Update the frontend** to use the print service (see below)

## How It Works

- The service runs on `http://localhost:3002`
- Receives receipt text via POST request
- Prints directly to Windows printer using `print` command
- No browser extensions needed!

## Integration

The frontend will automatically detect and use this service when it's running.

## Troubleshooting

- **Printer not found:** Check printer name matches exactly (case-sensitive)
- **Permission denied:** Run as Administrator if needed
- **Port already in use:** Change PORT in .env or use different port

