<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class NetworkPrintController extends Controller
{
    /**
     * Send print data to a network printer via raw socket (port 9100)
     * 
     * Most thermal printers accept raw ESC/POS data on port 9100
     */
    public function print(Request $request): JsonResponse
    {
        $request->validate([
            'printer_ip' => 'required|ip',
            'printer_port' => 'integer|min:1|max:65535',
            'data' => 'required|array',
        ]);

        $printerIP = $request->input('printer_ip');
        $printerPort = $request->input('printer_port', 9100);
        $data = $request->input('data');

        // Convert array of bytes back to binary string
        $binaryData = pack('C*', ...$data);

        try {
            // Create socket connection to printer
            $socket = @fsockopen($printerIP, $printerPort, $errno, $errstr, 5);
            
            if (!$socket) {
                return response()->json([
                    'success' => false,
                    'message' => "Could not connect to printer at {$printerIP}:{$printerPort}. Error: {$errstr} ({$errno})",
                ], 500);
            }

            // Set timeout for write operations
            stream_set_timeout($socket, 10);

            // Send the data
            $bytesWritten = fwrite($socket, $binaryData);
            
            if ($bytesWritten === false) {
                fclose($socket);
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to send data to printer',
                ], 500);
            }

            // Close the connection
            fclose($socket);

            return response()->json([
                'success' => true,
                'message' => 'Print job sent successfully',
                'bytes_sent' => $bytesWritten,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Print error: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Test connection to a network printer
     */
    public function testConnection(Request $request): JsonResponse
    {
        $request->validate([
            'printer_ip' => 'required|ip',
            'printer_port' => 'integer|min:1|max:65535',
        ]);

        $printerIP = $request->input('printer_ip');
        $printerPort = $request->input('printer_port', 9100);

        try {
            $socket = @fsockopen($printerIP, $printerPort, $errno, $errstr, 5);
            
            if (!$socket) {
                return response()->json([
                    'success' => false,
                    'reachable' => false,
                    'message' => "Could not connect to {$printerIP}:{$printerPort}. Error: {$errstr}",
                ]);
            }

            fclose($socket);

            return response()->json([
                'success' => true,
                'reachable' => true,
                'message' => "Successfully connected to printer at {$printerIP}:{$printerPort}",
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'reachable' => false,
                'message' => 'Connection error: ' . $e->getMessage(),
            ]);
        }
    }

    /**
     * Send a test print to the network printer
     */
    public function testPrint(Request $request): JsonResponse
    {
        $request->validate([
            'printer_ip' => 'required|ip',
            'printer_port' => 'integer|min:1|max:65535',
        ]);

        $printerIP = $request->input('printer_ip');
        $printerPort = $request->input('printer_port', 9100);

        // Create a simple test receipt with ESC/POS commands
        $testReceipt = 
            "\x1B\x40" . // Initialize printer
            "\x1B\x61\x01" . // Center align
            "================================\n" .
            "       TEST PRINT\n" .
            "================================\n" .
            "\x1B\x61\x00" . // Left align
            "\n" .
            "If you can read this, your\n" .
            "network printer is working!\n" .
            "\n" .
            "Printer IP: {$printerIP}\n" .
            "Port: {$printerPort}\n" .
            "Time: " . now()->format('Y-m-d H:i:s') . "\n" .
            "\n" .
            "================================\n" .
            "\n\n\n" .
            "\x1D\x56\x00"; // Cut paper

        try {
            $socket = @fsockopen($printerIP, $printerPort, $errno, $errstr, 5);
            
            if (!$socket) {
                return response()->json([
                    'success' => false,
                    'message' => "Could not connect to printer at {$printerIP}:{$printerPort}. Error: {$errstr}",
                ], 500);
            }

            stream_set_timeout($socket, 10);
            $bytesWritten = fwrite($socket, $testReceipt);
            fclose($socket);

            if ($bytesWritten === false) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to send test print',
                ], 500);
            }

            return response()->json([
                'success' => true,
                'message' => 'Test print sent! Check your printer.',
                'bytes_sent' => $bytesWritten,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Print error: ' . $e->getMessage(),
            ], 500);
        }
    }
}

