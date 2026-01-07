import { Head } from '@inertiajs/react'
import { useState, useEffect } from 'react'
import HeadingSmall from '@/components/heading-small'
import { type BreadcrumbItem } from '@/types'
import AppLayout from '@/layouts/app-layout'
import SettingsLayout from '@/layouts/settings/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
    getPrintMethod, 
    setPrintMethod, 
    getNetworkPrinterIP, 
    setNetworkPrinterIP,
    type PrintMethod 
} from '@/lib/receipt-print'
import { Printer, Wifi, Usb, Globe, CheckCircle, XCircle, Loader2 } from 'lucide-react'

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Printer settings',
        href: '/settings/printer',
    },
]

export default function PrinterSettings() {
    const [method, setMethod] = useState<PrintMethod>('browser')
    const [printerIP, setPrinterIP] = useState('')
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
    const [testMessage, setTestMessage] = useState('')
    const [saved, setSaved] = useState(false)

    // Load saved settings on mount
    useEffect(() => {
        setMethod(getPrintMethod())
        setPrinterIP(getNetworkPrinterIP() || '')
    }, [])

    const handleMethodChange = (value: PrintMethod) => {
        setMethod(value)
        setPrintMethod(value)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const handleIPChange = (value: string) => {
        setPrinterIP(value)
    }

    const handleSaveIP = () => {
        setNetworkPrinterIP(printerIP || null)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const handleTestConnection = async () => {
        if (!printerIP) {
            setTestStatus('error')
            setTestMessage('Please enter a printer IP address')
            return
        }

        setTestStatus('testing')
        setTestMessage('Testing connection...')

        try {
            const response = await fetch('/api/print/network/test-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({
                    printer_ip: printerIP,
                    printer_port: 9100,
                }),
            })

            const result = await response.json()
            
            if (result.success && result.reachable) {
                setTestStatus('success')
                setTestMessage(result.message)
            } else {
                setTestStatus('error')
                setTestMessage(result.message)
            }
        } catch (error) {
            setTestStatus('error')
            setTestMessage('Failed to test connection. Please try again.')
        }
    }

    const handleTestPrint = async () => {
        if (!printerIP) {
            setTestStatus('error')
            setTestMessage('Please enter a printer IP address')
            return
        }

        setTestStatus('testing')
        setTestMessage('Sending test print...')

        try {
            const response = await fetch('/api/print/network/test-print', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({
                    printer_ip: printerIP,
                    printer_port: 9100,
                }),
            })

            const result = await response.json()
            
            if (result.success) {
                setTestStatus('success')
                setTestMessage(result.message)
            } else {
                setTestStatus('error')
                setTestMessage(result.message)
            }
        } catch (error) {
            setTestStatus('error')
            setTestMessage('Failed to send test print. Please try again.')
        }
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Printer settings" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Printer settings"
                        description="Configure how receipts are printed from your device"
                    />

                    {saved && (
                        <Alert className="bg-green-50 border-green-200">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">
                                Settings saved!
                            </AlertDescription>
                        </Alert>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Printer className="h-5 w-5" />
                                Print Method
                            </CardTitle>
                            <CardDescription>
                                Choose how your device sends print jobs to the thermal printer
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RadioGroup value={method} onValueChange={(v) => handleMethodChange(v as PrintMethod)}>
                                <div className="space-y-4">
                                    <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => handleMethodChange('browser')}>
                                        <RadioGroupItem value="browser" id="browser" className="mt-1" />
                                        <div className="flex-1">
                                            <Label htmlFor="browser" className="flex items-center gap-2 cursor-pointer font-medium">
                                                <Globe className="h-4 w-4" />
                                                Browser Print Dialog
                                            </Label>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Opens the browser's print dialog. Works with any printer your tablet can see 
                                                (WiFi printers, AirPrint, Google Cloud Print).
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => handleMethodChange('network')}>
                                        <RadioGroupItem value="network" id="network" className="mt-1" />
                                        <div className="flex-1">
                                            <Label htmlFor="network" className="flex items-center gap-2 cursor-pointer font-medium">
                                                <Wifi className="h-4 w-4" />
                                                Network Printer (LAN)
                                            </Label>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Send directly to a thermal printer connected via Ethernet/LAN. 
                                                Requires the printer's IP address. Best for ESC/POS thermal printers.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer opacity-50" onClick={() => handleMethodChange('usb')}>
                                        <RadioGroupItem value="usb" id="usb" className="mt-1" disabled />
                                        <div className="flex-1">
                                            <Label htmlFor="usb" className="flex items-center gap-2 cursor-pointer font-medium">
                                                <Usb className="h-4 w-4" />
                                                USB (OTG)
                                            </Label>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Connect printer directly via USB-OTG adapter. 
                                                <span className="text-amber-600"> (Requires browser support - may not work on all tablets)</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </RadioGroup>
                        </CardContent>
                    </Card>

                    {method === 'network' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Wifi className="h-5 w-5" />
                                    Network Printer Configuration
                                </CardTitle>
                                <CardDescription>
                                    Enter your thermal printer's IP address. The printer must be connected to your network via Ethernet.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Alert className="bg-amber-50 border-amber-200">
                                    <AlertDescription className="text-amber-800">
                                        <strong>Note:</strong> Network printing only works if your app server can reach your printer. 
                                        Since this app is hosted in the cloud, this option may not work for local printers. 
                                        Consider using <strong>Browser Print with RawBT</strong> instead (see below).
                                    </AlertDescription>
                                </Alert>

                                <div className="space-y-2">
                                    <Label htmlFor="printer-ip">Printer IP Address</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="printer-ip"
                                            placeholder="192.168.1.100"
                                            value={printerIP}
                                            onChange={(e) => handleIPChange(e.target.value)}
                                            className="font-mono"
                                        />
                                        <Button onClick={handleSaveIP} variant="secondary">
                                            Save
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Find this in your printer's settings menu or by printing a network configuration page.
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <Button 
                                        onClick={handleTestConnection} 
                                        variant="outline"
                                        disabled={testStatus === 'testing'}
                                    >
                                        {testStatus === 'testing' ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : null}
                                        Test Connection
                                    </Button>
                                    <Button 
                                        onClick={handleTestPrint} 
                                        variant="outline"
                                        disabled={testStatus === 'testing'}
                                    >
                                        {testStatus === 'testing' ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : null}
                                        Print Test Page
                                    </Button>
                                </div>

                                {testStatus !== 'idle' && testStatus !== 'testing' && (
                                    <Alert className={testStatus === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                                        {testStatus === 'success' ? (
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-red-600" />
                                        )}
                                        <AlertDescription className={testStatus === 'success' ? 'text-green-800' : 'text-red-800'}>
                                            {testMessage}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="p-4 bg-muted rounded-lg space-y-4">
                                    <div>
                                        <h4 className="font-medium mb-2">How to find your printer's IP address:</h4>
                                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                                            <li>On the printer, hold the FEED button while turning it on</li>
                                            <li>This prints a self-test page with network info</li>
                                            <li>Look for "IP Address" - it shows as <code className="bg-background px-1 rounded">192-168-1-100</code> (dashes = dots)</li>
                                            <li>Convert to: <code className="bg-background px-1 rounded">192.168.1.100</code></li>
                                        </ol>
                                    </div>

                                    <div className="pt-2 border-t">
                                        <h4 className="font-medium mb-2 text-amber-700">⚠️ Printer Not Showing in Router?</h4>
                                        <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                                            <li><strong>Check Ethernet cable:</strong> Make sure it's firmly plugged into both printer and router</li>
                                            <li><strong>Check router port:</strong> Try a different Ethernet port on your router</li>
                                            <li><strong>Check printer status:</strong> Print another self-test page - look for "Connection: OK" or "Status: Online"</li>
                                            <li><strong>Try RawBT anyway:</strong> Even if router doesn't show it, RawBT might still connect if printer is on the network</li>
                                            <li><strong>Test from tablet:</strong> Open browser on tablet, go to <code className="bg-background px-1 rounded">http://192.168.1.100</code> - if page loads, printer is connected</li>
                                            <li><strong>Check IP range:</strong> Make sure printer IP (192.168.1.100) matches your router's network (usually 192.168.1.x)</li>
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {method === 'browser' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>📱 Recommended: Use RawBT App (Android)</CardTitle>
                                <CardDescription>
                                    The easiest way to print from your Android tablet to your Vozy P80 thermal printer
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <h4 className="font-medium text-green-800 mb-2">Setup Steps:</h4>
                                    <ol className="text-sm text-green-700 space-y-2 list-decimal list-inside">
                                        <li>
                                            <strong>Install RawBT</strong> from Google Play Store
                                            <br />
                                            <span className="text-xs">Search for "RawBT Print Service"</span>
                                        </li>
                                        <li>
                                            <strong>Find your printer's IP:</strong>
                                            <br />
                                            <span className="text-xs">Turn off printer → Hold FEED button → Turn on → Read IP from printout</span>
                                        </li>
                                        <li>
                                            <strong>Configure RawBT:</strong>
                                            <br />
                                            <span className="text-xs">Open RawBT → Settings → Connection: Network (TCP/IP) → Enter IP → Port: 9100</span>
                                        </li>
                                        <li>
                                            <strong>Print from HIMS:</strong>
                                            <br />
                                            <span className="text-xs">When printing, select "RawBT" as your printer in the print dialog</span>
                                        </li>
                                    </ol>
                                </div>

                                <div className="p-4 bg-muted rounded-lg">
                                    <h4 className="font-medium mb-2">Alternative Options:</h4>
                                    <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                                        <li>Make sure your printer is connected to the same WiFi network as your tablet</li>
                                        <li>Some printers support direct Android printing - check your printer's manual</li>
                                        <li>The receipt will open in a print preview - select your printer from the list</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </SettingsLayout>
        </AppLayout>
    )
}

