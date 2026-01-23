import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
} from 'lucide-react';
import {
  parseCSV,
  validateItemRow,
  validateLocationRow,
  validateStockRow,
  generateTemplate,
  downloadCSV,
  type CSVError,
} from '@/lib/csvUtils';
import type { LocationType, TransactionType } from '@/types/database';

type ImportType = 'items' | 'locations' | 'stock';

interface ImportState {
  file: File | null;
  parsing: boolean;
  importing: boolean;
  errors: CSVError[];
  preview: Record<string, string>[];
  result: { success: number; failed: number } | null;
}

const LOCATION_TYPES: LocationType[] = ['building', 'room', 'shelf', 'box', 'drawer'];
const TRANSACTION_TYPES: TransactionType[] = ['stock_in', 'stock_out', 'adjustment'];

export function ImportSection() {
  const [activeTab, setActiveTab] = useState<ImportType>('items');
  const [importState, setImportState] = useState<ImportState>({
    file: null,
    parsing: false,
    importing: false,
    errors: [],
    preview: [],
    result: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setImportState({
      file: null,
      parsing: false,
      importing: false,
      errors: [],
      preview: [],
      result: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleTabChange(value: string) {
    setActiveTab(value as ImportType);
    resetState();
  }

  function handleDownloadTemplate() {
    const template = generateTemplate(activeTab);
    downloadCSV(template, `yims-${activeTab}-template.csv`);
    toast.success('Template downloaded');
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportState((prev) => ({ ...prev, file, parsing: true, errors: [], preview: [], result: null }));

    try {
      const text = await file.text();
      const requiredColumns = activeTab === 'items' ? ['name'] : activeTab === 'locations' ? ['name', 'type'] : ['item code', 'type', 'quantity'];

      const { data, errors: parseErrors } = parseCSV<Record<string, string>>(text, requiredColumns);

      if (parseErrors.length > 0) {
        setImportState((prev) => ({ ...prev, parsing: false, errors: parseErrors }));
        return;
      }

      // Validate rows
      const validationErrors = await validateRows(data, activeTab);

      setImportState((prev) => ({
        ...prev,
        parsing: false,
        preview: data.slice(0, 10),
        errors: validationErrors,
      }));
    } catch (error) {
      console.error('File parse error:', error);
      setImportState((prev) => ({
        ...prev,
        parsing: false,
        errors: [{ row: 0, message: 'Failed to parse CSV file' }],
      }));
    }
  }

  async function validateRows(
    data: Record<string, string>[],
    type: ImportType
  ): Promise<CSVError[]> {
    const errors: CSVError[] = [];

    if (type === 'items') {
      // Fetch categories and locations for validation
      const [categoriesRes, locationsRes] = await Promise.all([
        supabase.from('categories').select('name'),
        supabase.from('locations').select('name').eq('is_active', true),
      ]);

      const categoryNames = new Set(
        (categoriesRes.data || []).map((c) => c.name.toLowerCase())
      );
      const locationNames = new Set(
        (locationsRes.data || []).map((l) => l.name.toLowerCase())
      );

      data.forEach((row, index) => {
        errors.push(...validateItemRow(row, index + 2, categoryNames, locationNames));
      });
    } else if (type === 'locations') {
      const { data: existingLocs } = await supabase
        .from('locations')
        .select('name')
        .eq('is_active', true);

      const existingNames = new Set(
        (existingLocs || []).map((l) => l.name.toLowerCase())
      );

      // Add names from current import for parent validation
      data.forEach((row) => {
        if (row.name) existingNames.add(row.name.toLowerCase());
      });

      data.forEach((row, index) => {
        errors.push(...validateLocationRow(row, index + 2, existingNames, LOCATION_TYPES));
      });
    } else if (type === 'stock') {
      const { data: items } = await supabase.from('items').select('code').eq('is_active', true);

      const itemCodes = new Set((items || []).map((i) => i.code));

      data.forEach((row, index) => {
        errors.push(...validateStockRow(row, index + 2, itemCodes, TRANSACTION_TYPES));
      });
    }

    return errors;
  }

  async function handleImport() {
    if (!importState.file || importState.errors.length > 0) return;

    setImportState((prev) => ({ ...prev, importing: true }));

    try {
      const text = await importState.file.text();
      const { data } = parseCSV<Record<string, string>>(text, []);

      let success = 0;
      let failed = 0;
      const importErrors: CSVError[] = [];

      if (activeTab === 'items') {
        const result = await importItems(data);
        success = result.success;
        failed = result.failed;
        importErrors.push(...result.errors);
      } else if (activeTab === 'locations') {
        const result = await importLocations(data);
        success = result.success;
        failed = result.failed;
        importErrors.push(...result.errors);
      } else if (activeTab === 'stock') {
        const result = await importStock(data);
        success = result.success;
        failed = result.failed;
        importErrors.push(...result.errors);
      }

      setImportState((prev) => ({
        ...prev,
        importing: false,
        result: { success, failed },
        errors: importErrors,
      }));

      if (success > 0) {
        toast.success(`Successfully imported ${success} records`);
      }
      if (failed > 0) {
        toast.error(`Failed to import ${failed} records`);
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportState((prev) => ({
        ...prev,
        importing: false,
        errors: [{ row: 0, message: 'Import failed unexpectedly' }],
      }));
      toast.error('Import failed');
    }
  }

  async function importItems(
    data: Record<string, string>[]
  ): Promise<{ success: number; failed: number; errors: CSVError[] }> {
    // Fetch lookup data
    const [categoriesRes, locationsRes] = await Promise.all([
      supabase.from('categories').select('id, name'),
      supabase.from('locations').select('id, name').eq('is_active', true),
    ]);

    const categoryMap = new Map(
      (categoriesRes.data || []).map((c) => [c.name.toLowerCase(), c.id])
    );
    const locationMap = new Map(
      (locationsRes.data || []).map((l) => [l.name.toLowerCase(), l.id])
    );

    let success = 0;
    let failed = 0;
    const errors: CSVError[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Generate code
        const { data: codeData } = await supabase.rpc('generate_item_code');

        const { error } = await supabase.from('items').insert({
          code: codeData || `YIMS:ITEM:${Date.now()}`,
          name: row.name.trim(),
          description: row.description?.trim() || null,
          category_id: row.category ? categoryMap.get(row.category.toLowerCase()) || null : null,
          location_id: row.location ? locationMap.get(row.location.toLowerCase()) || null : null,
          current_stock: parseInt(row['current stock'] || '0') || 0,
          minimum_stock: parseInt(row['minimum stock'] || '0') || 0,
          unit: row.unit?.trim() || 'pcs',
        });

        if (error) throw error;
        success++;
      } catch (error) {
        failed++;
        errors.push({ row: i + 2, message: (error as Error).message });
      }
    }

    return { success, failed, errors };
  }

  async function importLocations(
    data: Record<string, string>[]
  ): Promise<{ success: number; failed: number; errors: CSVError[] }> {
    // Fetch existing locations for parent lookup
    const { data: existingLocs } = await supabase
      .from('locations')
      .select('id, name')
      .eq('is_active', true);

    const locationMap = new Map(
      (existingLocs || []).map((l) => [l.name.toLowerCase(), l.id])
    );

    let success = 0;
    let failed = 0;
    const errors: CSVError[] = [];

    // Sort by type hierarchy to ensure parents are created first
    const typeOrder: Record<string, number> = { building: 0, room: 1, shelf: 2, box: 3, drawer: 4 };
    const sortedData = [...data].sort(
      (a, b) => (typeOrder[a.type?.toLowerCase()] ?? 99) - (typeOrder[b.type?.toLowerCase()] ?? 99)
    );

    for (let i = 0; i < sortedData.length; i++) {
      const row = sortedData[i];
      const originalIndex = data.indexOf(row);

      try {
        const locationType = row.type.toLowerCase() as LocationType;
        const { data: codeData } = await supabase.rpc('generate_location_code', {
          _type: locationType,
        });

        const parentName = row['parent location']?.toLowerCase();
        const parentId = parentName ? locationMap.get(parentName) || null : null;

        const { data: inserted, error } = await supabase
          .from('locations')
          .insert({
            code: codeData || `YIMS:${locationType.toUpperCase()}:${Date.now()}`,
            name: row.name.trim(),
            location_type: locationType,
            parent_id: parentId,
            description: row.description?.trim() || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Add to map for subsequent parent lookups
        if (inserted) {
          locationMap.set(row.name.toLowerCase(), inserted.id);
        }

        success++;
      } catch (error) {
        failed++;
        errors.push({ row: originalIndex + 2, message: (error as Error).message });
      }
    }

    return { success, failed, errors };
  }

  async function importStock(
    data: Record<string, string>[]
  ): Promise<{ success: number; failed: number; errors: CSVError[] }> {
    // Fetch items for lookup
    const { data: items } = await supabase
      .from('items')
      .select('id, code, current_stock')
      .eq('is_active', true);

    const itemMap = new Map((items || []).map((i) => [i.code, i]));

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let success = 0;
    let failed = 0;
    const errors: CSVError[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const item = itemMap.get(row['item code'].trim());
        if (!item) throw new Error('Item not found');

        const quantity = parseInt(row.quantity);
        const transactionType = row.type.toLowerCase() as TransactionType;
        const balanceBefore = item.current_stock;

        let balanceAfter = balanceBefore;
        if (transactionType === 'stock_in') {
          balanceAfter = balanceBefore + quantity;
        } else if (transactionType === 'stock_out') {
          balanceAfter = balanceBefore - quantity;
        } else if (transactionType === 'adjustment') {
          balanceAfter = quantity; // Direct set for adjustment
        }

        // Insert transaction
        const { error: txError } = await supabase.from('stock_transactions').insert({
          item_id: item.id,
          transaction_type: transactionType,
          quantity,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          notes: row.notes?.trim() || `CSV Import`,
          performed_by: user.id,
        });

        if (txError) throw txError;

        // Update item stock
        const { error: updateError } = await supabase
          .from('items')
          .update({ current_stock: balanceAfter })
          .eq('id', item.id);

        if (updateError) throw updateError;

        // Update local map
        item.current_stock = balanceAfter;

        success++;
      } catch (error) {
        failed++;
        errors.push({ row: i + 2, message: (error as Error).message });
      }
    }

    return { success, failed, errors };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Data
        </CardTitle>
        <CardDescription>Upload CSV files to bulk import inventory data</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="stock">Stock Levels</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            {/* Template Download */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
              <div>
                <p className="font-medium">Download Template</p>
                <p className="text-sm text-muted-foreground">
                  Use our template to ensure your data is formatted correctly
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Template
              </Button>
            </div>

            {/* File Upload */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importState.parsing || importState.importing}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Select CSV File
                </Button>
                {importState.file && (
                  <span className="text-sm text-muted-foreground">
                    {importState.file.name}
                  </span>
                )}
                {importState.file && (
                  <Button variant="ghost" size="sm" onClick={resetState}>
                    Clear
                  </Button>
                )}
              </div>

              {/* Parsing indicator */}
              {importState.parsing && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Parsing file...
                </div>
              )}

              {/* Errors */}
              {importState.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Validation Errors</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="h-[120px] mt-2">
                      <ul className="space-y-1 text-sm">
                        {importState.errors.slice(0, 20).map((error, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <XCircle className="h-3 w-3 flex-shrink-0" />
                            <span>
                              Row {error.row}
                              {error.column && ` (${error.column})`}: {error.message}
                            </span>
                          </li>
                        ))}
                        {importState.errors.length > 20 && (
                          <li className="text-muted-foreground">
                            ...and {importState.errors.length - 20} more errors
                          </li>
                        )}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview */}
              {importState.preview.length > 0 && importState.errors.length === 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">
                      File validated successfully
                    </span>
                    <Badge variant="secondary">{importState.preview.length} rows</Badge>
                  </div>
                  <ScrollArea className="h-[150px] rounded-md border">
                    <div className="p-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            {Object.keys(importState.preview[0] || {}).map((key) => (
                              <th key={key} className="text-left font-medium p-1 capitalize">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importState.preview.map((row, i) => (
                            <tr key={i} className="border-t">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="p-1 truncate max-w-[150px]">
                                  {val || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Import Result */}
              {importState.result && (
                <Alert variant={importState.result.failed === 0 ? 'default' : 'destructive'}>
                  {importState.result.failed === 0 ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertTitle>Import Complete</AlertTitle>
                  <AlertDescription>
                    <div className="flex gap-4 mt-1">
                      <span className="text-success font-medium">
                        {importState.result.success} successful
                      </span>
                      {importState.result.failed > 0 && (
                        <span className="text-destructive font-medium">
                          {importState.result.failed} failed
                        </span>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Import Button */}
              {importState.file && importState.errors.length === 0 && !importState.result && (
                <Button onClick={handleImport} disabled={importState.importing}>
                  {importState.importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
