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

// Animation warm-up (prevents cold-start lag)
import '../scripts/warmup.js';

// Auto mode
import '../auto/loader.js';

// Addon loader
import '../scripts/addon_loader.js';

console.log('[stats-panel-bundle] Loaded');
