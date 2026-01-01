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
        
        // Update tooltip energy display in real-time if visible
        if (this.game.selectedTower && this.elements.towerTooltip?.classList.contains('visible')) {
          this.updateTooltipEnergy(this.game.selectedTower);
        }
        
        // Update energy building tooltip in real-time if visible
        if (this.selectedEnergyBuilding && this.elements.energyTooltip?.classList.contains('visible')) {
          this.updateEnergyTooltipRealtime(this.selectedEnergyBuilding);
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
      
      // Listen for tower updates (attack type set, element set, XP gain, etc.)
      this.game.on('tower:updated', (data) => {
        // Only update if this tower is currently selected and tooltip is visible
        if (data?.tower && this.game.selectedTower?.id === data.tower.id) {
          // Use updateTowerInfo to refresh without closing upgrades panel
          this.updateTowerInfo(data.tower);
        }
        this.updateTowerAffordability();
      });
      
      // Listen for gold changes to update upgrade prices dynamically
      this.game.on('economy:updated', () => {
        const tower = this.game?.selectedTower;
        if (tower && this.elements.tooltipUpgradesSection?.style.display !== 'none') {
          this.populateUpgradesGrid(tower);
        }
        this.updateTowerAffordability();
        this.updateEnergyAffordability();
      });
      
      // Tower level up notification
      this.game.on('tower:level-up', (data) => {
        console.log(`Tower leveled up to ${data.newLevel}!`);
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
