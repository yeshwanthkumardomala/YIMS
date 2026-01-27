
# Enable Offline ESP32 Scanner Operation

## Current Architecture Analysis

The ESP32-CAM scanner currently **requires internet** because it calls a cloud-hosted edge function:

```text
CURRENT (Requires Internet):
ESP32-CAM → WiFi → Internet → Supabase Cloud → Database
```

The web app's offline mode uses browser-based IndexedDB which the ESP32 hardware cannot access.

---

## Proposed Solution: Local Network Mode

Add a **Local Server Mode** that allows ESP32 scanners to work on a local network without internet access. This leverages the existing offline database infrastructure.

```text
PROPOSED (Works Offline):
ESP32-CAM → WiFi → Local Network → Browser App (running on any device) → IndexedDB
```

---

## Implementation Plan

### Part 1: Create Local Scan API Endpoint in Web App

Add a new component that exposes a local HTTP server capability when the app is running in Electron or as a PWA on a local machine.

**New File: `src/lib/localScanServer.ts`**
- Uses Web APIs to handle incoming scan requests
- Queries the local Dexie/IndexedDB database
- Returns item/location data to ESP32
- Works without internet

### Part 2: Add Broadcast Discovery Service

**New File: `src/components/esp32/LocalServerMode.tsx`**
- Displays the local IP address and port for ESP32 configuration
- Shows QR code with server connection info
- Toggle to enable/disable local server mode
- Status indicator showing connected ESP32 devices

### Part 3: Update Arduino Code with Dual-Mode Support

Modify the Arduino sketch to support both modes:
- **Cloud Mode**: Original behavior, connects to Supabase
- **Local Mode**: Connects to local YIMS server on the network

```cpp
// Configuration options
#define USE_LOCAL_SERVER true  // Set to false for cloud mode
const char* LOCAL_SERVER_IP = "192.168.1.100";  // Local YIMS server
const char* LOCAL_SERVER_PORT = "8080";
```

### Part 4: Add Sync Mechanism

When internet is restored:
- Local scans are queued with timestamps
- Sync to cloud database when connection available
- Merge offline scan logs with cloud data

---

## Technical Implementation Details

### Local Server Approach (Browser-Based)

Since we're using a browser-based app, we'll use a **WebSocket bridge** or **Service Worker** approach:

**Option A: Electron with Express Server**
```typescript
// In Electron main process
import express from 'express';
const app = express();

app.post('/esp32-scan', async (req, res) => {
  // Query IndexedDB via IPC
  const result = await ipcRenderer.invoke('lookup-item', req.body.code);
  res.json(result);
});

app.listen(8080);
```

**Option B: Progressive Web App with Background Sync**
- ESP32 sends scans to a local queue file
- PWA periodically polls for new scans
- Works in Electron desktop build

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/localScanServer.ts` | Create | Local HTTP server for ESP32 |
| `src/components/esp32/LocalServerMode.tsx` | Create | UI to configure local mode |
| `electron/main.ts` | Modify | Add Express server for Electron |
| `src/pages/ESP32Integration.tsx` | Modify | Add Local Mode tab |
| Arduino Sketch | Modify | Add dual-mode server selection |

---

## Arduino Sketch Changes

```cpp
// Server Mode Configuration
#define USE_LOCAL_SERVER false  // true = local, false = cloud

#if USE_LOCAL_SERVER
  const char* SERVER_URL = "http://192.168.1.100:8080/api/scan";
#else
  const char* SERVER_URL = "https://cejaafrdxajcjyutettr.supabase.co/functions/v1/esp32-scan";
#endif
```

---

## New Documentation Tab

Add a "Local Mode" tab to ESP32 Integration page explaining:
- When to use local mode (no internet, air-gapped networks)
- How to configure the ESP32 for local server
- How to find your local server IP address
- Sync behavior when internet is restored

---

## Summary

| Mode | Internet Required | Data Source | Best For |
|------|-------------------|-------------|----------|
| Cloud Mode | Yes | Supabase | Normal operation |
| Local Mode | No | IndexedDB | Air-gapped, no internet |
| Hybrid Mode | Partial | Both | Unreliable internet |

This solution ensures ESP32 scanners work even in environments with no internet access, while maintaining full sync capability when connectivity is available.
