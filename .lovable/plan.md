

# Fix ESP32 Scan Logging + Add Admin Dashboard

## Overview

The ESP32-CAM integration is **mostly working** but has one critical issue preventing scan logs from being saved. This plan fixes that issue and adds the admin dashboard for monitoring.

---

## Current Status

| Component | Status | Details |
|-----------|--------|---------|
| Edge Function | Working | Tested successfully, returns item data |
| Item/Location Lookup | Working | Finds items and returns full details |
| Arduino Code | Ready | Complete code in documentation |
| Documentation Page | Complete | 5 tabs with all setup info |
| **Scan Logging** | **BROKEN** | `scanned_by` is NOT NULL but ESP32 sets it to null |

---

## Part 1: Fix the Database Issue

**Problem**: The `scan_logs` table requires `scanned_by` (user ID) to be NOT NULL, but ESP32 devices don't have user context.

**Solution**: Make `scanned_by` nullable to allow device-based scans.

```sql
ALTER TABLE scan_logs ALTER COLUMN scanned_by DROP NOT NULL;
```

This is the correct approach because:
- ESP32 is a hardware device, not a logged-in user
- The `action_taken` field already stores `esp32_scan:{device_id}` for tracking
- RLS policies need updating to allow service role inserts

---

## Part 2: Update RLS Policy for ESP32 Inserts

The current RLS policy requires `scanned_by = auth.uid()`, but ESP32 uses service role key.

```sql
-- Drop existing insert policy
DROP POLICY IF EXISTS "Authenticated users can insert scan logs" ON scan_logs;

-- Create new policy that allows service role or authenticated users
CREATE POLICY "Allow scan log inserts"
  ON scan_logs FOR INSERT
  WITH CHECK (
    scanned_by = auth.uid() 
    OR scanned_by IS NULL  -- Allow ESP32 device scans
  );
```

---

## Part 3: Add Admin Dashboard Components

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/esp32/ESP32AdminDashboard.tsx` | Main admin container |
| `src/components/esp32/LiveScannerFeed.tsx` | Real-time activity feed |
| `src/components/esp32/ScannerStats.tsx` | Statistics cards |
| `src/components/esp32/ScanLogsTable.tsx` | Detailed logs with filters |

### Features

**Live Scanner Feed**
- Shows last 20 ESP32 scans
- Auto-refreshes every 10 seconds
- Color-coded by status (green/yellow/red)
- Shows device ID, code, result, time ago

**Statistics Cards**
- Total scans (today / 7 days / 30 days)
- Success rate percentage
- Active devices count
- Most active device

**Scan Logs Table**
- Full history of all ESP32 scans
- Filter by: device ID, date range, status
- Sort by any column
- Export to CSV
- Pagination (50 per page)

---

## Part 4: Update ESP32Integration.tsx

Add a 6th tab "Admin" that:
- Only shows for users with admin role
- Contains the ESP32AdminDashboard component
- Uses existing `useAuth()` hook for role check

```tsx
// In tabs list (only for admins)
{isAdmin && <TabsTrigger value="admin">Admin</TabsTrigger>}

// Tab content
<TabsContent value="admin">
  <ESP32AdminDashboard />
</TabsContent>
```

---

## Technical Implementation

### Query for ESP32 Scans

```typescript
const { data: scans } = await supabase
  .from('scan_logs')
  .select('*')
  .like('action_taken', 'esp32_scan:%')
  .order('created_at', { ascending: false })
  .limit(20);
```

### Parse Device ID from action_taken

```typescript
const deviceId = scan.action_taken?.split(':')[1] || 'unknown';
// e.g., "esp32_scan:ESP32-CAM-01" → "ESP32-CAM-01"
```

### Determine Scan Status

```typescript
// Check if code_type is valid and not 'unknown'
const isSuccess = scan.code_type && scan.code_type !== 'unknown';
const isError = !isSuccess || scan.action_taken?.includes('invalid');
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| Database Migration | **Create** | Make scanned_by nullable |
| RLS Policy Update | **Create** | Allow null scanned_by |
| `src/components/esp32/ESP32AdminDashboard.tsx` | **Create** | Admin container |
| `src/components/esp32/LiveScannerFeed.tsx` | **Create** | Live activity |
| `src/components/esp32/ScannerStats.tsx` | **Create** | Statistics |
| `src/components/esp32/ScanLogsTable.tsx` | **Create** | Logs table |
| `src/pages/ESP32Integration.tsx` | **Modify** | Add Admin tab |

---

## After Implementation

1. ESP32 scans will be properly logged to database
2. Admins can see live scanner activity
3. Admins can view statistics and trends
4. Admins can export scan logs for reporting
5. The hardware will work exactly as designed

---

## Testing Plan

1. Run migration to fix scanned_by column
2. Test edge function again with curl
3. Verify scan appears in scan_logs table
4. View Admin tab on ESP32 Integration page
5. Confirm live feed shows test scan

