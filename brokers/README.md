# brokers

Bookmaker-specific scraping and navigation helpers.

- `extractors.js`: DOM parsers per bookmaker + generic dispatcher `collectOdds`. Be careful with selectors; comments document invariants.
- `mapNav.js`: Map selection navigation helpers and reapply logic after SPA/refresh.

Key points:
- Runs inside broker pages via preloads/injected scripts.
- Prefer structural cues and stable attributes over brittle class names.
- Fail soft: return placeholder odds like ['-','-'] to not break aggregation.
