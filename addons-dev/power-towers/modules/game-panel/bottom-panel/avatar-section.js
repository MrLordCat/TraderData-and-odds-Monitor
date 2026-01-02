/**
 * Power Towers TD - Avatar Section
 * Center panel showing selected object info
 */

class AvatarSection {
  constructor(element, controller) {
    this.element = element;
    this.controller = controller;
    this.elements = {};
  }

  init() {
    if (!this.element) return;
    
    this.elements = {
      empty: this.element.querySelector('.avatar-empty'),
      content: this.element.querySelector('#avatar-content'),
      icon: this.element.querySelector('#avatar-icon'),
      name: this.element.querySelector('#avatar-name'),
      type: this.element.querySelector('#avatar-type'),
      levelText: this.element.querySelector('#avatar-level-text'),
      xpFill: this.element.querySelector('#avatar-xp-fill'),
      sellBtn: this.element.querySelector('#avatar-btn-sell')
    };

    // Setup sell button
    if (this.elements.sellBtn) {
      this.elements.sellBtn.addEventListener('click', () => this.onSell());
    }
  }

  showEmpty() {
    if (this.elements.empty) this.elements.empty.style.display = 'flex';
    if (this.elements.content) this.elements.content.style.display = 'none';
  }

  showAvatar(object, type) {
    if (this.elements.empty) this.elements.empty.style.display = 'none';
    if (this.elements.content) this.elements.content.style.display = 'flex';
    
    if (type === 'tower') {
      this.showTowerAvatar(object);
    } else if (type === 'energy') {
      this.showEnergyAvatar(object);
    }
  }

  showTowerAvatar(tower) {
    const el = this.elements;
    
    // Icon based on element
    const elementIcons = {
      fire: '🔥', ice: '❄️', lightning: '⚡',
      nature: '🌿', dark: '💀', none: '🗼'
    };
    const icon = elementIcons[tower.element] || '🗼';
    
    // Type display
    const typeLabels = {
      siege: '💥 Siege', normal: '🎯 Normal',
      magic: '✨ Magic', piercing: '🗡️ Piercing',
      base: '⚪ Base'
    };
    const typeLabel = typeLabels[tower.attackType] || '⚪ Base';
    
    if (el.icon) el.icon.textContent = icon;
    if (el.name) el.name.textContent = tower.element !== 'none' 
      ? `${tower.element.charAt(0).toUpperCase() + tower.element.slice(1)} Tower`
      : 'Tower';
    if (el.type) el.type.textContent = typeLabel;
    if (el.levelText) el.levelText.textContent = `Lvl ${tower.level || 1}`;
    
    // XP progress
    const xp = tower.xp || 0;
    const xpNeeded = tower.xpToNextLevel || 10;
    const progress = Math.min((xp / xpNeeded) * 100, 100);
    if (el.xpFill) el.xpFill.style.width = `${progress}%`;
  }

  showEnergyAvatar(building) {
    const el = this.elements;
    
    const typeIcons = {
      'base-generator': '⚡',
      'bio-generator': '🌳',
      'wind-generator': '💨',
      'solar-generator': '☀️',
      'water-generator': '💧',
      'battery': '🔋',
      'power-transfer': '🔌'
    };
    
    const typeNames = {
      'base-generator': 'Generator',
      'bio-generator': 'Bio Generator',
      'wind-generator': 'Wind Turbine',
      'solar-generator': 'Solar Panel',
      'water-generator': 'Hydro Generator',
      'battery': 'Battery',
      'power-transfer': 'Power Relay'
    };
    
    const icon = typeIcons[building.type] || '⚡';
    const name = typeNames[building.type] || 'Energy';
    
    if (el.icon) el.icon.textContent = icon;
    if (el.name) el.name.textContent = name;
    if (el.type) el.type.textContent = `⚡ Energy Building`;
    if (el.levelText) el.levelText.textContent = `Lvl ${building.level || 1}`;
    
    // XP progress for energy buildings
    const xp = building.xp || 0;
    const xpNeeded = building.xpToNextLevel || 10;
    const progress = Math.min((xp / xpNeeded) * 100, 100);
    if (el.xpFill) el.xpFill.style.width = `${progress}%`;
  }

  onSell() {
    const selected = this.controller.selectedObject;
    if (!selected) return;
    
    // Emit sell event to game controller
    if (selected.type === 'tower') {
      this.controller.gameController.sellSelectedTower?.();
    } else if (selected.type === 'energy') {
      this.controller.gameController.sellSelectedEnergyBuilding?.();
    }
  }
}

module.exports = { AvatarSection };
