# Quick Extension Installation Guide

## Install upTime Extension in Edge (5 minutes)

### Step 1: Enable Developer Mode
1. Open Microsoft Edge
2. Go to `edge://extensions/`
3. Toggle "Developer mode" (bottom-left corner)

### Step 2: Load Extension
1. Click "Load unpacked" button
2. Navigate to your OddsMoni installation folder
3. Go to: `src/extensions/upTime`
4. Click "Select Folder"

### Step 3: Verify Connection
1. Start OddsMoni desktop app
2. Open Settings (gear icon in toolbar)
3. Scroll to "Extension (Chrome/Edge)" section
4. Check status:
   - WebSocket Server: ✓ Running (green)
   - Connected Clients: 1

### Step 4: Test It
1. Open any supported bookmaker site:
   - rivalry.com
   - gg.bet
   - thunderpick.io
   - betboom.ru
   - pari.ru
   - marathonbet.dk
   - bet365.ee
2. Navigate to a live LoL match
3. Odds will appear in OddsMoni's Odds Board automatically

## Troubleshooting

**Extension not connecting?**
- Ensure OddsMoni is running first
- Click "Restart Server" in Settings
- Reload extension: `edge://extensions/` → Find upTime → Click "Reload"

**No odds appearing?**
- Check you're on a live match page
- Look for match winner odds on the page
- Press F12 in browser → Console tab → Look for `[upTime]` messages

## Chrome Users
Same process, but use `chrome://extensions/` instead.

## More Help
See full documentation: `docs/EXTENSION_INTEGRATION.md`
