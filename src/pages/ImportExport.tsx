import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExportSection } from '@/components/import-export/ExportSection';
import { ImportSection } from '@/components/import-export/ImportSection';
import { FullBackupSection } from '@/components/import-export/FullBackupSection';
import { FileSpreadsheet, Database } from 'lucide-react';

export default function ImportExport() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import / Export</h1>
        <p className="text-muted-foreground">Bulk data operations for inventory management</p>
      </div>

      <Tabs defaultValue="csv" className="space-y-4">
        <TabsList>
          <TabsTrigger value="csv" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            CSV Import/Export
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2">
            <Database className="h-4 w-4" />
            Full Backup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-6">
          <ExportSection />
          <ImportSection />
        </TabsContent>

        <TabsContent value="backup">
          <FullBackupSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
