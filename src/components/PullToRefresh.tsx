import { useState, useCallback, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  disabled = false,
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const threshold = 80;
  const maxPull = 120;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const scrollTop = (e.currentTarget as HTMLElement).scrollTop;
    if (scrollTop === 0) {
      setIsPulling(true);
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;

    const touch = e.touches[0];
    const startY = (e.currentTarget as HTMLElement).dataset.startY;
    
    if (!startY) {
      (e.currentTarget as HTMLElement).dataset.startY = String(touch.clientY);
      return;
    }

    const currentY = touch.clientY;
    const diff = currentY - Number(startY);

    if (diff > 0) {
      e.preventDefault();
      setPullDistance(Math.min(diff * 0.5, maxPull));
    }
  }, [isPulling, disabled, isRefreshing]);

  const handleTouchEnd = useCallback(async (e: React.TouchEvent) => {
    if (!isPulling || disabled) return;

    (e.currentTarget as HTMLElement).dataset.startY = '';
    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh, disabled]);

  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <div
      className={cn('relative overflow-auto', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-opacity',
          'pointer-events-none z-10',
          pullDistance > 0 ? 'opacity-100' : 'opacity-0'
        )}
        style={{ top: pullDistance - 40 }}
      >
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-full bg-background border shadow-sm',
            isRefreshing && 'animate-spin'
          )}
          style={{
            transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
          }}
        >
          <RefreshCw className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
