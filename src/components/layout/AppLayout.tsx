import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Package,
  Tags,
  MapPin,
  ArrowUpDown,
  QrCode,
  History,
  Settings,
  Users,
  LogOut,
  Moon,
  Sun,
  FileSpreadsheet,
  Shield,
  FileText,
  CheckSquare,
  Info,
  BookOpen,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { InstallPrompt } from '@/components/InstallPrompt';
import { Badge } from '@/components/ui/badge';
import { QuickAddToolbar } from '@/components/QuickAddToolbar';
import { useSettings } from '@/hooks/useSettings';

interface AppLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/', roles: ['admin', 'operator', 'student'] },
  { icon: Package, label: 'Items', href: '/items', roles: ['admin', 'operator', 'student'] },
  { icon: Tags, label: 'Categories', href: '/categories', roles: ['admin', 'operator', 'student'] },
  { icon: MapPin, label: 'Locations', href: '/locations', roles: ['admin', 'operator', 'student'] },
  { icon: ArrowUpDown, label: 'Stock Operations', href: '/stock', roles: ['admin', 'operator', 'student'] },
  { icon: QrCode, label: 'Scan', href: '/scan', roles: ['admin', 'operator', 'student'] },
  { icon: History, label: 'History', href: '/history', roles: ['admin', 'operator', 'student'] },
];

const adminItems = [
  { icon: FileSpreadsheet, label: 'Import/Export', href: '/import-export', roles: ['admin'] },
  { icon: FileText, label: 'Reports', href: '/reports', roles: ['admin'] },
  { icon: CheckSquare, label: 'Approvals', href: '/approvals', roles: ['admin'] },
  { icon: Users, label: 'Users', href: '/users', roles: ['admin'] },
  { icon: Shield, label: 'System Logs', href: '/logs', roles: ['admin'] },
  { icon: Settings, label: 'Settings', href: '/settings', roles: ['admin'] },
];

const helpItems = [
  { icon: BookOpen, label: 'How to Use', href: '/how-to-use' },
  { icon: Info, label: 'About', href: '/about' },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, role, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const settings = useSettings();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string | null, username: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return username.slice(0, 2).toUpperCase();
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'admin':
        return 'bg-destructive text-destructive-foreground';
      case 'operator':
        return 'bg-primary text-primary-foreground';
      case 'student':
        return 'bg-secondary text-secondary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border p-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold">
                Y
              </div>
              <span className="text-lg font-semibold">YIMS</span>
            </Link>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems
                    .filter((item) => !role || item.roles.includes(role))
                    .map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === item.href}
                          tooltip={item.label}
                        >
                          <Link to={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminItems.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === item.href}
                          tooltip={item.label}
                        >
                          <Link to={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            <SidebarGroup>
              <SidebarGroupLabel>Help</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {helpItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === item.href}
                        tooltip={item.label}
                      >
                        <Link to={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-4 space-y-3">
            <InstallPrompt />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                      {getInitials(profile?.full_name || null, profile?.username || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium">{profile?.username}</span>
                    <Badge variant="secondary" className={`text-[10px] ${getRoleBadgeColor(role)}`}>
                      {role}
                    </Badge>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  {profile?.full_name || profile?.username}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? (
                    <>
                      <Sun className="mr-2 h-4 w-4" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="mr-2 h-4 w-4" />
                      Dark Mode
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <OfflineIndicator />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
          {settings.showQuickAddToolbar && <QuickAddToolbar />}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
