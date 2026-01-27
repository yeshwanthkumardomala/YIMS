

# ESP32-CAM Integration Implementation Plan

## Overview

This plan implements a complete ESP32-CAM hardware scanner integration for YIMS. The ESP32-CAM will act as a dedicated scanning station that sends scanned codes to your server via WiFi.

## Why This Will Work

The implementation uses proven patterns already in your codebase:
- Same code parsing logic as `src/pages/Scan.tsx` (lines 43-91)
- Same edge function pattern as `supabase/functions/check-low-stock/index.ts`
- Same database tables (`items`, `locations`, `scan_logs`)

---

## Implementation Steps

### Step 1: Create Edge Function

**File:** `supabase/functions/esp32-scan/index.ts`

Creates an API endpoint that receives scans from ESP32-CAM:

- Accepts POST requests with JSON: `{"code": "YIMS:ITEM:00123", "device_id": "ESP32-CAM-01"}`
- Parses YIMS code format (same logic as Scan.tsx)
- Logs scan to `scan_logs` table
- Queries `items` or `locations` table
- Returns item/location data as JSON

Key features:
- Uses CORS headers for flexibility
- Uses service role key to write to database (ESP32 can't authenticate like a user)
- Tracks device_id for audit purposes
- Returns structured response for ESP32 to process

### Step 2: Update Config

**File:** `supabase/config.toml`

Register the new edge function with `verify_jwt = false` (ESP32 can't handle JWT authentication).

### Step 3: Create Documentation Page

**File:** `src/pages/ESP32Integration.tsx`

A comprehensive guide with 6 sections:

1. **Introduction** - What ESP32-CAM is and why use it
2. **Hardware Requirements** - Parts list with prices (~₹700-1200 total)
3. **Wiring Diagram** - Visual connection guide (5V, GND, U0R, U0T, IO0)
4. **Arduino IDE Setup** - Step-by-step software installation
5. **Arduino Code** - Complete ready-to-use code with placeholders for WiFi credentials
6. **Testing & Troubleshooting** - Common issues and solutions

### Step 4: Add Route

**File:** `src/App.tsx`

Add new public route `/esp32-integration` so the documentation is accessible without login (useful for hardware setup).

### Step 5: Add Navigation

**File:** `src/components/layout/AppLayout.tsx`

Add "ESP32 Scanner" link to the Help section in the sidebar with a Cpu icon.

---

## Technical Details

### Edge Function Logic

```text
1. Receive POST request with {"code": "YIMS:ITEM:00123", "device_id": "..."}
2. Validate input (code and device_id required)
3. Parse code: split by ":" → ["YIMS", "ITEM", "00123"]
4. Determine type: item, building, room, shelf, box, drawer
5. Log to scan_logs table
6. Query appropriate table (items or locations)
7. Return JSON response with item/location data
```

### Request/Response Format

Request:
```json
{
  "code": "YIMS:ITEM:00123",
  "device_id": "ESP32-CAM-01"
}
```

Success Response:
```json
{
  "success": true,
  "type": "item",
  "data": {
    "id": "uuid",
    "name": "Laptop Charger",
    "code": "YIMS:ITEM:00123",
    "current_stock": 15,
    "minimum_stock": 5,
    "unit": "pcs",
    "location_name": "Room A-101",
    "category_name": "Electronics"
  }
}
```

Not Found Response:
```json
{
  "success": false,
  "error": "Item not found",
  "code": "YIMS:ITEM:99999"
}
```

### Arduino Code Structure

The documentation will include complete Arduino code with:
- WiFi configuration (SSID and password placeholders)
- Server URL pre-configured with your project ID
- Camera initialization for AI-Thinker ESP32-CAM
- QR code scanning using ESP32QRCodeReader library
- HTTP POST using HTTPClient library
- LED feedback (built-in flash LED)
- Serial debug output for troubleshooting

### Hardware Cost Breakdown

| Component | Approximate Cost |
|-----------|-----------------|
| ESP32-CAM AI-Thinker | 500-800 |
| FTDI Programmer | 100-200 |
| Jumper Wires | 50-100 |
| Micro USB Cable | 50-100 |
| **Total** | **700-1200** |

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/esp32-scan/index.ts` | Create | API endpoint for ESP32 |
| `supabase/config.toml` | Modify | Register new function |
| `src/pages/ESP32Integration.tsx` | Create | Documentation page |
| `src/App.tsx` | Modify | Add route |
| `src/components/layout/AppLayout.tsx` | Modify | Add navigation link |

---

## Testing the Integration

After implementation:

1. Deploy edge function (automatic)
2. Access `/esp32-integration` page in app
3. Follow hardware setup guide
4. Upload Arduino code to ESP32-CAM
5. Scan a YIMS QR code
6. Check `scan_logs` table to verify scan was recorded
7. ESP32 LED blinks to indicate success

---

## Presentation Value

This integration demonstrates:
- **IoT Integration**: Connecting physical hardware to a web application
- **REST API Design**: Creating endpoints for device communication
- **Full Stack Skills**: Frontend + Backend + Hardware
- **Real-world Application**: Practical inventory scanning solution
- **Low Cost Solution**: Professional capability at student budget

