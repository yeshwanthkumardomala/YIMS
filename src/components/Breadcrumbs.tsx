import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const ROUTE_LABELS: Record<string, string> = {
  '': 'Dashboard',
  'items': 'Items',
  'categories': 'Categories',
  'locations': 'Locations',
  'stock': 'Stock Operations',
  'scan': 'Scan',
  'history': 'History',
  'import-export': 'Import/Export',
  'users': 'Users',
  'logs': 'System Logs',
  'settings': 'Settings',
  'reports': 'Reports',
  'approvals': 'Approvals',
  'about': 'About',
  'how-to-use': 'How to Use',
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Don't show breadcrumbs on dashboard
  if (pathSegments.length === 0) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Home className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Home</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {pathSegments.map((segment, index) => {
          const path = '/' + pathSegments.slice(0, index + 1).join('/');
          const isLast = index === pathSegments.length - 1;
          const label = ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

          return (
            <BreadcrumbItem key={path}>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5" />
              </BreadcrumbSeparator>
              {isLast ? (
                <BreadcrumbPage className="font-medium">{label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={path} className="text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
