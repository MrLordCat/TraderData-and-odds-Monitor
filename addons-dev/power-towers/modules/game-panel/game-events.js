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
      
      // Render on every game tick
      this.game.on(this.GameEvents.GAME_TICK, () => {
        this.renderGame();
        this.updateUI(this.game.getState());
      });
      
      this.game.on(this.GameEvents.STATE_CHANGE, (state) => {
        this.updateUI(state);
        this.renderGame();
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
