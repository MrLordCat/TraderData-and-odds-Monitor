# Odds Desktop Prototype

Minimal Electron scaffold co-existing inside the extension repo.

## Structure
- main.js: Electron main process, creates main window + broker BrowserViews
- preload.js: Exposes limited API to renderer
- brokerPreload.js: Injected into each broker view, will host adapted extractors
- renderer/index.html: Simple UI table showing incoming odds

## Run (after installing dependencies)
```
npm install
npm run dev
```

## Next steps
1. Port real extract* functions from extension into brokerPreload (domain detection + per-site logic)
2. Replace naive layout with dynamic grid + resize/drag persistence
3. Implement MID + arbitrage calculations in renderer
4. Add persistent storage (SQLite) for history
5. Auto-updater config (electron-builder) once logic stabilizes
