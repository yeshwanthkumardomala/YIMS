import { ScannerStats } from './ScannerStats';
import { LiveScannerFeed } from './LiveScannerFeed';
import { ScanLogsTable } from './ScanLogsTable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldCheck } from 'lucide-react';

export function ESP32AdminDashboard() {
  return (
    <div className="space-y-6">
      <Alert className="border-primary/20 bg-primary/5">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Admin Dashboard</AlertTitle>
        <AlertDescription>
          Monitor ESP32 scanner activity in real-time. View scan statistics, live feed, and detailed logs.
        </AlertDescription>
      </Alert>

      {/* Statistics Cards */}
      <ScannerStats />

      {/* Live Feed and Logs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LiveScannerFeed />
        <ScanLogsTable />
      </div>
    </div>
  );
}
