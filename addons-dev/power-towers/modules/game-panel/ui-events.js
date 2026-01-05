/**
 * Power Towers TD - UI Event Handlers
 * Handles button clicks and toolbar interactions
 */

/**
 * Mixin for UI event functionality
 * @param {Class} Base - GameController base class
 */
function UIEventsMixin(Base) {
  return class extends Base {
    /**
     * Setup UI event listeners
     */
    setupUIEvents() {
      const el = this.elements;
      
      // Re-query elements for bottom panel build cards
      el.buildItems = this.screens.game?.querySelectorAll('.build-card') || [];
      el.tooltipTypeBtns = el.towerTooltip?.querySelectorAll('.tooltip-type-btn') || [];
      el.tooltipElementBtns = el.towerTooltip?.querySelectorAll('.tooltip-element-btn') || [];
      
      el.btnStart.addEventListener('click', () => this.toggleGame());
      el.overlayBtn.addEventListener('click', () => this.restartGame());
      
      // Tooltip close button
      if (el.tooltipClose) {
        el.tooltipClose.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deselectTower();
        });
      }
      
      // Energy tooltip close button
      if (el.energyTooltipClose) {
        el.energyTooltipClose.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hideEnergyBuildingInfo();
        });
      }
      
      // Energy tooltip sell button
      if (el.energyBtnSell) {
        el.energyBtnSell.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sellSelectedEnergyBuilding();
        });
      }
      
      // Energy tooltip connect button
      if (el.energyBtnConnect) {
        el.energyBtnConnect.addEventListener('click', (e) => {
          e.stopPropagation();
          this.startEnergyConnectionMode();
        });
      }
      
      // Energy tooltip upgrade button (toggle upgrades panel)
      if (el.energyBtnUpgrade) {
        el.energyBtnUpgrade.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleEnergyUpgradesPanel();
        });
      }
      
      // Energy upgrade stat buttons
      if (el.energyUpgradeBtns) {
        el.energyUpgradeBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btn.classList.contains('disabled')) return;
            const stat = btn.dataset.stat;
            this.upgradeEnergyBuildingStat(stat);
          });
        });
      }
      
      // Build card clicks now handled in game-controller.js setupBuildCardEvents()
    }

    /**
     * Toggle game start/pause/resume
     */
    toggleGame() {
      console.log('[toggleGame] called');
      console.log('[toggleGame] this.game:', this.game);
      if (!this.game) {
        console.log('[toggleGame] no game, return');
        return;
      }
      
      console.log('[toggleGame] game.gameOver:', this.game.gameOver);
      console.log('[toggleGame] game.firstWaveStarted:', this.game.firstWaveStarted);
      console.log('[toggleGame] game.paused:', this.game.paused);
      
      if (this.game.gameOver) {
        console.log('[toggleGame] -> restartGame()');
        this.restartGame();
        return;
      }
      
      // If first wave hasn't started yet, start it
      if (!this.game.firstWaveStarted) {
        console.log('[toggleGame] -> startWave()');
        this.game.startWave();
        this.elements.btnStart.innerHTML = '⏸ Pause <span class="hotkey-hint">[Space]</span>';
        return;
      }

      // After first wave, button only toggles pause/resume
      if (this.game.paused) {
        console.log('[toggleGame] -> resume()');
        this.game.resume();
        this.elements.btnStart.innerHTML = '⏸ Pause <span class="hotkey-hint">[Space]</span>';
      } else {
        console.log('[toggleGame] -> pause()');
        this.game.pause();
        this.elements.btnStart.innerHTML = '▶ Resume <span class="hotkey-hint">[Space]</span>';
      }
    }

    /**
     * Restart game
     */
    restartGame() {
      this.hideOverlay();
      
      // Cleanup existing game
      if (this.game) {
        this.game.destroy();
        this.game = null;
      }
      
      // Create new game
      this.game = new this.GameCore();
      
      // Re-create renderer with current canvas size
      if (this.canvas && this.camera) {
        this.renderer = new this.GameRenderer(this.canvas, this.camera);
      }
      
      // Center on base (last waypoint)
      const waypoints = this.game.waypoints;
      if (waypoints && waypoints.length > 0 && this.camera) {
        const basePos = waypoints[waypoints.length - 1];
        this.camera.centerOn(basePos.x, basePos.y);
      }
      
      this.setupGameEvents();
      this.renderGame();
      this.updateUI(this.game.getState());
      
      this.elements.btnStart.disabled = false;
      this.elements.btnStart.innerHTML = '▶ Start Wave <span class="hotkey-hint">[Space]</span>';
      this.exitPlacementMode();
    }
  };
}

module.exports = { UIEventsMixin };
