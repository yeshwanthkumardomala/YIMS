# Building YIMS as a Desktop Application

This guide explains how to build YIMS as a standalone desktop application (.exe for Windows) after exporting from Lovable.

## Prerequisites

- Node.js 18+ installed
- Git installed
- A code editor (VS Code recommended)

## Step-by-Step Instructions

### 1. Export from Lovable

1. In Lovable, go to your project settings
2. Click "Export to GitHub"
3. Clone the repository to your local machine:

```bash
git clone <your-repo-url>
cd yims
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Install Electron Dependencies

```bash
npm install --save-dev electron electron-builder typescript
```

### 4. Add Build Scripts to package.json

Add these scripts to your `package.json`:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "npm run build && electron .",
    "electron:build": "npm run build && electron-builder --win",
    "electron:build:mac": "npm run build && electron-builder --mac",
    "electron:build:linux": "npm run build && electron-builder --linux",
    "electron:portable": "npm run build && electron-builder --win portable"
  }
}
```

### 5. Update Vite Config

In `vite.config.ts`, ensure the `base` option is set for Electron:

```typescript
export default defineConfig({
  base: './',  // Add this line for Electron file:// protocol
  // ... rest of config
});
```

### 6. Build the Application

For a portable .exe (no installation required):
```bash
npm run electron:portable
```

For an installer .exe:
```bash
npm run electron:build
```

### 7. Find Your Built App

After building, find your executable in:
- `release/<version>/YIMS-Portable-<version>.exe` (portable)
- `release/<version>/YIMS-Setup-<version>.exe` (installer)

## Distribution Options

| Type | File | How to Use |
|------|------|------------|
| Portable | `YIMS-Portable-1.0.0.exe` | Double-click to run, no installation |
| Installer | `YIMS-Setup-1.0.0.exe` | Run to install, creates Start Menu shortcut |

## Notes

- The desktop app automatically enables offline mode
- All data is stored locally in IndexedDB
- Use Export/Import to backup and transfer data between devices
- The app works completely without internet connection

## Troubleshooting

### Build fails with "cannot find module"
Run `npm install` again to ensure all dependencies are installed.

### App shows blank screen
Make sure you ran `npm run build` before `electron .`

### Icons not showing
Ensure `public/favicon.ico` exists and is a valid .ico file.

## Tech Stack

- React 18 + TypeScript
- Vite (bundler)
- Electron (desktop wrapper)
- Dexie.js (IndexedDB for offline storage)
- Tailwind CSS + shadcn/ui
