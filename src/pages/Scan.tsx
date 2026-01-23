import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode } from 'lucide-react';

export default function Scan() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Barcode Scanner</h1>
        <p className="text-muted-foreground">Scan QR codes to quickly access items</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Scanner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center text-muted-foreground">
            <QrCode className="mx-auto h-16 w-16 opacity-50" />
            <p className="mt-4">Barcode scanning coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
