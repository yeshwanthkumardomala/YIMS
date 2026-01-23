import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface VirtualColumn<T> {
  key: string;
  header: string;
  width?: string;
  className?: string;
  render: (item: T, index: number) => React.ReactNode;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: VirtualColumn<T>[];
  estimatedRowHeight?: number;
  overscan?: number;
  isLoading?: boolean;
  loadingRows?: number;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  getRowKey: (item: T) => string;
}

export function VirtualTable<T>({
  data,
  columns,
  estimatedRowHeight = 52,
  overscan = 5,
  isLoading = false,
  loadingRows = 10,
  emptyMessage = 'No data found',
  className,
  onRowClick,
  getRowKey,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan,
  });

  const handleRowClick = useCallback(
    (item: T, index: number) => {
      if (onRowClick) {
        onRowClick(item, index);
      }
    },
    [onRowClick]
  );

  if (isLoading) {
    return (
      <div className={cn('rounded-md border', className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} style={{ width: col.width }} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: loadingRows }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn('rounded-md border', className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} style={{ width: col.width }} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} style={{ width: col.width }} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      </Table>
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: 'calc(100vh - 400px)', minHeight: '400px' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <Table>
            <TableBody>
              {virtualItems.map((virtualRow) => {
                const item = data[virtualRow.index];
                return (
                  <TableRow
                    key={getRowKey(item)}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={cn(
                      onRowClick && 'cursor-pointer hover:bg-muted/50'
                    )}
                    onClick={() => handleRowClick(item, virtualRow.index)}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.key} style={{ width: col.width }} className={col.className}>
                        {col.render(item, virtualRow.index)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
