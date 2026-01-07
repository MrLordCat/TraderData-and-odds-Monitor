/**
 * Power Towers TD - Game Events Handler
 * Handles game event subscriptions
 */

/**
 * Mixin for game event functionality
 * @param {Class} Base - GameController base class
 */
function GameEventsMixin(Base) {
  return class extends Base {
    /**
     * Setup game event handlers
     */
    setupGameEvents() {
      if (!this.game) return;
      
      // Update UI on every game tick (render is handled by independent render loop)
      this.game.on(this.GameEvents.GAME_TICK, () => {
        this.updateUI(this.game.getState());
        
        // Check if tower panel is actually visible before updating
        const isTowerPanelVisible = this.elements.panelStatsContent?.style.display !== 'none' 
                                    && this.elements.statsGridTower?.style.display !== 'none';
        
        // Update bottom panel stats in real-time for selected tower (only if panel is visible)
        if (this.game.selectedTower && isTowerPanelVisible && !this.selectedEnergyBuilding) {
          this.updateBottomPanelStats(this.game.selectedTower);
        }
        
        // Update tooltip energy display in real-time if visible
        if (this.game.selectedTower && this.elements.towerTooltip?.classList.contains('visible')) {
          this.updateTooltipEnergy(this.game.selectedTower);
        }
        
        // Check if energy panel is visible
        const isEnergyPanelVisible = this.elements.panelStatsContent?.style.display !== 'none' 
                                     && this.elements.statsGridEnergy?.style.display !== 'none';
        
        // Update energy building tooltip in real-time if visible
        if (this.selectedEnergyBuilding && this.elements.energyTooltip?.classList.contains('visible')) {
          this.updateEnergyTooltipRealtime(this.selectedEnergyBuilding);
        }
        
        // Update energy building stats in real-time (only if panel is visible)
        if (this.selectedEnergyBuilding && isEnergyPanelVisible) {
          this.updateBottomPanelEnergyStats(this.selectedEnergyBuilding);
        }
      });
      
      this.game.on(this.GameEvents.STATE_CHANGE, (state) => {
        this.updateUI(state);
        // Don't call renderGame() - GAME_TICK already renders every frame
      });
      
      this.game.on(this.GameEvents.TOWER_PLACED, () => {
        // Stay in placement mode for quick building
        // Player can click again to place more towers
        this.updateTowerAffordability();
      });
      
      this.game.on(this.GameEvents.TOWER_SELECTED, (data) => {
        data?.tower ? this.showTowerInfo(data.tower) : this.hideTowerInfo();
      });
      
      // Handle tower deselection - hide Magic charge panel
      this.game.on('tower:deselected', () => {
        this.hideTowerInfo();
        // Hide floating Magic charge panel
        const magicChargePanel = document.getElementById('magic-charge-panel');
        if (magicChargePanel) {
          magicChargePanel.style.display = 'none';
        }
      });
      
      // Listen for tower updates (attack type set, element set, XP gain, etc.)
      this.game.on('tower:updated', (data) => {
        // Only update bottom panel if:
        // 1. This tower is currently selected
        // 2. No energy building is selected
        // 3. Tower panel is actually visible (not build menu)
        const isTowerPanelVisible = this.elements.panelStatsContent?.style.display !== 'none' 
                                    && this.elements.statsGridTower?.style.display !== 'none';
        
        if (data?.tower && this.game.selectedTower?.id === data.tower.id 
            && !this.selectedEnergyBuilding && isTowerPanelVisible) {
          // Just update stats, don't call full showTowerInBottomPanel
          if (this.updateBottomPanelStats) {
            this.updateBottomPanelStats(data.tower);
          }
          // Also refresh upgrade prices (tower level may have changed)
          if (this.updateUpgradePrices) {
            this.updateUpgradePrices(data.tower);
          }
        }
        this.updateTowerAffordability();
      });
      
      // Listen for gold changes to update upgrade prices dynamically
      this.game.on('economy:updated', () => {
        // Don't switch UI at all - just update affordability
        // The full panel refresh should only happen on explicit selection
        this.updateTowerAffordability();
        this.updateEnergyAffordability();
        this.updateBuildItemStates?.();
        // Also update upgrade prices when gold changes (affordability)
        if (this.game?.selectedTower && this.updateUpgradePrices) {
          this.updateUpgradePrices(this.game.selectedTower);
        }
      });
      
      // Tower level up notification - refresh upgrade panel
      this.game.on('tower:level-up', (data) => {
        // Refresh upgrade prices when tower levels up (discounts change!)
        if (data?.tower && this.game?.selectedTower?.id === data.tower.id) {
          if (this.updateUpgradePrices) {
            this.updateUpgradePrices(data.tower);
          }
        }
      });
      
      this.game.on(this.GameEvents.WAVE_COMPLETE, () => {
        // Button is now only pause/resume after first wave
        this.updateTowerAffordability();
      });
      
      this.game.on(this.GameEvents.GAME_OVER, (data) => {
        // data contains {reason, level, totalXp} - get wave from game state
        const wave = this.game?.getState?.()?.wave || data.level || 0;
        this.showOverlay('Game Over!', `Reached Wave ${wave}`, 'Try Again');
        this.elements.btnStart.disabled = true;
        this.exitPlacementMode();
      });
    }
  };
}

module.exports = { GameEventsMixin };
