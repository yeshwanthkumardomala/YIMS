import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Download,
  Upload,
  FileJson,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Database,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  downloadExportFile,
  importData,
  getRecordCounts,
  type ExportData,
} from '@/lib/offlineDataUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function FullBackupSection() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    counts: { categories: number; locations: number; items: number; itemVariants: number; stockTransactions: number };
    error?: string;
  } | null>(null);
  const [currentCounts, setCurrentCounts] = useState<{
    categories: number;
    locations: number;
    items: number;
    itemVariants: number;
    stockTransactions: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadExportFile();
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file');
      return;
    }

    setSelectedFile(file);
    setImportResult(null);

    // Load current counts for comparison
    try {
      const counts = await getRecordCounts();
      setCurrentCounts(counts);
    } catch {
      // Ignore
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setImportResult(null);

    try {
      const result = await importData(selectedFile, importMode);
      setImportResult(result);

      if (result.success) {
        toast.success(`Imported ${result.counts.items} items, ${result.counts.categories} categories, ${result.counts.locations} locations`);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        toast.error(result.error || 'Import failed');
      }
    } catch (error) {
      toast.error('Failed to import data');
      setImportResult({
        success: false,
        counts: { categories: 0, locations: 0, items: 0, itemVariants: 0, stockTransactions: 0 },
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setImporting(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Full Backup
        </CardTitle>
        <CardDescription>
          Export or import all your inventory data as a single JSON file for backup or transfer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Export Section */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Data
            </h3>
            <p className="text-sm text-muted-foreground">
              Download all your inventory data (items, categories, locations, transactions) as a JSON backup file.
            </p>
            <Button onClick={handleExport} disabled={exporting} className="w-full">
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileJson className="mr-2 h-4 w-4" />
              )}
              {exporting ? 'Exporting...' : 'Export All Data'}
            </Button>
          </div>

          {/* Import Section */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import Data
            </h3>
            <p className="text-sm text-muted-foreground">
              Restore data from a previously exported JSON backup file.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!selectedFile ? (
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                Select Backup File
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <Label>Import Mode</Label>
                  <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as 'merge' | 'replace')}>
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="merge" id="merge" />
                      <div className="grid gap-1 leading-none">
                        <Label htmlFor="merge" className="font-normal cursor-pointer">
                          Merge with existing data
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Add new records, skip duplicates
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="replace" id="replace" />
                      <div className="grid gap-1 leading-none">
                        <Label htmlFor="replace" className="font-normal cursor-pointer">
                          Replace all data
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Delete existing data and import fresh
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {importMode === 'replace' && currentCounts && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>
                      This will delete {currentCounts.items} items, {currentCounts.categories} categories,
                      {currentCounts.locations} locations, and {currentCounts.stockTransactions} transactions.
                    </AlertDescription>
                  </Alert>
                )}

                {importMode === 'replace' ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full" disabled={importing}>
                        {importing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        {importing ? 'Importing...' : 'Import & Replace'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Replace all data?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all existing offline data and replace it with the imported data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleImport}>
                          Yes, Replace All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button className="w-full" onClick={handleImport} disabled={importing}>
                    {importing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {importing ? 'Importing...' : 'Import Data'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Import Result */}
        {importResult && (
          <Alert variant={importResult.success ? 'default' : 'destructive'}>
            {importResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertTitle>{importResult.success ? 'Import Successful' : 'Import Failed'}</AlertTitle>
            <AlertDescription>
              {importResult.success ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{importResult.counts.items} items</Badge>
                  <Badge variant="secondary">{importResult.counts.categories} categories</Badge>
                  <Badge variant="secondary">{importResult.counts.locations} locations</Badge>
                  <Badge variant="secondary">{importResult.counts.stockTransactions} transactions</Badge>
                </div>
              ) : (
                importResult.error
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
