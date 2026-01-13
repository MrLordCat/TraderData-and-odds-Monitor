# upTime - Odds Extractor Extension

Chrome/Edge extension for real-time odds extraction from bookmaker sites.

## Features
- Automatic odds extraction from supported bookmaker sites
- WebSocket connection to Electron app (ws://localhost:9988)
- Automatic reconnection every 15 seconds
- Real-time data synchronization

## Installation (Developer Mode)

### Edge
1. Open Edge and navigate to `edge://extensions/`
2. Enable "Developer mode" (toggle in bottom-left)
3. Click "Load unpacked"
4. Select the `src/extensions/upTime` folder
5. Extension will appear in toolbar and start connecting

### Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `src/extensions/upTime` folder
5. Extension will appear in toolbar and start connecting

## Supported Bookmakers
- Rivalry (rivalry.com)
- GG.bet (gg.bet)
- Thunderpick (thunderpick.io)
- BetBoom (betboom.ru)
- Pari (pari.ru)
- Marathon (marathonbet.dk)
- Bet365 (bet365.ee)

## Architecture
- **manifest.json**: Extension configuration
- **background.js**: Service worker managing WebSocket connection
- **content.js**: Content script for odds extraction

## Connection
The extension connects to the Electron app via WebSocket on port 9988.
Ensure the Electron app is running with the WebSocket server enabled.
