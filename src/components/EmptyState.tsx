import { ReactNode } from 'react';
import { LucideIcon, Package, FolderOpen, MapPin, History, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
  className?: string;
  variant?: 'default' | 'compact';
}

// Preset configurations for common empty states
export const EMPTY_STATE_PRESETS = {
  items: {
    icon: Package,
    title: 'No items yet',
    description: 'Get started by adding your first inventory item. You can add items manually or import from a CSV file.',
  },
  categories: {
    icon: FolderOpen,
    title: 'No categories yet',
    description: 'Categories help you organize your inventory. Create your first category to get started.',
  },
  locations: {
    icon: MapPin,
    title: 'No locations yet',
    description: 'Locations help you track where items are stored. Add buildings, rooms, shelves, or other storage areas.',
  },
  transactions: {
    icon: History,
    title: 'No transactions yet',
    description: 'Stock transactions will appear here once you start recording stock movements.',
  },
  searchResults: {
    icon: FileText,
    title: 'No results found',
    description: 'Try adjusting your search or filter criteria to find what you\'re looking for.',
  },
} as const;

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  children,
  className,
  variant = 'default',
}: EmptyStateProps) {
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isCompact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            'rounded-full bg-muted flex items-center justify-center mb-4',
            isCompact ? 'h-12 w-12' : 'h-16 w-16'
          )}
        >
          <Icon
            className={cn(
              'text-muted-foreground',
              isCompact ? 'h-6 w-6' : 'h-8 w-8'
            )}
          />
        </div>
      )}

      <h3
        className={cn(
          'font-semibold text-foreground',
          isCompact ? 'text-base' : 'text-lg'
        )}
      >
        {title}
      </h3>

      <p
        className={cn(
          'text-muted-foreground max-w-sm mt-2',
          isCompact ? 'text-sm' : 'text-base'
        )}
      >
        {description}
      </p>

      {(action || secondaryAction || children) && (
        <div className={cn('flex flex-wrap items-center gap-3', isCompact ? 'mt-4' : 'mt-6')}>
          {action && (
            <Button onClick={action.onClick} size={isCompact ? 'sm' : 'default'}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              size={isCompact ? 'sm' : 'default'}
            >
              {secondaryAction.label}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
