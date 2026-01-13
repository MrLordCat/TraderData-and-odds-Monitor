# Extension Architecture Diagram

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Edge/Chrome)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │  Bookmaker Tab   │         │  Bookmaker Tab   │             │
│  │  (rivalry.com)   │         │  (gg.bet)        │             │
│  │                  │         │                  │             │
│  │  ┌────────────┐  │         │  ┌────────────┐  │             │
│  │  │ content.js │  │         │  │ content.js │  │             │
│  │  │ (extractor)│  │         │  │ (extractor)│  │             │
│  │  └─────┬──────┘  │         │  └─────┬──────┘  │             │
│  └────────┼─────────┘         └────────┼─────────┘             │
│           │                            │                         │
│           └────────────┬───────────────┘                         │
│                        │                                         │
│                  ┌─────▼──────┐                                  │
│                  │background.js│                                 │
│                  │ (WebSocket) │                                 │
│                  └─────┬──────┘                                  │
│                        │                                         │
└────────────────────────┼─────────────────────────────────────────┘
                         │ WebSocket (ws://localhost:9988)
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│                    Electron App (OddsMoni)                        │
├───────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Main Process (Node.js)                         │ │
│  │                                                              │ │
│  │  ┌──────────────┐        ┌──────────────────┐              │ │
│  │  │  wsServer    │───────▶│ Odds Processing  │              │ │
│  │  │  (port 9988) │        │  & Broadcasting  │              │ │
│  │  └──────────────┘        └────────┬─────────┘              │ │
│  │                                    │                        │ │
│  └────────────────────────────────────┼──────────────────────┬─┘ │
│                                       │ IPC                   │   │
│  ┌────────────────────────────────────▼──────────────────────▼─┐ │
│  │              Renderer Processes                             │ │
│  │                                                              │ │
│  │  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐│ │
│  │  │ Odds Board   │     │ Stats Panel  │     │  Settings   ││ │
│  │  │ (board.html) │     │(stats_panel) │     │(settings.html)│ │
│  │  │              │     │              │     │             ││ │
│  │  │  ┌────────┐  │     │  ┌────────┐  │     │ Extension  ││ │
│  │  │  │ Rivalry│  │     │  │ Stats  │  │     │  Status    ││ │
│  │  │  │  2.10  │  │     │  │ Views  │  │     │  Display   ││ │
│  │  │  │  1.75  │  │     │  └────────┘  │     └─────────────┘│ │
│  │  │  └────────┘  │     │              │                    │ │
│  │  │  ┌────────┐  │     │              │                    │ │
│  │  │  │ GG.bet │  │     │              │                    │ │
│  │  │  │  2.05  │  │     │              │                    │ │
│  │  │  │  1.80  │  │     │              │                    │ │
│  │  │  └────────┘  │     │              │                    │ │
│  │  └──────────────┘     └──────────────┘                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

```
1. User opens rivalry.com in browser
   │
   ├─▶ content.js loads and detects site
   │
   ├─▶ Starts auto-extraction (every 5 seconds)
   │
   └─▶ Extracts odds from DOM: ["2.10", "1.75"]

2. content.js sends to background.js
   │
   └─▶ chrome.runtime.sendMessage({
         type: 'oddsExtracted',
         brokerId: 'rivalry',
         odds: ['2.10', '1.75']
       })

3. background.js forwards via WebSocket
   │
   └─▶ ws.send(JSON.stringify({
         type: 'oddsUpdate',
         brokerId: 'rivalry',
         odds: ['2.10', '1.75'],
         source: 'extension',
         timestamp: Date.now()
       }))

4. Electron wsServer receives message
   │
   ├─▶ Validates and processes
   │
   └─▶ Calls onOddsUpdate callback

5. Main process broadcasts to renderers
   │
   ├─▶ boardManager.sendOdds(payload)
   │   └─▶ Updates Odds Board table
   │
   └─▶ statsManager.views.panel.webContents.send('odds-update', payload)
       └─▶ Updates Stats Panel display

6. User sees odds in OddsMoni UI
   └─▶ Rivalry: 2.10 / 1.75
```

## Connection States

```
Extension Lifecycle:

┌─────────────┐
│ Extension   │
│ Installed   │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│ background  │────▶│ Try Connect  │
│ starts      │     │ ws://...9988 │
└─────────────┘     └──────┬───────┘
                           │
                    ┌──────▼──────┐
                    │ Connected?  │
                    └──────┬──────┘
                           │
                ┌──────────┼──────────┐
                │          │          │
              ✓ Yes      ✗ No        │
                │          │          │
                │    ┌─────▼─────┐    │
                │    │Wait 15sec │    │
                │    └─────┬─────┘    │
                │          │          │
                │          └──────────┘
                │
                ▼
       ┌────────────────┐
       │ Send Handshake │
       │ Start Listening│
       └────────────────┘
                │
                ▼
       ┌────────────────┐
       │ Receive Welcome│
       │ Status: Active │
       └────────────────┘
```

## Settings UI Flow

```
User opens Settings → Extension section
         │
         ▼
   ┌─────────────────┐
   │ Invoke IPC      │
   │ 'extension-     │
   │  get-status'    │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ wsServer.       │
   │ getStatus()     │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Return:         │
   │ {               │
   │   running: true,│
   │   port: 9988,   │
   │   clients: 1    │
   │ }               │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Update UI       │
   │ ✓ Running       │
   │ Clients: 1      │
   └─────────────────┘
```

## File Structure

```
src/
├── extensions/upTime/          # Browser extension
│   ├── manifest.json           # Extension config
│   ├── background.js           # WebSocket client
│   ├── content.js              # Odds extractors
│   └── icons/                  # Extension icons
│
├── main/                       # Electron main process
│   ├── main.js                 # Bootstrap & init
│   └── modules/
│       ├── wsServer/           # WebSocket server
│       │   └── index.js
│       └── ipc/
│           └── extension.js    # Extension IPC
│
└── renderer/                   # Electron renderer
    ├── pages/
    │   └── settings.html       # Extension UI
    └── scripts/
        └── settings.js         # Extension handlers
```

## Security Boundaries

```
┌───────────────────────────────────────────────────────────┐
│  Browser Sandbox                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Extension (content.js)                             │ │
│  │  - Reads DOM only                                   │ │
│  │  - No file system access                            │ │
│  │  - Limited permissions                              │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Extension (background.js)                          │ │
│  │  - WebSocket client only                            │ │
│  │  - Connects to localhost:9988                       │ │
│  │  - No network exposure                              │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
                           │
                    localhost only
                           │
┌───────────────────────────▼───────────────────────────────┐
│  Electron Main Process                                    │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  wsServer                                           │ │
│  │  - Binds to 127.0.0.1:9988                          │ │
│  │  - No external network access                       │ │
│  │  - No authentication (localhost only)               │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```
