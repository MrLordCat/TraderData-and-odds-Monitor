# Chrome/Edge Extension Integration Guide

## Overview

The OddsMoni application now supports real-time odds extraction via a Chrome/Edge browser extension. This allows you to capture odds directly from bookmaker websites in your browser and send them to the desktop application via WebSocket.

## Architecture

```
Browser Extension (upTime)
    ↓ [WebSocket]
Electron App (port 9988)
    ↓ [IPC]
Odds Board / Stats Panel
```

### Components

1. **Extension (src/extensions/upTime/)**
   - `manifest.json` - Extension configuration
   - `background.js` - Service worker managing WebSocket connection
   - `content.js` - Content script extracting odds from bookmaker pages
   - Auto-reconnection every 15 seconds if connection lost

2. **WebSocket Server (src/main/modules/wsServer/)**
   - Listens on port 9988
   - Receives odds updates from extension
   - Forwards to odds processing pipeline

3. **Extension IPC (src/main/modules/ipc/extension.js)**
   - Provides status information to UI
   - Allows server restart from Settings

## Installation

### Step 1: Install Extension in Edge

1. Open Microsoft Edge
2. Navigate to `edge://extensions/`
3. Enable "Developer mode" toggle (bottom-left corner)
4. Click "Load unpacked" button
5. Browse to: `[OddsMoni Install Directory]/src/extensions/upTime`
6. Click "Select Folder"
7. The upTime extension should now appear in your extensions list

### Step 2: Verify Connection

1. Start the OddsMoni desktop application
2. The WebSocket server starts automatically on port 9988
3. Open Settings in OddsMoni
4. Check the "Extension (Chrome/Edge)" section
5. Verify:
   - WebSocket Server: ✓ Running
   - Connected Clients: Should show "1" when extension is connected

### Step 3: Test Odds Extraction

1. With OddsMoni running and extension connected:
2. Open any supported bookmaker site in Edge:
   - rivalry.com
   - gg.bet
   - thunderpick.io
   - betboom.ru
   - pari.ru
   - marathonbet.dk
   - bet365.ee
3. Navigate to a live LoL match
4. The extension will automatically extract odds every 5 seconds
5. Check the Odds Board in OddsMoni - you should see odds appearing from the broker

## Supported Bookmakers

The extension includes extractors for:

- **Rivalry** (rivalry.com)
- **GG.bet** (gg.bet)
- **Thunderpick** (thunderpick.io)
- **BetBoom** (betboom.ru)
- **Pari** (pari.ru)
- **Marathon** (marathonbet.dk)
- **Bet365** (bet365.ee)

## How It Works

### Connection Flow

1. Extension loads when browser starts
2. Background service worker attempts WebSocket connection to `ws://localhost:9988`
3. If connection fails, retries every 15 seconds
4. On successful connection, sends handshake message
5. Content scripts start extracting odds from active bookmaker tabs
6. Extracted odds sent to background script → WebSocket → Electron app

### Odds Extraction

1. Content script identifies bookmaker from URL
2. Runs appropriate extractor function for that site
3. Uses DOM queries (including shadow DOM) to find odds elements
4. Extracts match winner odds (side 1, side 2)
5. Sends to background script with broker ID
6. Background script forwards via WebSocket to Electron app
7. Electron app processes and displays in Odds Board

### Data Format

Odds updates from extension follow this structure:

```javascript
{
  type: 'oddsUpdate',
  source: 'extension',
  brokerId: 'rivalry',     // Broker identifier
  odds: ['2.10', '1.75'],  // [side1, side2]
  frozen: false,           // Odds frozen/unavailable
  timestamp: 1673612345678,
  url: 'https://...'       // Source URL
}
```

## Troubleshooting

### Extension Not Connecting

**Problem**: Connected Clients shows "0" in Settings

**Solutions**:
1. Ensure OddsMoni desktop app is running
2. Check if port 9988 is blocked by firewall
3. Restart extension: 
   - Go to `edge://extensions/`
   - Toggle extension off and on
   - Or click "Reload" button
4. Check browser console (F12) for errors in extension

### No Odds Appearing

**Problem**: Extension connected but no odds in Odds Board

**Solutions**:
1. Verify you're on a supported bookmaker site
2. Navigate to a live match page (not homepage)
3. Check that match odds are visible on the page
4. Open DevTools (F12) → Console tab
5. Look for `[upTime]` log messages showing extraction attempts
6. Some sites may have changed their HTML structure - extractors may need updates

### WebSocket Server Not Starting

**Problem**: Server status shows "✗ Stopped"

**Solutions**:
1. Click "Restart Server" button in Settings
2. Check Electron console for error messages
3. Verify no other application is using port 9988
4. Restart OddsMoni application

### Extension Installation Issues

**Problem**: Can't load unpacked extension

**Solutions**:
1. Ensure Developer mode is enabled in Edge
2. Verify you're selecting the correct folder (`src/extensions/upTime`)
3. Check that manifest.json exists in selected folder
4. Try Chrome instead of Edge (same process at `chrome://extensions/`)

## Development

### Adding New Bookmaker Support

To add a new bookmaker to the extension:

1. Edit `src/extensions/upTime/manifest.json`
   - Add URL pattern to `host_permissions`
   - Add URL pattern to `content_scripts` → `matches`

2. Edit `src/extensions/upTime/content.js`
   - Add hostname detection in `getBrokerId()`
   - Create new extractor function in `extractors` object
   - Use existing extractors as templates

3. Reload extension in browser
4. Test on the new bookmaker site

### Customizing Extraction Interval

Default extraction interval is 5 seconds. To change:

Edit `src/extensions/upTime/content.js`:
```javascript
// Line ~160
autoExtractInterval = setInterval(extractOdds, 5000); // Change 5000 to desired ms
```

### Changing WebSocket Port

Default port is 9988. To change:

1. Edit `src/extensions/upTime/background.js`:
   ```javascript
   const WS_URL = 'ws://localhost:YOUR_PORT';
   ```

2. Edit `src/main/main.js` (bootstrap function):
   ```javascript
   wsServer = createWsServer({ port: YOUR_PORT, ... });
   ```

3. Reload both extension and Electron app

## Security Notes

- WebSocket server only listens on localhost (not exposed to network)
- No authentication required (local-only connection)
- Extension only accesses specified bookmaker domains
- No sensitive data stored or transmitted
- All communication stays within local machine

## Performance

- WebSocket connection: ~1 KB/s average bandwidth
- Odds extraction: Negligible CPU impact
- Memory: ~10-20 MB per browser tab with extension active
- Network: Uses existing browser connections, no additional requests

## Limitations

- Only works with supported bookmaker sites
- Requires browser to be open and on match page
- Some bookmakers may block or detect automated extraction
- Extension must be manually installed (can't be distributed via Chrome Web Store)
- Developer mode required in browser

## Future Enhancements

Potential improvements for future versions:

- [ ] Auto-update mechanism for extension
- [ ] Support for more bookmakers
- [ ] Advanced extraction rules (handicap, totals, etc.)
- [ ] Extension popup UI for status/settings
- [ ] Multi-map odds extraction
- [ ] Error reporting and diagnostics
- [ ] Extraction interval configuration from Settings UI
- [ ] SSL/TLS support for WebSocket (wss://)

## Support

For issues or questions:
- Check Settings → Extension section for connection status
- Open DevTools in both browser (F12) and OddsMoni (Ctrl+F12)
- Look for `[upTime]` or `[wsServer]` log messages
- Report issues on GitHub repository

## License

Same license as OddsMoni main application.
