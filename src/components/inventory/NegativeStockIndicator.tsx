import React from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface NegativeStockIndicatorProps {
  currentStock: number;
  minimumStock?: number;
  lastTransaction?: {
    performedBy?: string;
    createdAt?: string;
    notes?: string;
    transactionType?: string;
    quantity?: number;
  } | null;
  showBadge?: boolean;
  className?: string;
}

export function NegativeStockIndicator({
  currentStock,
  minimumStock = 0,
  lastTransaction,
  showBadge = true,
  className,
}: NegativeStockIndicatorProps) {
  const isNegative = currentStock < 0;
  const isLow = currentStock > 0 && currentStock <= minimumStock;
  const isZero = currentStock === 0;

  if (!isNegative && !isLow && !isZero) {
    return (
      <span className={cn('font-medium text-foreground', className)}>
        {currentStock}
      </span>
    );
  }

  const getStockStatus = () => {
    if (isNegative) return { label: 'Negative', variant: 'destructive' as const, icon: TrendingDown };
    if (isZero) return { label: 'Out of Stock', variant: 'secondary' as const, icon: AlertTriangle };
    if (isLow) return { label: 'Low Stock', variant: 'warning' as const, icon: AlertTriangle };
    return { label: 'In Stock', variant: 'default' as const, icon: null };
  };

  const status = getStockStatus();
  const Icon = status.icon;

  const tooltipContent = isNegative && lastTransaction ? (
    <div className="space-y-1 text-sm max-w-xs">
      <p className="font-semibold text-destructive">Negative Stock: {currentStock}</p>
      <div className="space-y-0.5 text-muted-foreground">
        {lastTransaction.performedBy && (
          <p><span className="font-medium">Who:</span> {lastTransaction.performedBy}</p>
        )}
        {lastTransaction.createdAt && (
          <p><span className="font-medium">When:</span> {format(new Date(lastTransaction.createdAt), 'PPp')}</p>
        )}
        {lastTransaction.notes && (
          <p><span className="font-medium">Why:</span> {lastTransaction.notes}</p>
        )}
        {lastTransaction.transactionType && lastTransaction.quantity && (
          <p><span className="font-medium">Action:</span> {lastTransaction.transactionType} ({lastTransaction.quantity})</p>
        )}
      </div>
    </div>
  ) : (
    <p className="text-sm">
      {isNegative && 'Stock is below zero. This item has been over-issued.'}
      {isZero && 'No stock available. Restock required.'}
      {isLow && `Stock is low (${currentStock}/${minimumStock}). Consider restocking.`}
    </p>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span 
          className={cn(
            'inline-flex items-center gap-1.5 font-medium',
            isNegative && 'text-destructive',
            isZero && 'text-muted-foreground',
            isLow && 'text-warning',
            className
          )}
        >
          {Icon && <Icon className="h-4 w-4" />}
          <span className={cn(
            isNegative && 'bg-destructive/10 px-1.5 py-0.5 rounded',
          )}>
            {currentStock}
          </span>
          {showBadge && (
            <Badge variant={status.variant} className="text-xs">
              {status.label}
            </Badge>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}
