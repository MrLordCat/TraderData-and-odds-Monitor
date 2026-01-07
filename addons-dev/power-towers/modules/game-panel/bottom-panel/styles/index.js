/**
 * Power Towers TD - Bottom Panel Styles Index
 * Modular CSS for the 3-section bottom panel
 * 
 * Structure:
 *   styles/
 *   ├── index.js      <- THIS FILE (aggregator)
 *   ├── base.js       <- Layout, popup system
 *   ├── stats.js      <- Section 1: Stats (left)
 *   ├── avatar.js     <- Section 2: Avatar (center)
 *   ├── build.js      <- Section 3: Build menu (right)
 *   ├── actions.js    <- Actions menu, grids
 *   └── upgrades.js   <- Upgrade cards
 */

const { getBaseStyles } = require('./base');
const { getStatsStyles } = require('./stats');
const { getAvatarStyles } = require('./avatar');
const { getBuildStyles } = require('./build');
const { getActionsStyles } = require('./actions');
const { getUpgradeCardStyles } = require('./upgrades');

/**
 * Get all bottom panel styles combined
 */
function getBottomPanelStyles() {
  return `
    ${getBaseStyles()}
    ${getStatsStyles()}
    ${getAvatarStyles()}
    ${getBuildStyles()}
    ${getActionsStyles()}
    ${getUpgradeCardStyles()}
  `;
}

module.exports = { 
  getBottomPanelStyles,
  // Export individual modules for direct access
  getBaseStyles,
  getStatsStyles,
  getAvatarStyles,
  getBuildStyles,
  getActionsStyles,
  getUpgradeCardStyles
};
