# UI Utilities

Shared utility modules for renderer scripts. Reduces code duplication and standardizes common patterns.

## Modules

### dom_helpers.js
Safe DOM query and manipulation helpers. Eliminates duplicate getElementById wrappers and provides consistent error handling.

**Usage:**
```javascript
const { byId, query, queryAll, setText, setVisible } = require('./ui/dom_helpers');

// Safe element query
const btn = byId('myButton');
if (btn) btn.click();

// Update element text
setText('statusLabel', 'Connected');

// Show/hide elements
setVisible('errorPanel', false);

// Query selectors
const items = queryAll('.list-item');
items.forEach(item => {
  // Process items
});
```

**Available Functions:**
- `byId(id)` - Safe getElementById with null fallback
- `query(selector, root)` - Safe querySelector
- `queryAll(selector, root)` - Safe querySelectorAll returning array
- `setText(idOrElement, text)` - Set text content safely
- `setHtml(idOrElement, html)` - Set innerHTML safely
- `setVisible(idOrElement, visible)` - Show/hide element
- `toggleVisible(idOrElement)` - Toggle visibility
- `on(idOrElement, event, handler)` - Add event listener with cleanup
- `getValue/setValue` - Form value helpers
- `isChecked/setChecked` - Checkbox helpers
- `setDisabled` - Disabled state helper
- `bindMany(bindings)` - Batch event listener binding

### error_helpers.js
Centralized error handling and logging with configurable log levels. Reduces repetitive try-catch patterns.

**Usage:**
```javascript
const { safe, safeAsync, createLogger, LOG_LEVELS, setLogLevel } = require('./ui/error_helpers');

// Set log level (DEBUG, INFO, WARN, ERROR)
setLogLevel(LOG_LEVELS.INFO);

// Create scoped logger
const log = createLogger('[MyModule]');
log.info('Module initialized');
log.error('Something went wrong', error);

// Safe execution with default value
const result = safe(() => JSON.parse(data), {});

// Async safe execution
const data = await safeAsync(async () => {
  const response = await fetch(url);
  return response.json();
}, null);

// Silent execution (no logging)
const value = silent(() => parseFloat(input), 0);
```

**Available Functions:**
- `setLogLevel(level)` - Configure logging level
- `logError/logWarn/logInfo/logDebug(prefix, ...args)` - Leveled logging
- `safe(fn, defaultValue, errorPrefix)` - Execute with error handling
- `safeAsync(fn, defaultValue, errorPrefix)` - Async version
- `silent/silentAsync(fn, defaultValue)` - Silent error handling
- `wrap/wrapAsync(fn, options)` - Wrap functions with error handling
- `createLogger(prefix)` - Create scoped logger instance
- `time/timeAsync(label, fn)` - Performance measurement

### api_helpers.js
IPC and desktopAPI abstraction helpers. Simplifies communication between renderer and main process.

**Usage:**
```javascript
const { invoke, send, on, bindBtnToApi } = require('./ui/api_helpers');

// Invoke IPC handler
const result = await invoke('get-settings');

// Send fire-and-forget
send('save-settings', { theme: 'dark' });

// Subscribe to channel
on('settings-updated', (settings) => {
  // Handle update
});

// Bind button to API method
bindBtnToApi('saveBtn', 'saveSettings');
```

### toast.js
Toast notification system for user feedback.

### excel_status.js
Shared Excel extractor status display component.

### odds_board_shared.js/css
Shared odds board components and styles.

## Migration Guide

### Before (Duplicate Pattern):
```javascript
// In multiple files
function byId(id){ 
  try { return document.getElementById(id); } 
  catch(_){ return null; } 
}

const btn = byId('myBtn');
```

### After (Shared Utility):
```javascript
// Load once at top of file
let byId = null;
try { const DomHelpers = require('../ui/dom_helpers'); byId = DomHelpers.byId; } 
catch(_){ }
if(!byId && window.DomHelpers) byId = window.DomHelpers.byId;
if(!byId) byId = (id) => { try { return document.getElementById(id); } catch(_){ return null; } };

const btn = byId('myBtn');
```

## Benefits

1. **Reduced Code Duplication**: Eliminated 6 duplicate getElementById wrappers, saving ~60 lines
2. **Consistent Error Handling**: Single source of truth for error patterns
3. **Better Maintainability**: Changes to helpers propagate automatically
4. **Improved Testability**: Shared utilities can be unit tested
5. **Configurable Logging**: Control verbosity via log levels
6. **Type Safety**: JSDoc annotations for better IDE support

## Files Refactored

- ✅ `auto_trader.js` - Uses shared dom_helpers
- ✅ `stats_theme.js` - Uses shared dom_helpers
- ✅ `stats_panel.js` - 50+ replacements
- ✅ `board.js` - 40 replacements
- ✅ `settings.js` - 62 replacements
- ✅ `stats_embedded.js` - 30 replacements

Total: **180+ document.getElementById calls replaced** with shared helper.

## Notes

- Empty catch blocks `catch(_){}` are intentional in many places for silent error handling
- Use `silent()` from error_helpers for cleaner code when silent errors are desired
- DOM helpers are available both via require() and window globals for flexibility
- All utilities are safe to call with missing elements/invalid inputs
