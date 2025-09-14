// Centralized shared constants used across modules.
// Only keep generic cross-module values here to avoid circular deps.

module.exports = {
  VIEW_GAP: 8,                 // spacing between broker views & preset cells
  SNAP_DISTANCE: 12,           // drag/resize snap threshold (px)
  STALE_MS: 5 * 60 * 1000,     // odds stale threshold (5 minutes)
  HEALTH_CHECK_INTERVAL: 60 * 1000, // stale monitor interval
  STATS_PANEL_WIDTH: 360,
  STATS_VIEW_GAP: 4
};
