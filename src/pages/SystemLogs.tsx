import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Shield,
  Search,
  Download,
  Loader2,
  ChevronDown,
  ChevronRight,
  Calendar,
  LogIn,
  LogOut,
  Package,
  MapPin,
  TrendingUp,
  TrendingDown,
  UserCheck,
  UserX,
  FileUp,
  FileDown,
  QrCode,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { downloadCSV, toCSV } from '@/lib/csvUtils';
import {
  ALL_EVENT_TYPES,
  getEventTypeLabel,
  getEventTypeBadgeVariant,
  type SystemEventType,
} from '@/lib/systemLogger';
import type { Profile } from '@/types/database';

interface SystemLogWithUser {
  id: string;
  event_type: string;
  event_description: string;
  user_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profile?: Pick<Profile, 'username' | 'full_name'> | null;
}

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

const ITEMS_PER_PAGE = 50;

const EVENT_ICONS: Record<string, typeof Shield> = {
  login_success: LogIn,
  login_failed: LogIn,
  logout: LogOut,
  signup: UserCheck,
  item_created: Package,
  item_updated: Package,
  item_deleted: Package,
  location_created: MapPin,
  location_updated: MapPin,
  location_deleted: MapPin,
  stock_in: TrendingUp,
  stock_out: TrendingDown,
  stock_adjustment: RefreshCw,
  role_changed: Shield,
  user_activated: UserCheck,
  user_deactivated: UserX,
  import_completed: FileUp,
  export_completed: FileDown,
  scan_performed: QrCode,
  error: AlertTriangle,
};

export default function SystemLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7days');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Calculate date range bounds
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case '7days':
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case '30days':
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      default:
        return null;
    }
  }, [dateRange]);

  // Fetch logs with user info
  const { data: logsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['system-logs', eventTypeFilter, dateRangeBounds],
    queryFn: async () => {
      let query = supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply event type filter
      if (eventTypeFilter !== 'all') {
        query = query.eq('event_type', eventTypeFilter);
      }

      // Apply date range filter
      if (dateRangeBounds) {
        query = query
          .gte('created_at', dateRangeBounds.start.toISOString())
          .lte('created_at', dateRangeBounds.end.toISOString());
      }

      const { data: logs, error: logsError } = await query;
      if (logsError) throw logsError;

      // Get unique user IDs
      const userIds = [...new Set((logs || []).map((log) => log.user_id).filter(Boolean))];

      // Fetch profiles for those users
      let profiles: Pick<Profile, 'user_id' | 'username' | 'full_name'>[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, username, full_name')
          .in('user_id', userIds as string[]);
        profiles = profilesData || [];
      }

      // Combine logs with profiles
      const logsWithUsers: SystemLogWithUser[] = (logs || []).map((log) => {
        const profile = profiles.find((p) => p.user_id === log.user_id);
        return {
          id: log.id,
          event_type: log.event_type,
          event_description: log.event_description,
          user_id: log.user_id,
          ip_address: log.ip_address,
          metadata: log.metadata as Record<string, unknown> | null,
          created_at: log.created_at,
          profile: profile ? { username: profile.username, full_name: profile.full_name } : null,
        };
      });

      return logsWithUsers;
    },
  });

  // Filter by search query
  const filteredLogs = useMemo(() => {
    if (!logsData) return [];
    if (!searchQuery.trim()) return logsData;

    const query = searchQuery.toLowerCase();
    return logsData.filter(
      (log) =>
        log.event_description.toLowerCase().includes(query) ||
        log.event_type.toLowerCase().includes(query) ||
        log.profile?.username?.toLowerCase().includes(query) ||
        log.profile?.full_name?.toLowerCase().includes(query)
    );
  }, [logsData, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to first page when filters change
  const handleFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  // Toggle row expansion for metadata
  const toggleRowExpansion = (logId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  // Export logs to CSV
  const handleExportCSV = () => {
    if (!filteredLogs.length) return;

    const columns = [
      { key: 'Timestamp' as const, label: 'Timestamp' },
      { key: 'EventType' as const, label: 'Event Type' },
      { key: 'Description' as const, label: 'Description' },
      { key: 'User' as const, label: 'User' },
      { key: 'IPAddress' as const, label: 'IP Address' },
      { key: 'Metadata' as const, label: 'Metadata' },
    ];
    
    const csvData = filteredLogs.map((log) => ({
      Timestamp: format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      EventType: getEventTypeLabel(log.event_type),
      Description: log.event_description,
      User: log.profile?.username || 'System',
      IPAddress: log.ip_address || '-',
      Metadata: log.metadata ? JSON.stringify(log.metadata) : '-',
    }));

    const csv = toCSV(csvData, columns);
    downloadCSV(csv, `system-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  // Get icon for event type
  const getEventIcon = (eventType: string) => {
    const IconComponent = EVENT_ICONS[eventType] || Shield;
    return <IconComponent className="h-4 w-4" />;
  };

  // Calculate stats
  const stats = useMemo(() => {
    if (!logsData) return { total: 0, logins: 0, stockMoves: 0, errors: 0 };
    return {
      total: logsData.length,
      logins: logsData.filter((l) => l.event_type === 'login_success').length,
      stockMoves: logsData.filter((l) => ['stock_in', 'stock_out', 'stock_adjustment'].includes(l.event_type)).length,
      errors: logsData.filter((l) => l.event_type === 'error' || l.event_type === 'login_failed').length,
    };
  }, [logsData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
        <p className="text-muted-foreground">View audit trail and system events</p>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.logins}</p>
                <p className="text-sm text-muted-foreground">Logins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.stockMoves}</p>
                <p className="text-sm text-muted-foreground">Stock Movements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{stats.errors}</p>
                <p className="text-sm text-muted-foreground">Errors/Failures</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Logs Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Audit Logs
            </CardTitle>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>

              <Select value={eventTypeFilter} onValueChange={handleFilterChange(setEventTypeFilter)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {ALL_EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getEventTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={handleFilterChange(setDateRange)}>
                <SelectTrigger className="w-36">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>

              <Button variant="outline" onClick={handleExportCSV} disabled={!filteredLogs.length}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedLogs.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => {
                      const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
                      const isExpanded = expandedRows.has(log.id);

                      return (
                        <Collapsible key={log.id} open={isExpanded} asChild>
                          <>
                            <TableRow className={hasMetadata ? 'cursor-pointer hover:bg-muted/50' : ''}>
                              <TableCell>
                                {hasMetadata && (
                                  <CollapsibleTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => toggleRowExpansion(log.id)}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </CollapsibleTrigger>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={getEventTypeBadgeVariant(log.event_type)}
                                  className="flex w-fit items-center gap-1"
                                >
                                  {getEventIcon(log.event_type)}
                                  {getEventTypeLabel(log.event_type)}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {log.event_description}
                              </TableCell>
                              <TableCell>
                                {log.profile ? (
                                  <span className="font-medium">{log.profile.username}</span>
                                ) : (
                                  <span className="text-muted-foreground">System</span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {log.ip_address || '-'}
                              </TableCell>
                            </TableRow>
                            {hasMetadata && (
                              <CollapsibleContent asChild>
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={6} className="py-3">
                                    <div className="rounded-md bg-muted p-3">
                                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                                        Metadata
                                      </p>
                                      <pre className="overflow-x-auto text-xs">
                                        {JSON.stringify(log.metadata, null, 2)}
                                      </pre>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </CollapsibleContent>
                            )}
                          </>
                        </Collapsible>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length}{' '}
                    logs
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => setCurrentPage(pageNum)}
                              isActive={currentPage === pageNum}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Shield className="mx-auto h-16 w-16 opacity-50" />
              <p className="mt-4">No logs found</p>
              <p className="text-sm">
                {searchQuery || eventTypeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'System events will appear here'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
