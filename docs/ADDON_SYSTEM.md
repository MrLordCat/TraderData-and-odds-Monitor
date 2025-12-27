# Addon System Documentation

## Overview

The addon system allows extending the application with external modules that can be downloaded and installed from GitHub releases.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ADDON LIFECYCLE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Registry Fetch                                          │
│     └── GET addon-registry/registry.json                    │
│                                                             │
│  2. Install                                                 │
│     ├── Download .zip from release URL                      │
│     ├── Extract to userData/addons/<id>/                    │
│     └── Add to enabledAddons list                           │
│                                                             │
│  3. Load (on app start)                                     │
│     ├── Read enabledAddons from store                       │
│     ├── For each enabled: require(addon/index.js)           │
│     └── Register SidebarModule                              │
│                                                             │
│  4. Runtime                                                 │
│     ├── Module appears in sidebar                           │
│     ├── Receives IPC events                                 │
│     └── Can detach to separate window                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
%APPDATA%/oddsmoni/
└── addons/
    └── power-towers/           # Addon ID = folder name
        ├── manifest.json       # Required: addon metadata
        ├── index.js            # Entry point (SidebarModule)
        ├── styles.css          # Optional: styles
        ├── core/               # Game logic
        ├── renderer/           # Canvas rendering
        └── assets/             # Sprites, sounds
```

## Manifest Format

```json
{
  "id": "power-towers",
  "name": "Power Towers TD",
  "version": "0.1.0",
  "description": "Roguelike Tower Defense game",
  "author": "MrLordCat",
  "icon": "🗼",
  "main": "index.js",
  "order": 100,
  "requires": {
    "app": ">=0.2.0"
  },
  "provides": {
    "sidebarModule": true,
    "detachable": true
  }
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier (lowercase, no spaces) |
| `name` | Yes | Display name |
| `version` | Yes | Semver version |
| `description` | No | Short description |
| `author` | No | Author name |
| `icon` | No | Emoji or path to icon |
| `main` | Yes | Entry point file (relative) |
| `order` | No | Sidebar position (default: 100) |
| `requires.app` | No | Minimum app version |

## Creating an Addon

### 1. Create Module Structure

```
my-addon/
├── manifest.json
├── index.js
└── styles.css
```

### 2. Implement SidebarModule

```javascript
// index.js
const { SidebarModule, registerModule, eventBus } = require('../../core/sidebar-base');

class MyAddonModule extends SidebarModule {
  static id = 'my-addon';
  static title = 'My Addon';
  static icon = `<svg>...</svg>`;
  static order = 50;

  constructor(options) {
    super(options);
    // Initialize state
  }

  getTemplate() {
    return `
      <div class="my-addon-container">
        <h3>Hello from My Addon!</h3>
        <button id="my-btn">Click me</button>
      </div>
    `;
  }

  onMount(container) {
    super.onMount(container);
    
    // Setup event listeners
    const btn = this.$('#my-btn');
    if (btn) {
      btn.addEventListener('click', () => this.handleClick());
    }
    
    // Subscribe to IPC
    this.subscribeIpc('onOddsUpdate', (data) => {
      this.handleOdds(data);
    });
  }

  onUnmount() {
    super.onUnmount();
    // Cleanup
  }

  handleClick() {
    console.log('Button clicked!');
  }

  handleOdds(data) {
    // Process odds data
  }
}

registerModule(MyAddonModule);
module.exports = MyAddonModule;
```

### 3. Package and Release

1. Create a zip file containing all addon files
2. Create a GitHub release with tag `addon-<id>-v<version>`
3. Update registry.json in addon-registry branch

## Registry Format

```json
{
  "addons": [
    {
      "id": "power-towers",
      "name": "Power Towers TD",
      "version": "0.1.0",
      "description": "Roguelike Tower Defense game",
      "author": "MrLordCat",
      "icon": "🗼",
      "downloadUrl": "https://github.com/.../power-towers-v0.1.0.zip",
      "repository": "https://github.com/...",
      "branch": "game",
      "requires": {
        "app": ">=0.2.0"
      }
    }
  ],
  "lastUpdated": "2025-12-27T00:00:00Z"
}
```

## API Reference

### SidebarModule Methods

| Method | Description |
|--------|-------------|
| `getTemplate()` | Return HTML string for module content |
| `onMount(container)` | Called when module is added to DOM |
| `onUnmount()` | Called when module is removed |
| `onIpc(channel, payload)` | Handle raw IPC messages |
| `subscribeIpc(channel, handler)` | Subscribe to IPC with auto-cleanup |
| `$(selector)` | Query single element in module |
| `$$(selector)` | Query all elements in module |
| `emit(event, data)` | Emit event to other modules |
| `on(event, callback)` | Listen to events from other modules |

### Available IPC Channels

| Channel | Data | Description |
|---------|------|-------------|
| `onOddsUpdate` | `{ broker, odds, frozen }` | Odds data from brokers |
| `onMapUpdated` | `{ map }` | Map selection changed |
| `onAutoStateUpdated` | `{ active, side }` | Auto trading state |
| `onExcelTeamNames` | `{ team1, team2 }` | Team names from Excel |
| `onLayoutChanged` | `{ preset }` | Layout preset changed |

## Debugging

1. Open DevTools: Press `F12` or `Ctrl+Shift+I`
2. Check console for `[sidebar]` prefixed messages
3. Access loader: `window.__sidebarLoader`
4. List modules: `window.__sidebarLoader.instances`

## Best Practices

1. **Use unique IDs** - Prefix with your addon name
2. **Clean up resources** - Implement `onUnmount()`
3. **Handle errors** - Wrap IPC handlers in try/catch
4. **Test standalone** - Verify module loads without errors
5. **Version properly** - Use semver for compatibility

## Troubleshooting

### Addon doesn't appear in sidebar

1. Check manifest.json is valid JSON
2. Verify `main` points to existing file
3. Check console for load errors
4. Ensure `registerModule()` is called

### IPC events not received

1. Use `subscribeIpc()` instead of manual listeners
2. Check channel name spelling
3. Verify desktopAPI is available

### Styles not applied

1. Check CSS file is loaded
2. Use scoped selectors (`.my-addon-container .my-class`)
3. Check for CSS syntax errors
