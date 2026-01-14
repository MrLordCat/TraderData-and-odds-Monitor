# Main Process Utilities

Shared utility modules for main process. Reduces code duplication and standardizes common patterns.

## Modules

### constants.js
Centralized numeric constants used across the app.

**Constants:**
- `VIEW_GAP` (8): Horizontal gap between broker BrowserViews
- `SNAP_DISTANCE` (12): Drag/resize snap threshold
- `STALE_MS` (5*60*1000): Odds staleness timeout
- `HEALTH_CHECK_INTERVAL` (60*1000): Broker health polling interval
- `STATS_PANEL_WIDTH` (360): Base width for stats panel
- `STATS_VIEW_GAP` (4): Gap between stats subviews

### broadcast.js
Broadcast utilities for sending messages to multiple webContents.

**Usage:**
```javascript
const { broadcastToAll } = require('./modules/utils/broadcast');

// Broadcast to all views (board, main, stats)
broadcastToAll(ctx, 'odds-update', oddsPayload);
```

**Functions:**
- `broadcastToAll(ctx, channel, payload)` - Send to all relevant views
- `getBoardWebContents()` - Get board webContents
- `getStatsWebContentsList()` - Get all stats webContents

### ipc.js
Shared IPC utility patterns for consistent handler registration and error handling.

**Usage:**
```javascript
const { createIpcModule, registerHandlers, safeSend } = require('./modules/utils/ipc');

// Create module helper
const ipcModule = createIpcModule('myModule');

// Register multiple handlers at once
ipcModule.registerHandlers(ipcMain, {
  'get-data': async () => {
    return { success: true, data: await fetchData() };
  },
  'save-data': async (event, payload) => {
    await saveData(payload);
    return { success: true };
  }
});

// Safe send to webContents
safeSend(window.webContents, 'update-notification', { message: 'Updated' });

// Log with module prefix
ipcModule.log('Data loaded successfully');
ipcModule.error('Failed to save', error);
```

**Available Functions:**
- `createSafeHandler(handler, logPrefix)` - Wrap handler with error handling
- `registerHandlers(ipcMain, handlers, logPrefix)` - Batch register invoke handlers
- `registerListeners(ipcMain, listeners, logPrefix)` - Batch register event listeners
- `safeSend(webContents, channel, payload)` - Send with safety checks
- `broadcastToMany(webContentsList, channel, payload)` - Send to multiple views
- `response(data, error)` - Create standardized response object
- `createIpcModule(moduleName)` - Create scoped IPC helper

**IPC Module Methods:**
- `registerHandlers(ipcMain, handlers)` - Register with module prefix
- `registerListeners(ipcMain, listeners)` - Register listeners with module prefix
- `safeHandler(handler)` - Create safe handler with prefix
- `log(...args)` - Log info with module prefix
- `error(...args)` - Log error with module prefix
- `response(data, error)` - Create response object

### odds.js
Odds manipulation utilities.

### display.js
Display and window positioning helpers.

### views.js
BrowserView management utilities.

## Migration Benefits

1. **Consistent Error Handling**: All IPC handlers wrapped with error catching
2. **Reduced Boilerplate**: Batch handler registration eliminates repetition
3. **Better Logging**: Scoped loggers with module prefixes
4. **Type Safety**: JSDoc annotations for IDE support
5. **Standardized Responses**: Consistent response format for invoke handlers

## Example: Refactoring IPC Module

### Before:
```javascript
// Old pattern - manual error handling per handler
ipcMain.handle('module-get-data', async (event) => {
  try {
    const data = await fetchData();
    return { success: true, data };
  } catch (e) {
    console.error('[module] get-data error:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('module-save-data', async (event, payload) => {
  try {
    await saveData(payload);
    return { success: true };
  } catch (e) {
    console.error('[module] save-data error:', e);
    return { success: false, error: e.message };
  }
});
```

### After:
```javascript
// New pattern - automatic error handling and logging
const ipcModule = createIpcModule('module');

ipcModule.registerHandlers(ipcMain, {
  'module-get-data': async () => {
    const data = await fetchData();
    return ipcModule.response(data);
  },
  'module-save-data': async (event, payload) => {
    await saveData(payload);
    return ipcModule.response({ saved: true });
  }
});
```

**Benefits:**
- 40% less code
- Automatic error handling and logging
- Consistent response format
- Easier to maintain and test

## Notes

- IPC helpers automatically catch and log errors
- `safeSend` checks if webContents is destroyed before sending
- Use `createIpcModule` for consistent logging prefixes
- All utilities handle edge cases (null checks, destroyed views, etc.)
