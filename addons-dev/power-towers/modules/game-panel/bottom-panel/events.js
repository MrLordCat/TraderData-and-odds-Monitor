/**
 * Power Towers TD - Bottom Panel Events
 * Event handlers for the bottom panel UI
 */

/**
 * Mixin for bottom panel event handling
 * @param {Class} Base - Base class
 */
function BottomPanelEventsMixin(Base) {
  return class extends Base {
    
    /**
     * Setup bottom panel event listeners
     */
    setupBottomPanelEvents() {
      const el = this.elements;
      if (!el.bottomPanel) {
        console.warn('[BottomPanel] NO bottomPanel element! Aborting setup.');
        return;
      }
      
      // Build grid items - support both old .build-item and new .build-card
      el.buildItems = el.bottomPanel.querySelectorAll('.build-item, .build-card');
      
      el.buildItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const type = item.dataset.type;
          const building = item.dataset.building;
          
          if (type === 'tower') {
            this.enterPlacementMode();
            this.updateBuildItemStates();
          } else if (type === 'energy') {
            this.enterEnergyPlacementMode(building);
            this.updateBuildItemStates();
          }
        });
      });
      
      // Avatar sell button
      if (el.avatarBtnSell) {
        el.avatarBtnSell.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.game?.selectedTower) {
            this.sellSelectedTower();
          } else if (this.selectedEnergyBuilding) {
            this.sellSelectedEnergyBuilding();
          }
        });
      }
      
      // Pause menu buttons
      if (el.pauseBtnResume) {
        el.pauseBtnResume.addEventListener('click', () => this.closePauseMenu());
      }
      if (el.pauseBtnSettings) {
        el.pauseBtnSettings.addEventListener('click', () => {
          // TODO: Open settings
        });
      }
      if (el.pauseBtnQuit) {
        el.pauseBtnQuit.addEventListener('click', () => this.quitToMenu());
      }
      
      // ESC key handler
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (this.currentScreen === 'game' && this.game) {
            this.togglePauseMenu();
          }
        }
        // Space - Start/Resume wave (also closes pause menu)
        if (e.key === ' ' || e.code === 'Space') {
          if (this.currentScreen === 'game') {
            e.preventDefault();
            // If pause menu is open, close it first
            const pauseMenu = this.elements.pauseMenuOverlay;
            if (pauseMenu && pauseMenu.style.display !== 'none') {
              this.closePauseMenu();
              return;
            }
            this.toggleGame();
          }
        }
      });
      
      // Energy panel actions
      if (el.actionConnect) {
        el.actionConnect.addEventListener('click', (e) => {
          e.stopPropagation();
          this.startEnergyConnectionMode();
        });
      }
      if (el.actionUpgradeEnergy) {
        el.actionUpgradeEnergy.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleEnergyUpgradesPanel_Bottom();
        });
      }
      
      // Energy upgrade buttons in bottom panel
      const energyUpgradeBtns = el.bottomPanel?.querySelectorAll('#energy-upgrades-panel .action-btn[data-stat]') || [];
      energyUpgradeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (btn.classList.contains('disabled')) return;
          const stat = btn.dataset.stat;
          this.upgradeEnergyBuildingStat(stat);
        });
      });
      
      // Tower action cards (attack type)
      const attackTypeCards = el.bottomPanel?.querySelectorAll('[data-action="attack-type"]') || [];
      attackTypeCards.forEach(card => {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          if (card.classList.contains('disabled')) return;
          const type = card.dataset.type;
          this.setTowerAttackType(type);
        });
      });
      
      // Tower action cards (element)
      const elementCards = el.bottomPanel?.querySelectorAll('[data-action="element"]') || [];
      elementCards.forEach(card => {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          if (card.classList.contains('disabled')) return;
          const element = card.dataset.element;
          this.setTowerElement(element);
        });
      });
    }
    
    /**
     * Toggle pause menu
     */
    togglePauseMenu() {
      const el = this.elements;
      if (!el.pauseMenuOverlay) return;
      
      const isVisible = el.pauseMenuOverlay.style.display !== 'none';
      
      if (isVisible) {
        this.closePauseMenu();
      } else {
        this.openPauseMenu();
      }
    }
    
    /**
     * Open pause menu
     */
    openPauseMenu() {
      const el = this.elements;
      if (!el.pauseMenuOverlay) return;
      
      // Pause game
      if (this.game && !this.game.paused) {
        this.game.pause();
      }
      
      el.pauseMenuOverlay.style.display = 'flex';
    }
    
    /**
     * Close pause menu
     */
    closePauseMenu() {
      const el = this.elements;
      if (!el.pauseMenuOverlay) return;
      
      el.pauseMenuOverlay.style.display = 'none';
      
      // Resume game
      if (this.game && this.game.paused) {
        this.game.resume();
      }
      
      this.updateUI(this.game?.getState() || {});
    }
    
    /**
     * Quit to main menu
     */
    quitToMenu() {
      this.closePauseMenu();
      
      // Cleanup game
      if (this.game) {
        this.game.destroy();
        this.game = null;
      }
      
      // Show menu screen
      this.showScreen('menu');
    }
    
    /**
     * Update build item states based on affordability
     */
    updateBuildItemStates() {
      const el = this.elements;
      const gold = this.game?.getState().gold || 0;
      
      el.buildItems?.forEach(item => {
        const type = item.dataset.type;
        const building = item.dataset.building;
        let cost = 0;
        
        if (type === 'tower') {
          cost = this.CONFIG?.TOWER_COST || 50;
        } else if (type === 'energy') {
          const defs = this.game?.getModule('energy')?.getBuildingDefinitions() || {};
          cost = defs[building]?.cost || 50;
        }
        
        const canAfford = gold >= cost;
        item.classList.toggle('disabled', !canAfford);
        
        // Update placing state
        if (this.placingTower && type === 'tower') {
          item.classList.add('placing');
        } else if (this.placingEnergy === building) {
          item.classList.add('placing');
        } else {
          item.classList.remove('placing');
        }
      });
    }
    
    /**
     * Hide bottom panel selection (show build grid)
     */
    hideBottomPanelSelection() {
      const el = this.elements;
      
      // Reset stats section
      if (el.panelStatsEmpty) el.panelStatsEmpty.style.display = 'flex';
      if (el.panelStatsContent) el.panelStatsContent.style.display = 'none';
      
      // Reset avatar
      if (el.avatarEmpty) el.avatarEmpty.style.display = 'flex';
      if (el.avatarContent) el.avatarContent.style.display = 'none';
      
      // Show build grid (flex for new layout)
      if (el.actionsBuild) el.actionsBuild.style.display = 'flex';
      if (el.actionsTower) el.actionsTower.style.display = 'none';
      if (el.actionsEnergy) el.actionsEnergy.style.display = 'none';
      
      this.updateBuildItemStates();
    }
  };
}

module.exports = { BottomPanelEventsMixin };
