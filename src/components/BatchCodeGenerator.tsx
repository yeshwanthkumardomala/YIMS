import { useState, useRef, useMemo, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Download, Printer, QrCode, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface LabelItem {
  id: string;
  code: string;
  name: string;
}

interface BatchCodeGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LabelItem[];
  title?: string;
}

type CodeType = 'qr' | 'barcode';
type LabelSize = 'small' | 'medium' | 'large';
type LabelsPerRow = 2 | 3 | 4;

const LABEL_SIZES: Record<LabelSize, { width: number; height: number; qrSize: number; barcodeHeight: number }> = {
  small: { width: 150, height: 100, qrSize: 60, barcodeHeight: 40 },
  medium: { width: 200, height: 140, qrSize: 80, barcodeHeight: 50 },
  large: { width: 280, height: 180, qrSize: 120, barcodeHeight: 70 },
};

export function BatchCodeGenerator({ open, onOpenChange, items, title = 'Batch Print Labels' }: BatchCodeGeneratorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(items.map(i => i.id)));
  const [codeType, setCodeType] = useState<CodeType>('qr');
  const [labelSize, setLabelSize] = useState<LabelSize>('medium');
  const [labelsPerRow, setLabelsPerRow] = useState<LabelsPerRow>(3);
  const [includeName, setIncludeName] = useState(true);
  const [includeCode, setIncludeCode] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const selectedItems = useMemo(() => 
    items.filter(item => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  const toggleItem = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => setSelectedIds(new Set(items.map(i => i.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const generateSingleLabel = async (item: LabelItem): Promise<Blob> => {
    const size = LABEL_SIZES[labelSize];
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d')!;

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size.width, size.height);

    // Create temporary element for code
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    try {
      let codeSvg: SVGElement;
      
      if (codeType === 'qr') {
        const container = document.createElement('div');
        tempDiv.appendChild(container);
        const { createRoot } = await import('react-dom/client');
        const root = createRoot(container);
        await new Promise<void>((resolve) => {
          root.render(<QRCodeSVG value={item.code} size={size.qrSize} />);
          setTimeout(resolve, 100);
        });
        codeSvg = container.querySelector('svg')!;
        root.unmount();
      } else {
        const container = document.createElement('div');
        tempDiv.appendChild(container);
        const { createRoot } = await import('react-dom/client');
        const root = createRoot(container);
        await new Promise<void>((resolve) => {
          root.render(
            <Barcode 
              value={item.code} 
              height={size.barcodeHeight} 
              width={1} 
              displayValue={false}
              margin={0}
            />
          );
          setTimeout(resolve, 100);
        });
        codeSvg = container.querySelector('svg')!;
        root.unmount();
      }

      // Convert SVG to image
      const svgData = new XMLSerializer().serializeToString(codeSvg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = svgUrl;
      });

      // Draw code centered
      const codeX = (size.width - img.width) / 2;
      let codeY = 10;
      ctx.drawImage(img, codeX, codeY);

      URL.revokeObjectURL(svgUrl);

      // Draw text
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';

      let textY = codeY + (codeType === 'qr' ? size.qrSize : size.barcodeHeight) + 15;

      if (includeName) {
        ctx.font = 'bold 12px Arial';
        const name = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
        ctx.fillText(name, size.width / 2, textY);
        textY += 16;
      }

      if (includeCode) {
        ctx.font = '10px monospace';
        ctx.fillText(item.code, size.width / 2, textY);
      }

    } finally {
      document.body.removeChild(tempDiv);
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });
  };

  const handleDownloadZip = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    setIsGenerating(true);
    try {
      const zip = new JSZip();
      
      for (const item of selectedItems) {
        const blob = await generateSingleLabel(item);
        const safeName = item.name.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        zip.file(`${safeName}_${item.code}.png`, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `labels_${new Date().toISOString().split('T')[0]}.zip`);
      toast.success(`Downloaded ${selectedItems.length} labels`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to generate labels');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = useCallback(() => {
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }

    const size = LABEL_SIZES[labelSize];
    const gridCols = labelsPerRow;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Labels</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; }
            .grid { 
              display: grid; 
              grid-template-columns: repeat(${gridCols}, ${size.width}px);
              gap: 8px;
              padding: 16px;
            }
            .label {
              width: ${size.width}px;
              height: ${size.height}px;
              border: 1px solid #ccc;
              padding: 8px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              page-break-inside: avoid;
            }
            .code-container { margin-bottom: 8px; }
            .name { font-weight: bold; font-size: 12px; text-align: center; margin-bottom: 4px; }
            .code { font-family: monospace; font-size: 10px; color: #666; }
            @media print {
              .label { border: 1px dashed #ccc; }
            }
          </style>
        </head>
        <body>
          <div class="grid" id="labels"></div>
          <script src="https://unpkg.com/qrcode-generator@1.4.4/qrcode.min.js"></script>
          <script>
            const items = ${JSON.stringify(selectedItems)};
            const codeType = '${codeType}';
            const includeName = ${includeName};
            const includeCode = ${includeCode};
            const qrSize = ${size.qrSize};
            
            const container = document.getElementById('labels');
            
            items.forEach(item => {
              const label = document.createElement('div');
              label.className = 'label';
              
              const codeContainer = document.createElement('div');
              codeContainer.className = 'code-container';
              
              if (codeType === 'qr') {
                const qr = qrcode(0, 'M');
                qr.addData(item.code);
                qr.make();
                codeContainer.innerHTML = qr.createSvgTag({ cellSize: 3, margin: 0 });
              } else {
                codeContainer.innerHTML = '<div style="font-family: libre barcode 128; font-size: 40px;">' + item.code + '</div>';
              }
              
              label.appendChild(codeContainer);
              
              if (includeName) {
                const name = document.createElement('div');
                name.className = 'name';
                name.textContent = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
                label.appendChild(name);
              }
              
              if (includeCode) {
                const code = document.createElement('div');
                code.className = 'code';
                code.textContent = item.code;
                label.appendChild(code);
              }
              
              container.appendChild(label);
            });
            
            setTimeout(() => window.print(), 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [selectedItems, codeType, labelSize, labelsPerRow, includeName, includeCode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Select items and customize labels for batch printing or download
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left: Item Selection */}
          <div className="w-1/3 border rounded-lg flex flex-col">
            <div className="p-3 border-b bg-muted/50">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">
                  {selectedIds.size} of {items.length} selected
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={selectAll}>All</Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>None</Button>
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {items.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.code}</p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right: Settings & Preview */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label>Code Type</Label>
                <Tabs value={codeType} onValueChange={(v) => setCodeType(v as CodeType)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="qr" className="flex-1">
                      <QrCode className="h-4 w-4 mr-2" />
                      QR Code
                    </TabsTrigger>
                    <TabsTrigger value="barcode" className="flex-1">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Barcode
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-3">
                <Label>Label Size</Label>
                <RadioGroup
                  value={labelSize}
                  onValueChange={(v) => setLabelSize(v as LabelSize)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="small" id="small" />
                    <Label htmlFor="small">Small</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="medium" />
                    <Label htmlFor="medium">Medium</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="large" id="large" />
                    <Label htmlFor="large">Large</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Labels Per Row (Print)</Label>
                <RadioGroup
                  value={labelsPerRow.toString()}
                  onValueChange={(v) => setLabelsPerRow(parseInt(v) as LabelsPerRow)}
                  className="flex gap-4"
                >
                  {[2, 3, 4].map((n) => (
                    <div key={n} className="flex items-center space-x-2">
                      <RadioGroupItem value={n.toString()} id={`row-${n}`} />
                      <Label htmlFor={`row-${n}`}>{n}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Include</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <Checkbox checked={includeName} onCheckedChange={(c) => setIncludeName(!!c)} />
                    <span className="text-sm">Name</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox checked={includeCode} onCheckedChange={(c) => setIncludeCode(!!c)} />
                    <span className="text-sm">Code</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="flex-1 border rounded-lg p-4 bg-muted/30 overflow-auto">
              <Label className="mb-2 block">Preview ({selectedItems.length} labels)</Label>
              <div 
                className="flex flex-wrap gap-2"
                style={{ maxHeight: '200px' }}
              >
                {selectedItems.slice(0, 6).map((item) => {
                  const size = LABEL_SIZES[labelSize];
                  return (
                    <div
                      key={item.id}
                      className="bg-white border rounded p-2 flex flex-col items-center"
                      style={{ width: size.width * 0.6, height: size.height * 0.6 }}
                    >
                      {codeType === 'qr' ? (
                        <QRCodeSVG value={item.code} size={size.qrSize * 0.5} />
                      ) : (
                        <Barcode 
                          value={item.code} 
                          height={size.barcodeHeight * 0.5} 
                          width={0.8} 
                          displayValue={false}
                          margin={0}
                        />
                      )}
                      {includeName && (
                        <p className="text-[8px] font-medium mt-1 text-center truncate w-full">
                          {item.name}
                        </p>
                      )}
                      {includeCode && (
                        <p className="text-[6px] text-muted-foreground font-mono">
                          {item.code}
                        </p>
                      )}
                    </div>
                  );
                })}
                {selectedItems.length > 6 && (
                  <div className="flex items-center justify-center text-sm text-muted-foreground">
                    +{selectedItems.length - 6} more
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadZip}
                disabled={isGenerating || selectedIds.size === 0}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download ZIP
              </Button>
              <Button onClick={handlePrint} disabled={selectedIds.size === 0}>
                <Printer className="h-4 w-4 mr-2" />
                Print Labels
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
