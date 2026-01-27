-- Part 1: Make scanned_by nullable to allow ESP32 device scans
ALTER TABLE scan_logs ALTER COLUMN scanned_by DROP NOT NULL;

-- Part 2: Update RLS policy for ESP32 inserts
DROP POLICY IF EXISTS "Authenticated users can insert scan logs" ON scan_logs;

CREATE POLICY "Allow scan log inserts"
  ON scan_logs FOR INSERT
  WITH CHECK (
    scanned_by = auth.uid() 
    OR scanned_by IS NULL
  );