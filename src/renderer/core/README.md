# Renderer Core Modules

Shared logic modules for OddsMoni renderer processes.

## Architecture

These modules follow a **hybrid ES/IIFE pattern** for maximum compatibility:
- ES module exports (`export function ...`) for bundled usage
- Window global attachment (`window.X = X`) for script tag usage

## Modules

### OddsCore (`odds_core.js`)

Central odds management hub with real-time updates.

```javascript
// ES import (recommended for bundled code)
import { createOddsHub, computeDerivedFrom } from './core/odds_core.js';

// Or via window global (legacy script tag)
const { createOddsHub, computeDerivedFrom } = window.OddsCore;

// Create hub and subscribe to updates
const hub = createOddsHub();
hub.start();
hub.subscribe(state => {
  console.log('Records:', state.records);
  const derived = hub.computeDerived();
  console.log('Mid:', derived.mid, 'ARB:', derived.arbProfitPct);
});
```

### Auto Mode

Auto Mode has been **unified** into a single module at `src/renderer/auto/loader.js` (~1200 lines).

See `docs/AUTO_MODE.md` for complete documentation.

## Build System

Modules can be bundled using esbuild:

```bash
# Development build (with sourcemaps)
npm run build:renderer:dev

# Production build (minified)
npm run build:renderer

# Watch mode for development
npm run build:renderer:watch
```

Output: `src/renderer/dist/*.bundle.js`

## Migration Guide

### From script tags to ES imports

**Before:**
```html
<script src="../core/odds_core.js"></script>
<script>
  const hub = window.OddsCore.createOddsHub();
</script>
```

**After:**
```javascript
// In your module file
import { createOddsHub } from '../core/odds_core.js';
const hub = createOddsHub();
```

### Removing window.* dependencies

1. Replace `window.X` with proper imports
2. Pass dependencies as function parameters instead of globals
3. Use the bundled output from `src/renderer/dist/`
