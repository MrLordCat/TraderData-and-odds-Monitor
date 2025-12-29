/**
 * Power Towers TD - Menu Module
 * 
 * Manages game menu screens: Start, Upgrades, Tips, Settings.
 */

const { GameEvents } = require('../../core/event-bus');

// Menu states
const MENU_SCREENS = {
  MAIN: 'main',
  UPGRADES: 'upgrades',
  TIPS: 'tips',
  SETTINGS: 'settings'
};

class MenuModule {
  /**
   * @param {EventBus} eventBus - Event system
   * @param {object} config - Game configuration
   */
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    
    // Menu state - default to false since external UI handles menu screens
    this.isOpen = false;
    this.currentScreen = MENU_SCREENS.MAIN;
    
    // Permanent upgrades (persist between games)
    this.upgrades = {
      startingGold: { level: 0, maxLevel: 10, cost: 100, bonus: 50 },
      startingLives: { level: 0, maxLevel: 5, cost: 150, bonus: 1 },
      towerDamage: { level: 0, maxLevel: 10, cost: 200, bonusPercent: 5 },
      energyRegen: { level: 0, maxLevel: 5, cost: 175, bonusPercent: 10 }
    };
    
    // Permanent currency
    this.gems = 0;
  }

  /**
   * Initialize module
   */
  init() {
    this.eventBus.on('menu:open', () => this.openMenu());
    this.eventBus.on('menu:close', () => this.closeMenu());
    this.eventBus.on('menu:navigate', (screen) => this.navigate(screen));
    this.eventBus.on('menu:start-game', () => this.startGame());
    this.eventBus.on('menu:buy-upgrade', (upgradeId) => this.buyUpgrade(upgradeId));
    this.eventBus.on(GameEvents.GAME_OVER, (data) => this.onGameOver(data));
    
    // Load saved upgrades
    this.loadUpgrades();
  }

  /**
   * Update
   */
  update(deltaTime) {
    // Menu doesn't need per-frame updates
  }

  /**
   * Reset
   */
  reset() {
    this.isOpen = true;
    this.currentScreen = MENU_SCREENS.MAIN;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.saveUpgrades();
  }

  /**
   * Open menu
   */
  openMenu() {
    this.isOpen = true;
    this.currentScreen = MENU_SCREENS.MAIN;
    this.emitUpdate();
    this.eventBus.emit('menu:pause-game');
  }

  /**
   * Close menu
   */
  closeMenu() {
    this.isOpen = false;
    this.emitUpdate();
    this.eventBus.emit('menu:resume-game');
  }

  /**
   * Navigate to screen
   */
  navigate(screen) {
    if (Object.values(MENU_SCREENS).includes(screen)) {
      this.currentScreen = screen;
      this.emitUpdate();
    }
  }

  /**
   * Start game
   */
  startGame() {
    this.isOpen = false;
    this.emitUpdate();
    
    // Calculate starting bonuses from upgrades
    const bonuses = this.calculateBonuses();
    
    this.eventBus.emit(GameEvents.GAME_START, { bonuses });
  }

  /**
   * Calculate bonuses from permanent upgrades
   */
  calculateBonuses() {
    return {
      extraGold: this.upgrades.startingGold.level * this.upgrades.startingGold.bonus,
      extraLives: this.upgrades.startingLives.level * this.upgrades.startingLives.bonus,
      damageMultiplier: 1 + (this.upgrades.towerDamage.level * this.upgrades.towerDamage.bonusPercent / 100),
      energyRegenMultiplier: 1 + (this.upgrades.energyRegen.level * this.upgrades.energyRegen.bonusPercent / 100)
    };
  }

  /**
   * Buy upgrade
   */
  buyUpgrade(upgradeId) {
    const upgrade = this.upgrades[upgradeId];
    if (!upgrade) return false;
    
    if (upgrade.level >= upgrade.maxLevel) {
      this.eventBus.emit('menu:upgrade-failed', { reason: 'Max level reached' });
      return false;
    }
    
    const cost = this.getUpgradeCost(upgradeId);
    if (this.gems < cost) {
      this.eventBus.emit('menu:upgrade-failed', { reason: 'Not enough gems' });
      return false;
    }
    
    this.gems -= cost;
    upgrade.level++;
    
    this.saveUpgrades();
    this.emitUpdate();
    this.eventBus.emit('menu:upgrade-purchased', { upgradeId, newLevel: upgrade.level });
    
    return true;
  }

  /**
   * Get upgrade cost (scales with level)
   */
  getUpgradeCost(upgradeId) {
    const upgrade = this.upgrades[upgradeId];
    if (!upgrade) return Infinity;
    return Math.floor(upgrade.cost * Math.pow(1.5, upgrade.level));
  }

  /**
   * On game over - reward gems
   */
  onGameOver({ level, totalXp }) {
    // Award gems based on performance
    const gemsEarned = Math.floor(level * 10 + totalXp / 100);
    this.gems += gemsEarned;
    
    this.saveUpgrades();
    this.openMenu();
    
    this.eventBus.emit('menu:gems-earned', { amount: gemsEarned });
  }

  /**
   * Save upgrades to storage
   */
  saveUpgrades() {
    try {
      const data = {
        upgrades: this.upgrades,
        gems: this.gems
      };
      localStorage.setItem('powerTowers_upgrades', JSON.stringify(data));
    } catch (e) {
      // Storage might not be available
    }
  }

  /**
   * Load upgrades from storage
   */
  loadUpgrades() {
    try {
      const data = localStorage.getItem('powerTowers_upgrades');
      if (data) {
        const parsed = JSON.parse(data);
        // Merge loaded upgrades (preserve structure, update levels)
        for (const [key, value] of Object.entries(parsed.upgrades || {})) {
          if (this.upgrades[key]) {
            this.upgrades[key].level = value.level || 0;
          }
        }
        this.gems = parsed.gems || 0;
      }
    } catch (e) {
      // Storage might not be available
    }
  }

  /**
   * Emit update
   */
  emitUpdate() {
    this.eventBus.emit('menu:updated', this.getRenderData());
  }

  /**
   * Get tips content
   */
  getTips() {
    return [
      { title: '🔥 Fire Towers', text: 'High damage, medium range. Good all-around.' },
      { title: '❄️ Ice Towers', text: 'Slow enemies. Great for support.' },
      { title: '⚡ Lightning Towers', text: 'Chain attacks. Best vs groups.' },
      { title: '🌿 Nature Towers', text: 'Poison over time. Cheap and effective.' },
      { title: '💀 Dark Towers', text: 'Life drain. High cost, high reward.' },
      { title: '💡 Strategy', text: 'Mix tower types for best results.' },
      { title: '🎯 Positioning', text: 'Place towers at path corners for more shots.' },
      { title: '⚡ Energy', text: 'Save energy for tough waves.' }
    ];
  }

  /**
   * Get render data
   */
  getRenderData() {
    return {
      isOpen: this.isOpen,
      currentScreen: this.currentScreen,
      screens: MENU_SCREENS,
      upgrades: Object.entries(this.upgrades).map(([id, upgrade]) => ({
        id,
        ...upgrade,
        cost: this.getUpgradeCost(id),
        canBuy: this.gems >= this.getUpgradeCost(id) && upgrade.level < upgrade.maxLevel
      })),
      gems: this.gems,
      tips: this.getTips()
    };
  }
}

module.exports = { MenuModule, MENU_SCREENS };
