import { ExportSection } from '@/components/import-export/ExportSection';
import { ImportSection } from '@/components/import-export/ImportSection';

export default function ImportExport() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import / Export</h1>
        <p className="text-muted-foreground">Bulk data operations for inventory management</p>
      </div>

      <ExportSection />
      <ImportSection />
    </div>
  );
}
