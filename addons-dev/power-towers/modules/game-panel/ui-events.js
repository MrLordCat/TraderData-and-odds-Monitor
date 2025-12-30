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
      
      // Re-query elements as they might not have been available during init
      el.towerItems = this.screens.game?.querySelectorAll('.tower-item') || [];
      el.attackTypeItems = this.screens.game?.querySelectorAll('.attack-type-item') || [];
      el.elementItems = this.screens.game?.querySelectorAll('.element-item') || [];
      el.energyItems = this.screens.game?.querySelectorAll('.energy-item') || [];
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
      
      // Tooltip upgrade button
      if (el.btnUpgrade) {
        el.btnUpgrade.addEventListener('click', (e) => {
          e.stopPropagation();
          this.upgradeSelectedTower();
        });
      }
      
      // Tooltip sell button
      if (el.btnSell) {
        el.btnSell.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sellSelectedTower();
        });
      }
      
      // Tooltip attack type buttons
      el.tooltipTypeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (btn.classList.contains('disabled')) return;
          const type = btn.dataset.type;
          this.setTowerAttackType(type);
        });
      });
      
      // Tooltip element buttons
      el.tooltipElementBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (btn.classList.contains('disabled')) return;
          const element = btn.dataset.element;
          this.setTowerElement(element);
        });
      });
      
      // Tower build button - single tower type
      el.towerItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.classList.contains('disabled')) return;
          
          // Exit energy placing if active
          this.exitEnergyPlacementMode();
          
          if (this.placingTower) {
            this.exitPlacementMode();
          } else {
            this.enterPlacementMode();
          }
        });
      });
      
      // Energy building buttons
      el.energyItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.classList.contains('disabled')) return;
          
          const buildingType = item.dataset.building;
          
          // Exit tower placing if active
          this.exitPlacementMode();
          
          if (this.placingEnergy && this.placingEnergyType === buildingType) {
            this.exitEnergyPlacementMode();
          } else {
            this.enterEnergyPlacementMode(buildingType);
          }
        });
      });
      
      // Attack type selection (toolbar - legacy)
      el.attackTypeItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.classList.contains('disabled')) return;
          
          const attackType = item.dataset.type;
          this.setTowerAttackType(attackType);
        });
      });
      
      // Element selection (toolbar - legacy)
      el.elementItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.classList.contains('disabled')) return;
          
          const element = item.dataset.element;
          this.setTowerElement(element);
        });
      });
    }

    /**
     * Toggle game start/pause/resume
     */
    toggleGame() {
      if (!this.game) return;
      
      if (this.game.gameOver) {
        this.restartGame();
        return;
      }
      
      // If first wave hasn't started yet, start it
      if (!this.game.firstWaveStarted) {
        this.game.startWave();
        this.elements.btnStart.textContent = '⏸ Pause';
        return;
      }

      // After first wave, button only toggles pause/resume
      if (this.game.paused) {
        this.game.resume();
        this.elements.btnStart.textContent = '⏸ Pause';
      } else {
        this.game.pause();
        this.elements.btnStart.textContent = '▶ Resume';
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
      this.elements.btnStart.textContent = '▶ Start Wave';
      this.exitPlacementMode();
    }
  };
}

module.exports = { UIEventsMixin };
