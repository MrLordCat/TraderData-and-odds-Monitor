# brokers

Bookmaker-specific scraping and navigation helpers.

## Architecture
- `extractors/` — modular extractor directory:
  - `base.js` — shared utilities (`emptyResult()`, `deepQuery()`, `normalizeGame()`, `postProcessOdds()`, etc.)
  - `index.js` — router/registry with `EXTRACTOR_TABLE`, `collectOdds()`, `getBrokerId()`
  - One file per bookmaker: `rivalry.js`, `bet365.js`, `gg.js`, `thunderpick.js`, `betboom.js`, `pari.js`, `marathon.js`
- `mapNav.js` — map tab navigation helpers; reasserts selection after SPA transitions / reloads.

## Key points
- Runs inside broker pages via preload scripts (`src/main/preloads/broker.js`).
- Prefer structural cues and stable attributes (data attributes, `role`) over brittle class names.
- Fail soft: return `emptyResult()` → `{ odds: ['-','-'], frozen: false }` to not break aggregation.
- BetBoom: no fallback to match-level odds for specific map — verifies active tab before extracting.
