/**
 * Power Towers TD - Styles Index
 * Modular CSS system
 */

const { getLauncherStyles } = require('./launcher');
const { getLayoutStyles } = require('./layout');
const { getHudStyles } = require('./hud');
const { getCanvasStyles } = require('./canvas');
const { getControlsStyles } = require('./controls');
const { getTooltipStyles } = require('./tooltips');
const { getUpgradesStyles } = require('./upgrades');
const { getEnergyStyles } = require('./energy');
const { getBottomPanelStyles } = require('../bottom-panel/styles');

/**
 * Full game styles for detached mode
 * Combines all style modules
 */
function getGameStyles() {
  return `
    ${getLayoutStyles()}
    ${getHudStyles()}
    ${getCanvasStyles()}
    ${getControlsStyles()}
    ${getTooltipStyles()}
    ${getUpgradesStyles()}
    ${getEnergyStyles()}
    ${getBottomPanelStyles()}
  `;
}

module.exports = {
  getLauncherStyles,
  getGameStyles,
  // Individual modules for direct access
  getLayoutStyles,
  getHudStyles,
  getCanvasStyles,
  getControlsStyles,
  getTooltipStyles,
  getUpgradesStyles,
  getEnergyStyles,
  getBottomPanelStyles
};
