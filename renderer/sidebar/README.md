# Sidebar Module System

Modular architecture for sidebar panels. Each module is a self-contained component that can be loaded into the sidebar.

## Structure

```
sidebar/
├── core/
│   ├── sidebar-base.css    # Shared styles for all modules
│   ├── sidebar-base.js     # Base module class & registry
│   └── sidebar-loader.js   # Dynamic module loader
├── modules/
│   ├── toolbar/            # Top toolbar (add broker, layout, settings)
│   ├── sources-layout/     # Broker sources and layout presets
│   ├── odds-board/         # Aggregated odds table with auto trading
│   └── [future modules]/
├── sidebar.html            # Main sidebar container
└── sidebar-init.js         # Initialization script
```

## Current Modules

1. **toolbar** (order: 0) - Top toolbar with broker controls, layout selector, settings
2. **sources-layout** (order: 5) - Active sources list and layout preset buttons  
3. **odds-board** (order: 10) - Aggregated odds table, Excel row, Auto trading controls

## Creating a New Module

### 1. Create module folder

```
renderer/sidebar/modules/my-module/
├── index.js      # Module class (required)
└── styles.css    # Module styles (optional)
```

### 2. Create module class

```javascript
// modules/my-module/index.js
const { SidebarModule, registerModule } = require('../../core/sidebar-base');

class MyModule extends SidebarModule {
  static id = 'my-module';      // Unique ID
  static title = 'My Module';   // Header title (null = no header)
  static order = 50;            // Sort order (lower = higher)
  
  getTemplate() {
    return `
      <div class="my-content">
        Hello World
      </div>
    `;
  }
  
  onMount(container) {
    super.onMount(container);
    this.bindEvents();
  }
  
  bindEvents() {
    // Use this.$() and this.$$() to query within module
    this.$('.my-button')?.addEventListener('click', () => {
      console.log('Clicked!');
    });
    
    // Subscribe to IPC (auto-cleanup on unmount)
    this.subscribeIpc('onOddsUpdate', (payload) => {
      this.handleOdds(payload);
    });
  }
  
  // Handle IPC messages
  onIpc(channel, payload) {
    // Called for all IPC channels
  }
  
  onUnmount() {
    super.onUnmount();
    // Cleanup
  }
}

// Register the module
registerModule(MyModule);
module.exports = MyModule;
```

### 3. Add styles (optional)

```css
/* modules/my-module/styles.css */
.my-content {
  padding: 12px;
}
```

### 4. Register in sidebar.html

```html
<!-- Add CSS link -->
<link rel="stylesheet" href="modules/my-module/styles.css" />

<!-- Add module script -->
<script src="modules/my-module/index.js"></script>
```

## Module API

### Properties

- `this.container` - Module's DOM wrapper element
- `this.mounted` - Boolean, true when mounted
- `this.options` - Options passed during construction

### Methods

- `this.$(selector)` - Query single element within module
- `this.$$(selector)` - Query all elements within module
- `this.subscribeIpc(channel, handler)` - Subscribe to IPC (auto-cleanup)
- `this.emit(event, data)` - Emit event to other modules
- `this.on(event, callback)` - Listen to events from other modules

### Lifecycle

1. `constructor(options)` - Module instantiated
2. `getTemplate()` - Returns HTML string for module content
3. `onMount(container)` - Called after DOM insertion
4. `onIpc(channel, payload)` - Called on IPC messages
5. `onUnmount()` - Called before removal

## Shared Styles

All modules inherit from `sidebar-base.css`:

### CSS Variables
- `--sidebar-bg`, `--sidebar-surface`, `--sidebar-border`
- `--sidebar-text`, `--sidebar-text-muted`
- `--sidebar-accent`, `--sidebar-success`, `--sidebar-warning`, `--sidebar-danger`

### Components
- `.sb-btn`, `.sb-btn.primary`, `.sb-btn.danger` - Buttons
- `.sb-icon-btn` - Icon buttons
- `.sb-select` - Select dropdowns
- `.sb-checkbox` - Checkbox labels
- `.sb-input` - Text inputs
- `.sb-table` - Tables
- `.sb-badge` - Badges/tags

### Utilities
- `.sb-flex`, `.sb-flex-col`, `.sb-items-center`, `.sb-justify-between`
- `.sb-gap-1`, `.sb-gap-2`, `.sb-gap-3`
- `.sb-text-muted`, `.sb-text-success`, etc.
- `.sb-hidden`, `.sb-sr-only`

## Inter-Module Communication

Modules can communicate via the event bus:

```javascript
// Emit from one module
this.emit('mapChanged', { map: 2 });

// Listen in another module
this.on('mapChanged', (data) => {
  console.log('Map changed to:', data.map);
});
```

## IPC Integration

Modules receive IPC messages via `onIpc()` or `subscribeIpc()`:

```javascript
// Method 1: Override onIpc
onIpc(channel, payload) {
  if (channel === 'onOddsUpdate') {
    this.updateOdds(payload);
  }
}

// Method 2: Use subscribeIpc (recommended - auto cleanup)
this.subscribeIpc('onOddsUpdate', (payload) => {
  this.updateOdds(payload);
});
```
