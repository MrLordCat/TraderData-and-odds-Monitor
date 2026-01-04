/**
 * Power Towers TD - Tower Selection Handler
 * Minimal mixin for tower selection (UI moved to bottom panel)
 */

/**
 * Mixin for tower selection functionality
 * @param {Class} Base - GameController base class
 */
function TowerTooltipMixin(Base) {
  return class extends Base {
    /**
     * Update tower info (called on tower:updated event)
     * Now just updates bottom panel
     */
    updateTowerInfo(tower) {
      // Update bottom panel if method exists
      if (this.showTowerInBottomPanel) {
        this.showTowerInBottomPanel(tower);
      }
    }
    
    /**
     * Show tower info in bottom panel
     */
    showTowerInfo(tower) {
      if (!this.camera) return;
      
      // Store tower position for camera tracking
      this.tooltipTowerPosition = { x: tower.gridX, y: tower.gridY };
      
      // Update bottom panel
      if (this.showTowerInBottomPanel) {
        this.showTowerInBottomPanel(tower);
      }
    }
    
    /**
     * Hide tower info (clears state)
     */
    hideTowerInfo() {
      this.tooltipTowerPosition = null;
      // Bottom panel is handled by hideBottomPanelSelection
    }
    
    /**
     * Deselect current tower
     */
    deselectTower() {
      if (this.game) {
        this.game.selectTower(null);
      }
      this.hideTowerInfo();
    }
  };
}

module.exports = { TowerTooltipMixin };
