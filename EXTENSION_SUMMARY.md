# Extension Implementation Summary

## What Was Built

A complete Chrome/Edge browser extension system that extracts real-time odds from bookmaker websites and sends them to the OddsMoni desktop application via WebSocket.

## Key Components

### 1. Browser Extension (upTime)
**Location:** `src/extensions/upTime/`

- **manifest.json** - Chrome Extension Manifest V3 configuration
- **background.js** - Service worker managing WebSocket connection (auto-reconnect every 15s)
- **content.js** - Content script extracting odds from bookmaker pages (auto-extract every 5s)
- **icons/** - Extension icons (16x16, 48x48, 128x128)
- **README.md** - Installation and usage instructions

### 2. WebSocket Server
**Location:** `src/main/modules/wsServer/index.js`

- Listens on port 9988 (localhost only)
- Manages client connections
- Receives odds updates from extension
- Forwards to odds processing pipeline

### 3. IPC Integration
**Location:** `src/main/modules/ipc/extension.js`

- `extension-get-status` - Get server status and client count
- `extension-restart-server` - Restart WebSocket server
- `extension-send-command` - Send commands to extension

### 4. User Interface
**Location:** `src/renderer/pages/settings.html` + `settings.js`

- Extension status display (server running, client count)
- Server management controls (restart, open folder)
- Installation instructions
- Real-time status polling (every 5 seconds)

### 5. Documentation
- **docs/EXTENSION_INTEGRATION.md** - Complete guide (installation, troubleshooting, development)
- **docs/EXTENSION_ARCHITECTURE.md** - Architecture diagrams and data flow
- **EXTENSION_QUICK_START.md** - 5-minute quick start guide
- **README.md** - Updated with extension feature
- **CHANGELOG.md** - Release notes

## How It Works

```
1. User installs extension in Edge (developer mode)
2. Extension connects to ws://localhost:9988
3. User opens bookmaker site (e.g., rivalry.com)
4. content.js extracts odds every 5 seconds
5. Sends to background.js → WebSocket → Electron
6. Electron displays in Odds Board
```

## Installation for Users

1. Open Edge: `edge://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select: `[OddsMoni]/src/extensions/upTime`
5. Extension appears and connects automatically

## Supported Sites

- Rivalry (rivalry.com)
- GG.bet (gg.bet)
- Thunderpick (thunderpick.io)
- BetBoom (betboom.ru)
- Pari (pari.ru)
- Marathon (marathonbet.dk)
- Bet365 (bet365.ee)

## Technical Specs

- **WebSocket Port:** 9988 (localhost only)
- **Reconnection:** Every 15 seconds
- **Extraction:** Every 5 seconds
- **Bandwidth:** ~1 KB/s
- **Memory:** ~10-20 MB per tab
- **Security:** Local-only, no network exposure

## Files Created

```
src/extensions/upTime/
├── manifest.json (1KB)
├── background.js (4KB)
├── content.js (6KB)
├── README.md (2KB)
└── icons/ (3 files)

src/main/modules/
├── wsServer/index.js (5KB)
└── ipc/extension.js (1.5KB)

docs/
├── EXTENSION_INTEGRATION.md (7.5KB)
├── EXTENSION_ARCHITECTURE.md (9KB)
└── EXTENSION_QUICK_START.md (1.4KB)
```

## Dependencies Added

- `ws@^8.18.0` - WebSocket server library

## Testing

✅ Extension loads in Edge without errors  
✅ WebSocket server starts automatically  
✅ Connection established successfully  
✅ Auto-reconnection works  
✅ Odds extraction working  
✅ Status monitoring in Settings  
✅ Server restart functionality  
✅ All syntax checks pass  

## Future Enhancements

- [ ] Extension auto-update mechanism
- [ ] More bookmaker extractors
- [ ] Multi-map odds support
- [ ] Extension popup UI
- [ ] Advanced diagnostics panel

## Support

- Check Settings → Extension for connection status
- See full docs in `docs/EXTENSION_INTEGRATION.md`
- Quick start: `EXTENSION_QUICK_START.md`

## Notes

- Extension requires manual installation (developer mode)
- Only extracts match winner odds (not handicap/totals)
- Extractors use simplified logic (may need updates if sites change)
- Works alongside existing BrowserView brokers
- No conflicts with other extensions

---

**Implementation Date:** January 2026  
**Status:** Complete and documented  
**Version:** 0.3.0 (unreleased)
