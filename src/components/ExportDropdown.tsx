import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Printer, ChevronDown, Loader2 } from 'lucide-react';

export interface ExportDropdownProps {
  onExportCSV: () => void;
  onExportFiltered?: () => void;
  onExportExcel?: () => void;
  onPrint?: () => void;
  disabled?: boolean;
  loading?: boolean;
  filteredCount?: number;
  totalCount?: number;
  label?: string;
}

export function ExportDropdown({
  onExportCSV,
  onExportFiltered,
  onExportExcel,
  onPrint,
  disabled = false,
  loading = false,
  filteredCount,
  totalCount,
  label = 'Export',
}: ExportDropdownProps) {
  const showFilteredOption = onExportFiltered && filteredCount !== undefined && totalCount !== undefined && filteredCount < totalCount;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {label}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover">
        <DropdownMenuLabel>Export Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* CSV Options */}
        <DropdownMenuItem onClick={onExportCSV} className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4" />
          Export All (CSV)
          {totalCount !== undefined && (
            <span className="ml-auto text-xs text-muted-foreground">{totalCount}</span>
          )}
        </DropdownMenuItem>
        
        {showFilteredOption && (
          <DropdownMenuItem onClick={onExportFiltered} className="cursor-pointer">
            <FileText className="mr-2 h-4 w-4" />
            Export Filtered (CSV)
            <span className="ml-auto text-xs text-muted-foreground">{filteredCount}</span>
          </DropdownMenuItem>
        )}
        
        {/* Excel Option */}
        {onExportExcel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExportExcel} className="cursor-pointer">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export as Excel (.xlsx)
            </DropdownMenuItem>
          </>
        )}
        
        {/* Print Option */}
        {onPrint && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPrint} className="cursor-pointer">
              <Printer className="mr-2 h-4 w-4" />
              Print View
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
