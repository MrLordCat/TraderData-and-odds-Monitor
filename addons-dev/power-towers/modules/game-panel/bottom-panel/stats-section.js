/**
 * Power Towers TD - Stats Section
 * Left panel showing selected object stats
 */

class StatsSection {
  constructor(element, controller) {
    this.element = element;
    this.controller = controller;
    this.elements = {};
  }

  init() {
    if (!this.element) return;
    
    this.elements = {
      empty: this.element.querySelector('.panel-stats-empty'),
      content: this.element.querySelector('#panel-stats-content'),
      towerGrid: this.element.querySelector('#stats-grid-tower'),
      energyGrid: this.element.querySelector('#stats-grid-energy'),
      // Tower stats
      dmg: this.element.querySelector('#panel-dmg'),
      rng: this.element.querySelector('#panel-rng'),
      spd: this.element.querySelector('#panel-spd'),
      crit: this.element.querySelector('#panel-crit'),
      critdmg: this.element.querySelector('#panel-critdmg'),
      power: this.element.querySelector('#panel-power'),
      // Energy stats
      stored: this.element.querySelector('#panel-stored'),
      output: this.element.querySelector('#panel-output'),
      range: this.element.querySelector('#panel-range'),
      gen: this.element.querySelector('#panel-gen')
    };
  }

  showEmpty() {
    if (this.elements.empty) this.elements.empty.style.display = 'flex';
    if (this.elements.content) this.elements.content.style.display = 'none';
  }

  showStats(object, type) {
    if (this.elements.empty) this.elements.empty.style.display = 'none';
    if (this.elements.content) this.elements.content.style.display = 'block';
    
    if (type === 'tower') {
      this.showTowerStats(object);
    } else if (type === 'energy') {
      this.showEnergyStats(object);
    }
  }

  showTowerStats(tower) {
    if (this.elements.towerGrid) this.elements.towerGrid.style.display = 'grid';
    if (this.elements.energyGrid) this.elements.energyGrid.style.display = 'none';
    
    this.updateTowerStats(tower);
  }

  showEnergyStats(building) {
    if (this.elements.towerGrid) this.elements.towerGrid.style.display = 'none';
    if (this.elements.energyGrid) this.elements.energyGrid.style.display = 'grid';
    
    this.updateEnergyStats(building);
  }

  updateStats(object, type) {
    if (type === 'tower') {
      this.updateTowerStats(object);
    } else if (type === 'energy') {
      this.updateEnergyStats(object);
    }
  }

  updateTowerStats(tower) {
    const el = this.elements;
    if (!tower) return;
    
    const stats = tower.getStats ? tower.getStats() : tower;
    
    if (el.dmg) el.dmg.textContent = Math.round(stats.damage || 0);
    if (el.rng) el.rng.textContent = Math.round(stats.range || 0);
    if (el.spd) el.spd.textContent = (stats.attackSpeed || 1).toFixed(1);
    if (el.crit) el.crit.textContent = `${Math.round((stats.critChance || 0) * 100)}%`;
    if (el.critdmg) el.critdmg.textContent = `${Math.round((stats.critDamage || 1.5) * 100)}%`;
    if (el.power) el.power.textContent = Math.round(stats.energyCost || 5);
  }

  updateEnergyStats(building) {
    const el = this.elements;
    if (!building) return;
    
    const stored = building.storedEnergy || 0;
    const capacity = building.capacity || 50;
    const genRate = building.generationRate || 0;
    const outputRate = building.outputRate || 15;
    const range = building.connectionRange || 4;
    
    if (el.stored) el.stored.textContent = `${Math.round(stored)}/${capacity}`;
    if (el.output) el.output.textContent = `${outputRate}/s`;
    if (el.range) el.range.textContent = Math.round(range / 32); // Convert to tiles
    if (el.gen) el.gen.textContent = `${genRate.toFixed(1)}/s`;
  }
}

module.exports = { StatsSection };
