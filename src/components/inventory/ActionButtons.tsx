import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type InventoryAction = 'issue' | 'return' | 'adjust' | 'consume';

interface ActionButtonsProps {
  onAction: (action: InventoryAction) => void;
  disabled?: boolean;
  activeAction?: InventoryAction | null;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'compact';
  className?: string;
}

const ACTION_CONFIG: Record<InventoryAction, {
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  description: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  shortcut: string;
}> = {
  issue: {
    label: 'Issue',
    shortLabel: 'Issue',
    icon: ArrowUpFromLine,
    description: 'Issue items to a user or project',
    variant: 'default',
    shortcut: 'I',
  },
  return: {
    label: 'Return',
    shortLabel: 'Return',
    icon: ArrowDownToLine,
    description: 'Return items back to inventory',
    variant: 'secondary',
    shortcut: 'R',
  },
  adjust: {
    label: 'Adjust',
    shortLabel: 'Adjust',
    icon: Settings2,
    description: 'Adjust stock count (correction)',
    variant: 'outline',
    shortcut: 'A',
  },
  consume: {
    label: 'Consume',
    shortLabel: 'Consume',
    icon: Trash2,
    description: 'Mark items as consumed/used up',
    variant: 'destructive',
    shortcut: 'C',
  },
};

export function ActionButtons({
  onAction,
  disabled = false,
  activeAction = null,
  size = 'default',
  variant = 'default',
  className,
}: ActionButtonsProps) {
  const actions: InventoryAction[] = ['issue', 'return', 'adjust', 'consume'];

  return (
    <div className={cn(
      'flex gap-2',
      variant === 'compact' && 'gap-1',
      className
    )}>
      {actions.map((action) => {
        const config = ACTION_CONFIG[action];
        const Icon = config.icon;
        const isActive = activeAction === action;

        return (
          <Tooltip key={action}>
            <TooltipTrigger asChild>
              <Button
                variant={isActive ? 'default' : config.variant}
                size={size}
                onClick={() => onAction(action)}
                disabled={disabled}
                className={cn(
                  'transition-all',
                  isActive && 'ring-2 ring-ring ring-offset-2',
                  variant === 'compact' && 'px-2'
                )}
              >
                <Icon className={cn(
                  'h-4 w-4',
                  variant === 'default' && 'mr-2'
                )} />
                {variant === 'default' && config.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="font-medium">{config.label}</p>
              <p className="text-xs text-muted-foreground">{config.description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Shortcut: <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">{config.shortcut}</kbd>
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/**
 * Get action configuration for a specific action
 */
export function getActionConfig(action: InventoryAction) {
  return ACTION_CONFIG[action];
}
