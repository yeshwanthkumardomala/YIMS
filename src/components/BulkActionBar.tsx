import { useState } from 'react';
import { X, Trash2, Download, FolderInput, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface BulkAction {
  id: string;
  label: string;
  icon: typeof Trash2;
  variant?: 'default' | 'destructive';
  requiresConfirmation?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
}

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onAction: (actionId: string) => Promise<void> | void;
  actions?: BulkAction[];
  className?: string;
}

const DEFAULT_ACTIONS: BulkAction[] = [
  {
    id: 'export',
    label: 'Export Selected',
    icon: Download,
  },
  {
    id: 'move',
    label: 'Move to...',
    icon: FolderInput,
  },
  {
    id: 'delete',
    label: 'Delete Selected',
    icon: Trash2,
    variant: 'destructive',
    requiresConfirmation: true,
    confirmTitle: 'Delete selected items?',
    confirmDescription: 'This action cannot be undone. The selected items will be permanently deleted.',
  },
];

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onAction,
  actions = DEFAULT_ACTIONS,
  className,
}: BulkActionBarProps) {
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const handleAction = async (action: BulkAction) => {
    if (action.requiresConfirmation) {
      setConfirmAction(action);
      return;
    }

    await executeAction(action.id);
  };

  const executeAction = async (actionId: string) => {
    setIsProcessing(true);
    try {
      await onAction(actionId);
    } finally {
      setIsProcessing(false);
      setConfirmAction(null);
    }
  };

  const primaryActions = actions.slice(0, 2);
  const moreActions = actions.slice(2);

  return (
    <>
      <div
        className={cn(
          'fixed bottom-20 left-1/2 -translate-x-1/2 z-40',
          'flex items-center gap-2 px-4 py-2.5 rounded-full',
          'bg-primary text-primary-foreground shadow-lg',
          'animate-in slide-in-from-bottom-4 fade-in duration-200',
          className
        )}
      >
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedCount} selected
        </span>

        <div className="h-4 w-px bg-primary-foreground/30" />

        <div className="flex items-center gap-1">
          {primaryActions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant={action.variant === 'destructive' ? 'destructive' : 'secondary'}
              className={cn(
                'h-8 gap-1.5',
                action.variant !== 'destructive' && 'bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0'
              )}
              onClick={() => handleAction(action)}
              disabled={isProcessing}
            >
              <action.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{action.label}</span>
            </Button>
          ))}

          {moreActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {moreActions.map((action, index) => (
                  <div key={action.id}>
                    {index > 0 && action.variant === 'destructive' && (
                      <DropdownMenuSeparator />
                    )}
                    <DropdownMenuItem
                      onClick={() => handleAction(action)}
                      className={action.variant === 'destructive' ? 'text-destructive' : ''}
                    >
                      <action.icon className="mr-2 h-4 w-4" />
                      {action.label}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="h-4 w-px bg-primary-foreground/30" />

        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-primary-foreground hover:bg-primary-foreground/20"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && executeAction(confirmAction.id)}
              disabled={isProcessing}
              className={confirmAction?.variant === 'destructive' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {isProcessing ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
