import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import express from 'express';
import cors from 'cors';
import http from 'http';
import os from 'os';

let mainWindow: BrowserWindow | null = null;
let localServer: http.Server | null = null;

// Get local IP address
function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Start local ESP32 scan server
function startLocalServer(port: number = 8080) {
  if (localServer) {
    localServer.close();
  }

  const expressApp = express();
  expressApp.use(cors());
  expressApp.use(express.json());

  // ESP32 scan endpoint
  expressApp.post('/api/scan', async (req, res) => {
    const { code, device_id } = req.body;
    
    console.log(`[Local Server] Scan request: ${code} from ${device_id}`);
    
    // Send to renderer process for IndexedDB lookup
    if (mainWindow) {
      mainWindow.webContents.send('esp32-scan-request', { code, device_id });
      
      // Wait for response from renderer
      ipcMain.once('esp32-scan-response', (event, response) => {
        res.json(response);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        res.json({
          success: false,
          error: 'Lookup timeout',
          offline: true,
          timestamp: new Date().toISOString(),
        });
      }, 5000);
    } else {
      res.json({
        success: false,
        error: 'Application not ready',
        offline: true,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Health check endpoint
  expressApp.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      mode: 'local',
      ip: getLocalIpAddress(),
      port,
    });
  });

  localServer = expressApp.listen(port, '0.0.0.0', () => {
    console.log(`[YIMS] Local ESP32 server running at http://${getLocalIpAddress()}:${port}`);
  });

  return { ip: getLocalIpAddress(), port };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '../public/favicon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the built React app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle('get-local-ip', () => getLocalIpAddress());

ipcMain.handle('start-local-server', (event, port: number) => {
  return startLocalServer(port);
});

ipcMain.handle('stop-local-server', () => {
  if (localServer) {
    localServer.close();
    localServer = null;
    return true;
  }
  return false;
});

app.whenReady().then(() => {
  createWindow();
  
  // Auto-start local server in Electron
  startLocalServer(8080);
});

app.on('window-all-closed', () => {
  if (localServer) {
    localServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
