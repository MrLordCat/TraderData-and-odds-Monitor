// Stats Panel Entry Point
// Bundles all dependencies for stats_panel.html

// Core modules
import OddsCore from '../core/odds_core.js';
import OddsBoardShared from '../ui/odds_board_shared.js';

// UI utilities  
import '../ui/toast.js';
import '../ui/excel_status.js';

// Dev tools
import '../scripts/devcss-reload.js';

// Stats panel specific
import '../scripts/stats_config.js';
import '../scripts/stats_theme.js';
import '../scripts/stats_collapse.js';
import '../scripts/odds_board.js';
import '../scripts/stats_panel.js';
import '../scripts/stats_boot.js';

// Auto mode
import '../auto/loader.js';

// Addon loader
import '../scripts/addon_loader.js';

// Ensure globals are available for legacy code
if (typeof window !== 'undefined') {
  window.OddsCore = OddsCore;
  window.OddsBoardShared = OddsBoardShared;
}

console.log('[stats-panel-bundle] Loaded');
