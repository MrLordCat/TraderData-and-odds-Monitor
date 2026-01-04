/**
 * Power Towers TD - Build Section
 * Right panel with build menu and actions
 */

class BuildSection {
  constructor(element, controller) {
    this.element = element;
    this.controller = controller;
    this.elements = {};
    this.currentMode = 'build'; // 'build', 'tower-actions', 'energy-actions'
  }

  init() {
    if (!this.element) return;
    
    this.elements = {
      buildMenu: this.element.querySelector('#build-menu'),
      towerActions: this.element.querySelector('#actions-tower'),
      energyActions: this.element.querySelector('#actions-energy'),
      // Build cards
      buildCards: this.element.querySelectorAll('.build-card'),
      // Tower action buttons
      upgradesBtn: this.element.querySelector('#action-upgrades'),
      abilitiesBtn: this.element.querySelector('#action-abilities'),
      upgradesPanel: this.element.querySelector('#upgrades-panel'),
      abilitiesPanel: this.element.querySelector('#abilities-panel'),
      // Energy action buttons
      connectBtn: this.element.querySelector('#action-connect'),
      upgradeEnergyBtn: this.element.querySelector('#action-upgrade-energy'),
      energyUpgradesPanel: this.element.querySelector('#energy-upgrades-panel')
    };

    this.setupBuildCards();
    this.setupActionButtons();
  }

  setupBuildCards() {
    this.elements.buildCards.forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onBuildCardClick(card);
      });
    });
  }

  setupActionButtons() {
    const el = this.elements;
    
    // Tower actions
    if (el.upgradesBtn) {
      el.upgradesBtn.addEventListener('click', () => this.togglePanel('upgrades'));
    }
    if (el.abilitiesBtn) {
      el.abilitiesBtn.addEventListener('click', () => this.togglePanel('abilities'));
    }
    
    // Energy actions
    if (el.connectBtn) {
      el.connectBtn.addEventListener('click', () => this.onConnect());
    }
    if (el.upgradeEnergyBtn) {
      el.upgradeEnergyBtn.addEventListener('click', () => this.togglePanel('energy-upgrades'));
    }
  }

  onBuildCardClick(card) {
    const type = card.dataset.type;
    const building = card.dataset.building;
    
    // Clear previous placing state
    this.elements.buildCards.forEach(c => c.classList.remove('placing'));
    
    // Set placing state
    card.classList.add('placing');
    
    // Notify game controller
    const gc = this.controller.gameController;
    if (type === 'tower') {
      gc.enterPlacementMode?.();
    } else if (type === 'energy') {
      gc.enterEnergyPlacementMode?.(building);
    }
  }

  togglePanel(panelName) {
    const el = this.elements;
    
    // Hide all panels
    if (el.upgradesPanel) el.upgradesPanel.style.display = 'none';
    if (el.abilitiesPanel) el.abilitiesPanel.style.display = 'none';
    if (el.energyUpgradesPanel) el.energyUpgradesPanel.style.display = 'none';
    
    // Reset button states
    if (el.upgradesBtn) el.upgradesBtn.classList.remove('active');
    if (el.abilitiesBtn) el.abilitiesBtn.classList.remove('active');
    if (el.upgradeEnergyBtn) el.upgradeEnergyBtn.classList.remove('active');
    
    // Show selected panel
    if (panelName === 'upgrades' && el.upgradesPanel) {
      el.upgradesPanel.style.display = 'block';
      el.upgradesBtn?.classList.add('active');
    } else if (panelName === 'abilities' && el.abilitiesPanel) {
      el.abilitiesPanel.style.display = 'block';
      el.abilitiesBtn?.classList.add('active');
    } else if (panelName === 'energy-upgrades' && el.energyUpgradesPanel) {
      el.energyUpgradesPanel.style.display = 'block';
      el.upgradeEnergyBtn?.classList.add('active');
    }
  }

  onConnect() {
    this.controller.gameController.startEnergyConnectionMode?.();
  }

  showBuildMenu() {
    this.currentMode = 'build';
    
    if (this.elements.buildMenu) this.elements.buildMenu.style.display = 'flex';
    if (this.elements.towerActions) this.elements.towerActions.style.display = 'none';
    if (this.elements.energyActions) this.elements.energyActions.style.display = 'none';
    
    // Clear placing state
    this.elements.buildCards.forEach(c => c.classList.remove('placing'));
    
    // Update affordability
    this.updateAffordability();
  }

  showActions(object, type) {
    if (type === 'tower') {
      this.showTowerActions(object);
    } else if (type === 'energy') {
      this.showEnergyActions(object);
    }
  }

  showTowerActions(tower) {
    this.currentMode = 'tower-actions';
    
    if (this.elements.buildMenu) this.elements.buildMenu.style.display = 'none';
    if (this.elements.towerActions) this.elements.towerActions.style.display = 'flex';
    if (this.elements.energyActions) this.elements.energyActions.style.display = 'none';
    
    // Show/hide abilities button based on element
    if (this.elements.abilitiesBtn) {
      const hasElement = tower.element && tower.element !== 'none';
      this.elements.abilitiesBtn.style.display = hasElement ? 'flex' : 'none';
    }
    
    // Default to upgrades panel
    this.togglePanel('upgrades');
  }

  showEnergyActions(building) {
    this.currentMode = 'energy-actions';
    
    if (this.elements.buildMenu) this.elements.buildMenu.style.display = 'none';
    if (this.elements.towerActions) this.elements.towerActions.style.display = 'none';
    if (this.elements.energyActions) this.elements.energyActions.style.display = 'flex';
  }

  updateAffordability() {
    const gold = this.controller.getGold();
    
    this.elements.buildCards.forEach(card => {
      const priceText = card.querySelector('.build-card-price')?.textContent || '0';
      const price = parseInt(priceText) || 0;
      const canAfford = gold >= price;
      
      card.classList.toggle('disabled', !canAfford);
    });
  }

  clearPlacingState() {
    this.elements.buildCards.forEach(c => c.classList.remove('placing'));
  }
}

module.exports = { BuildSection };
