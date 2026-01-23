import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, QrCode, ArrowUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Home', href: '/' },
  { icon: Package, label: 'Items', href: '/items' },
  { icon: QrCode, label: 'Scan', href: '/scan' },
  { icon: ArrowUpDown, label: 'Stock', href: '/stock' },
];

interface MobileBottomNavProps {
  onSearchClick?: () => void;
}

export function MobileBottomNav({ onSearchClick }: MobileBottomNavProps) {
  const location = useLocation();
  const isMobile = useIsMobile();

  if (!isMobile) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 w-16 h-full rounded-lg transition-colors',
                'active:scale-95 touch-manipulation',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        
        {/* Search button */}
        <button
          onClick={onSearchClick}
          className={cn(
            'flex flex-col items-center justify-center gap-1 w-16 h-full rounded-lg transition-colors',
            'active:scale-95 touch-manipulation',
            'text-muted-foreground hover:text-foreground'
          )}
        >
          <Search className="h-5 w-5" />
          <span className="text-[10px] font-medium">Search</span>
        </button>
      </div>
    </nav>
  );
}
