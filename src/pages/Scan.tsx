import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  QrCode,
  Camera,
  CameraOff,
  Package,
  MapPin,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  History,
  Loader2,
  X,
} from 'lucide-react';
import type { Item, Location } from '@/types/database';
import { getLocationTypeDisplay } from '@/lib/utils';

interface ScanResult {
  type: 'item' | 'location' | 'unknown';
  code: string;
  data: Item | Location | null;
}

export default function Scan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentScans, setRecentScans] = useState<string[]>([]);

  const handleScan = async (code: string) => {
    setLoading(true);
    setScanResult(null);

    try {
      // Parse the YIMS code format: YIMS:<TYPE>:<ID>
      const parts = code.split(':');
      
      if (parts.length >= 2 && parts[0] === 'YIMS') {
        const codeType = parts[1].toLowerCase();
        
        // Log the scan
        await supabase.from('scan_logs').insert({
          code_scanned: code,
          code_type: codeType,
          scanned_by: user?.id,
        });

        if (codeType === 'item') {
          // Look up item by code
          const { data: item, error } = await supabase
            .from('items')
            .select('*, category:categories(*), location:locations(*)')
            .eq('code', code)
            .eq('is_active', true)
            .single();

          if (error || !item) {
            setScanResult({ type: 'unknown', code, data: null });
            toast.error('Item not found');
          } else {
            setScanResult({ type: 'item', code, data: item as unknown as Item });
            toast.success(`Found: ${item.name}`);
          }
        } else if (['building', 'room', 'shelf', 'box', 'drawer'].includes(codeType)) {
          // Look up location by code
          const { data: location, error } = await supabase
            .from('locations')
            .select('*')
            .eq('code', code)
            .eq('is_active', true)
            .single();

          if (error || !location) {
            setScanResult({ type: 'unknown', code, data: null });
            toast.error('Location not found');
          } else {
            setScanResult({ type: 'location', code, data: location as Location });
            toast.success(`Found: ${location.name}`);
          }
        } else {
          setScanResult({ type: 'unknown', code, data: null });
          toast.warning('Unknown code type');
        }
      } else {
        // Not a YIMS code - try to find it anyway
        const { data: item } = await supabase
          .from('items')
          .select('*, category:categories(*), location:locations(*)')
          .eq('code', code)
          .eq('is_active', true)
          .single();

        if (item) {
          setScanResult({ type: 'item', code, data: item as unknown as Item });
          toast.success(`Found: ${item.name}`);
        } else {
          setScanResult({ type: 'unknown', code, data: null });
          toast.warning('Code not recognized');
        }
      }

      // Add to recent scans
      setRecentScans((prev) => [code, ...prev.filter((c) => c !== code)].slice(0, 5));
    } catch (error) {
      console.error('Error processing scan:', error);
      toast.error('Failed to process scan');
    } finally {
      setLoading(false);
    }
  };

  const {
    startScanning,
    stopScanning,
    isScanning,
    error: scannerError,
    clearLastScanned,
  } = useBarcodeScanner({
    onScan: handleScan,
    debounceMs: 3000,
    containerId: 'scanner-container',
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const handleStockIn = () => {
    if (scanResult?.type === 'item' && scanResult.data) {
      navigate('/stock', { state: { itemId: scanResult.data.id, action: 'stock_in' } });
    }
  };

  const handleStockOut = () => {
    if (scanResult?.type === 'item' && scanResult.data) {
      navigate('/stock', { state: { itemId: scanResult.data.id, action: 'stock_out' } });
    }
  };

  const clearResult = () => {
    setScanResult(null);
    clearLastScanned();
  };

  const getStockBadge = (item: Item) => {
    if (item.current_stock <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (item.current_stock < item.minimum_stock) {
      return <Badge className="bg-warning text-warning-foreground">Low Stock</Badge>;
    }
    return <Badge className="bg-success/10 text-success border-success/20">In Stock</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Barcode Scanner</h1>
        <p className="text-muted-foreground">Scan QR codes to quickly access items and locations</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scanner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scanner
            </CardTitle>
            <CardDescription>
              Point your camera at a YIMS QR code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Camera Viewport */}
            <div className="relative aspect-square w-full max-w-md mx-auto overflow-hidden rounded-lg border-2 border-dashed border-muted bg-muted/20">
              <div id="scanner-container" className="w-full h-full" />
              
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Camera className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-center px-4">
                    Click "Start Camera" to begin scanning
                  </p>
                </div>
              )}

              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </div>

            {/* Scanner Error */}
            {scannerError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {scannerError}
              </div>
            )}

            {/* Controls */}
            <div className="flex justify-center gap-4">
              {isScanning ? (
                <Button onClick={stopScanning} variant="secondary" size="lg">
                  <CameraOff className="mr-2 h-4 w-4" />
                  Stop Camera
                </Button>
              ) : (
                <Button onClick={startScanning} size="lg">
                  <Camera className="mr-2 h-4 w-4" />
                  Start Camera
                </Button>
              )}
            </div>

            {/* Recent Scans */}
            {recentScans.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Recent scans:</p>
                <div className="flex flex-wrap gap-2">
                  {recentScans.map((code, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleScan(code)}
                    >
                      {code.length > 25 ? `${code.slice(0, 25)}...` : code}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan Result */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {scanResult?.type === 'item' ? (
                  <Package className="h-5 w-5" />
                ) : scanResult?.type === 'location' ? (
                  <MapPin className="h-5 w-5" />
                ) : (
                  <History className="h-5 w-5" />
                )}
                Scan Result
              </span>
              {scanResult && (
                <Button variant="ghost" size="icon" onClick={clearResult}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!scanResult ? (
              <div className="py-12 text-center text-muted-foreground">
                <QrCode className="mx-auto h-16 w-16 opacity-50" />
                <p className="mt-4">Scan a code to see details</p>
              </div>
            ) : scanResult.type === 'unknown' ? (
              <div className="py-8 text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-warning" />
                <h3 className="mt-4 text-lg font-medium">Code Not Recognized</h3>
                <p className="text-sm text-muted-foreground mt-2 font-mono break-all">
                  {scanResult.code}
                </p>
              </div>
            ) : scanResult.type === 'item' && scanResult.data ? (
              <div className="space-y-6">
                {/* Item Header */}
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{(scanResult.data as Item).name}</h3>
                    <p className="text-sm text-muted-foreground font-mono">
                      {(scanResult.data as Item).code}
                    </p>
                    <div className="mt-2">
                      {getStockBadge(scanResult.data as Item)}
                    </div>
                  </div>
                </div>

                {/* Item Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Current Stock</p>
                    <p className="text-2xl font-bold">
                      {(scanResult.data as Item).current_stock}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        {(scanResult.data as Item).unit}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Minimum Stock</p>
                    <p className="text-2xl font-bold">
                      {(scanResult.data as Item).minimum_stock}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        {(scanResult.data as Item).unit}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Location & Category */}
                <div className="space-y-2 text-sm">
                  {(scanResult.data as unknown as { category?: { name: string } }).category && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category</span>
                      <span>{(scanResult.data as unknown as { category: { name: string } }).category.name}</span>
                    </div>
                  )}
                  {(scanResult.data as unknown as { location?: { name: string } }).location && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location</span>
                      <span>{(scanResult.data as unknown as { location: { name: string } }).location.name}</span>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button className="flex-1" onClick={handleStockIn}>
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Stock In
                  </Button>
                  <Button variant="secondary" className="flex-1" onClick={handleStockOut}>
                    <ArrowUpFromLine className="mr-2 h-4 w-4" />
                    Stock Out
                  </Button>
                </div>
              </div>
            ) : scanResult.type === 'location' && scanResult.data ? (
              <div className="space-y-6">
                {/* Location Header */}
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                    <MapPin className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{(scanResult.data as Location).name}</h3>
                    <p className="text-sm text-muted-foreground font-mono">
                      {(scanResult.data as Location).code}
                    </p>
                    <Badge variant="secondary" className="mt-2 capitalize">
                      {getLocationTypeDisplay(scanResult.data as Location)}
                    </Badge>
                  </div>
                </div>

                {/* Location Description */}
                {(scanResult.data as Location).description && (
                  <p className="text-sm text-muted-foreground">
                    {(scanResult.data as Location).description}
                  </p>
                )}

                {/* Quick Actions */}
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate('/locations')}
                  >
                    View in Locations
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to use</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                1
              </div>
              <div>
                <p className="font-medium">Start Camera</p>
                <p className="text-sm text-muted-foreground">
                  Allow camera access when prompted
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                2
              </div>
              <div>
                <p className="font-medium">Scan QR Code</p>
                <p className="text-sm text-muted-foreground">
                  Point at a YIMS item or location code
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                3
              </div>
              <div>
                <p className="font-medium">Take Action</p>
                <p className="text-sm text-muted-foreground">
                  View details or record stock movements
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
