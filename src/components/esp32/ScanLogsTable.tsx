import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { supabase } from '@/integrations/supabase/client';
import { Download, Search, CheckCircle, XCircle, AlertTriangle, ListFilter } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ScanLogEntry {
  id: string;
  code_scanned: string;
  code_type: string | null;
  action_taken: string | null;
  created_at: string;
  item_id: string | null;
  location_id: string | null;
}

export function ScanLogsTable() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');

  const { data: scans, isLoading } = useQuery({
    queryKey: ['esp32-scan-logs', statusFilter, deviceFilter],
    queryFn: async () => {
      let query = supabase
        .from('scan_logs')
        .select('*')
        .like('action_taken', 'esp32_scan:%')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data, error } = await query;
      if (error) throw error;
      return data as ScanLogEntry[];
    },
  });

  // Get unique devices for filter dropdown
  const uniqueDevices = [...new Set(
    scans?.map((s) => s.action_taken?.split(':')[1] || 'unknown') || []
  )];

  const getDeviceId = (actionTaken: string | null): string => {
    if (!actionTaken) return 'unknown';
    const parts = actionTaken.split(':');
    return parts[1] || 'unknown';
  };

  const getScanStatus = (scan: ScanLogEntry): 'success' | 'warning' | 'error' => {
    if (scan.action_taken?.includes('invalid')) return 'error';
    if (!scan.code_type || scan.code_type === 'unknown') return 'error';
    if (scan.item_id || scan.location_id) return 'success';
    return 'warning';
  };

  const getStatusIcon = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  // Filter scans based on search and filters
  const filteredScans = scans?.filter((scan) => {
    const matchesSearch = searchQuery === '' || 
      scan.code_scanned.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getDeviceId(scan.action_taken).toLowerCase().includes(searchQuery.toLowerCase());
    
    const status = getScanStatus(scan);
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'success' && status === 'success') ||
      (statusFilter === 'error' && (status === 'error' || status === 'warning'));

    const deviceId = getDeviceId(scan.action_taken);
    const matchesDevice = deviceFilter === 'all' || deviceId === deviceFilter;

    return matchesSearch && matchesStatus && matchesDevice;
  }) || [];

  const exportToCSV = () => {
    if (!filteredScans.length) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Timestamp', 'Device ID', 'Code Scanned', 'Code Type', 'Status'];
    const rows = filteredScans.map((scan) => [
      format(new Date(scan.created_at), 'yyyy-MM-dd HH:mm:ss'),
      getDeviceId(scan.action_taken),
      scan.code_scanned,
      scan.code_type || 'unknown',
      getScanStatus(scan),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esp32-scan-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Scan logs exported successfully');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListFilter className="h-5 w-5" />
            Scan Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ListFilter className="h-5 w-5" />
            Scan Logs
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code or device..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'success' | 'error')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deviceFilter} onValueChange={setDeviceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Device" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              {uniqueDevices.map((device) => (
                <SelectItem key={device} value={device}>
                  {device}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Status</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No scan logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredScans.map((scan) => {
                  const status = getScanStatus(scan);
                  return (
                    <TableRow key={scan.id}>
                      <TableCell>{getStatusIcon(status)}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(scan.created_at), 'MMM dd, HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getDeviceId(scan.action_taken)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">
                        {scan.code_scanned}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {scan.code_type || 'unknown'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 text-sm text-muted-foreground">
          Showing {filteredScans.length} of {scans?.length || 0} scans
        </div>
      </CardContent>
    </Card>
  );
}
