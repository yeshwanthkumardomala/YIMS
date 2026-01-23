import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Printer, QrCode, BarChart3 } from 'lucide-react';

interface CodeGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  name: string;
  type: 'item' | 'location';
}

export function CodeGenerator({ open, onOpenChange, code, name, type }: CodeGeneratorProps) {
  const [activeTab, setActiveTab] = useState<'qr' | 'barcode'>('qr');
  const qrRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<HTMLDivElement>(null);

  const downloadCode = () => {
    const container = activeTab === 'qr' ? qrRef.current : barcodeRef.current;
    if (!container) return;

    const svg = container.querySelector('svg');
    if (!svg) return;

    // Create canvas from SVG
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      // Add padding for the label
      const padding = 60;
      canvas.width = img.width + 40;
      canvas.height = img.height + padding + 20;

      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw image centered
      ctx.drawImage(img, 20, 20);

      // Add label text
      ctx.fillStyle = 'black';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(name, canvas.width / 2, img.height + 45);
      ctx.font = '12px Arial';
      ctx.fillText(code, canvas.width / 2, img.height + 65);

      // Download
      const link = document.createElement('a');
      link.download = `${code.replace(/:/g, '-')}-${activeTab}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const printCode = () => {
    const container = activeTab === 'qr' ? qrRef.current : barcodeRef.current;
    if (!container) return;

    const svg = container.querySelector('svg');
    if (!svg) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svgData = new XMLSerializer().serializeToString(svg);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print ${type === 'item' ? 'Item' : 'Location'} Code</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
            }
            .label {
              margin-top: 16px;
              text-align: center;
            }
            .name {
              font-weight: bold;
              font-size: 16px;
            }
            .code {
              font-size: 14px;
              color: #666;
              margin-top: 4px;
            }
            @media print {
              body { padding: 20mm; }
            }
          </style>
        </head>
        <body>
          ${svgData}
          <div class="label">
            <div class="name">${name}</div>
            <div class="code">${code}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Generate Code
          </DialogTitle>
          <DialogDescription>
            Generate a QR code or barcode for <strong>{name}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'qr' | 'barcode')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qr" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="barcode" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Barcode
            </TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="flex flex-col items-center py-6">
            <div ref={qrRef} className="rounded-lg bg-white p-4">
              <QRCodeSVG
                value={code}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            <div className="mt-4 text-center">
              <p className="font-medium">{name}</p>
              <p className="text-sm text-muted-foreground">{code}</p>
            </div>
          </TabsContent>

          <TabsContent value="barcode" className="flex flex-col items-center py-6">
            <div ref={barcodeRef} className="rounded-lg bg-white p-4">
              <Barcode
                value={code}
                format="CODE128"
                width={1.5}
                height={80}
                displayValue={false}
                background="#ffffff"
              />
            </div>
            <div className="mt-4 text-center">
              <p className="font-medium">{name}</p>
              <p className="text-sm text-muted-foreground">{code}</p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={downloadCode}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button variant="outline" className="flex-1" onClick={printCode}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
