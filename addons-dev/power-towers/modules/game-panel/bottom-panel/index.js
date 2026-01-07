/**
 * Power Towers TD - Bottom Panel Module
 * Composes all bottom panel mixins into single BottomPanelMixin
 */

// Import all sub-mixins
const { BottomPanelEventsMixin } = require('./events');
const { TowerStatsMixin } = require('./tower-stats');
const { EnergyStatsMixin } = require('./energy-stats');
const { UpgradesMixin } = require('./upgrades');

// Re-export styles and templates (styles now from styles/ folder)
const { getBottomPanelStyles } = require('./styles/index');
const { getBottomPanelTemplate } = require('./templates');

/**
 * Compose all bottom panel mixins into single mixin
 * @param {Class} Base - GameController base class
 * @returns {Class} Enhanced class with all bottom panel functionality
 */
function BottomPanelMixin(Base) {
  // Apply mixins in order (events first, then display, then upgrades)
  return UpgradesMixin(
    EnergyStatsMixin(
      TowerStatsMixin(
        BottomPanelEventsMixin(Base)
      )
    )
  );
}

module.exports = { 
  BottomPanelMixin,
  getBottomPanelStyles,
  getBottomPanelTemplate
};
