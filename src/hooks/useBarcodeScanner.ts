import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

interface UseBarcodeScanner {
  startScanning: () => Promise<void>;
  stopScanning: () => Promise<void>;
  isScanning: boolean;
  error: string | null;
  lastScanned: string | null;
  clearLastScanned: () => void;
}

interface UseBarcodeScannerProps {
  onScan: (code: string) => void;
  debounceMs?: number;
  containerId: string;
}

export function useBarcodeScanner({
  onScan,
  debounceMs = 3000,
  containerId,
}: UseBarcodeScannerProps): UseBarcodeScanner {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  const handleScan = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      // Debounce duplicate scans
      if (now - lastScanTimeRef.current < debounceMs) {
        return;
      }
      lastScanTimeRef.current = now;
      setLastScanned(decodedText);
      onScan(decodedText);
    },
    [onScan, debounceMs]
  );

  const startScanning = useCallback(async () => {
    setError(null);
    
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId);
      }

      const scanner = scannerRef.current;
      
      // Check if already scanning
      if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
        return;
      }

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        handleScan,
        () => {} // Ignore error frames
      );
      
      setIsScanning(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start camera';
      setError(message);
      setIsScanning(false);
    }
  }, [containerId, handleScan]);

  const stopScanning = useCallback(async () => {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      }
    } catch (err) {
      console.error('Error stopping scanner:', err);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const clearLastScanned = useCallback(() => {
    setLastScanned(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          scannerRef.current.stop().catch(console.error);
        }
      }
    };
  }, []);

  return {
    startScanning,
    stopScanning,
    isScanning,
    error,
    lastScanned,
    clearLastScanned,
  };
}
