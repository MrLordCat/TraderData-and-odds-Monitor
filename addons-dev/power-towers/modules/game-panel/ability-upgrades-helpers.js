/**
 * Power Towers TD - Ability Upgrades UI
 * 
 * Handles the UI for element-specific ability upgrades.
 * Shows abilities and their upgrade options based on tower's element path.
 */

const { ELEMENT_ABILITIES, getAbilityUpgradeCost, getElementAbilities } = require('../../core/element-abilities');

/**
 * Generate HTML for ability upgrades panel
 * @param {Object} tower - Tower instance
 * @param {number} gold - Current gold
 * @returns {string} HTML string
 */
function generateAbilityUpgradesHTML(tower, gold) {
  const elementPath = tower.elementPath;
  if (!elementPath || !ELEMENT_ABILITIES[elementPath]) {
    return `<div class="ability-empty">
      <p>⚠️ Choose an element first to unlock abilities</p>
    </div>`;
  }
  
  const elementConfig = ELEMENT_ABILITIES[elementPath];
  const towerUpgrades = tower.abilityUpgrades || {};
  const abilities = getElementAbilities(elementPath, towerUpgrades);
  
  let html = `
    <div class="ability-header">
      <span class="ability-icon">${elementConfig.icon}</span>
      <span class="ability-title">${elementConfig.name} Abilities</span>
    </div>
    <p class="ability-desc">${elementConfig.description}</p>
    <div class="ability-upgrades-grid">
  `;
  
  // Generate upgrade buttons
  for (const [upgradeId, upgrade] of Object.entries(elementConfig.upgrades)) {
    const currentLevel = towerUpgrades[upgradeId] || 0;
    const maxLevel = upgrade.maxLevel;
    const cost = getAbilityUpgradeCost(elementPath, upgradeId, currentLevel);
    const canAfford = gold >= cost;
    const isMaxed = currentLevel >= maxLevel;
    
    // Calculate current value
    const baseConfig = ELEMENT_ABILITIES[elementPath];
    const [category, stat] = upgrade.stat.split('.');
    let currentValue = 0;
    if (baseConfig[category] && baseConfig[category][stat] !== undefined) {
      currentValue = baseConfig[category][stat] + (upgrade.valuePerLevel * currentLevel);
    }
    
    // Format value for display
    let valueDisplay = formatUpgradeValue(upgrade, currentValue, currentLevel);
    let nextValueDisplay = formatUpgradeValue(upgrade, currentValue + upgrade.valuePerLevel, currentLevel + 1);
    
    html += `
      <div class="ability-upgrade-item ${isMaxed ? 'maxed' : ''} ${!canAfford && !isMaxed ? 'disabled' : ''}"
           data-upgrade="${upgradeId}"
           data-element="${elementPath}"
           data-cost="${cost}">
        <div class="ability-upgrade-header">
          <span class="upgrade-icon">${upgrade.icon}</span>
          <span class="upgrade-name">${upgrade.name}</span>
          <span class="upgrade-level">${currentLevel}/${maxLevel}</span>
        </div>
        <div class="ability-upgrade-desc">
          ${upgrade.description.replace('{value}', formatValueDelta(upgrade))}
        </div>
        <div class="ability-upgrade-current">
          Current: <strong>${valueDisplay}</strong>
          ${!isMaxed ? `→ <span class="upgrade-next">${nextValueDisplay}</span>` : ''}
        </div>
        <div class="ability-upgrade-cost">
          ${isMaxed ? '<span class="maxed-text">MAXED</span>' : `<span class="cost ${canAfford ? '' : 'unaffordable'}">💰 ${cost}</span>`}
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  
  return html;
}

/**
 * Format upgrade value for display
 */
function formatUpgradeValue(upgrade, value, level) {
  const stat = upgrade.stat;
  
  // Percent-based stats
  if (stat.includes('Percent') || stat.includes('Chance') || stat.includes('Reduction') || stat.includes('Amplify') || stat.includes('Falloff')) {
    return `${Math.round(value * 100)}%`;
  }
  
  // Duration stats
  if (stat.includes('Duration') || stat.includes('duration')) {
    return `${value.toFixed(1)}s`;
  }
  
  // Integer stats (stacks, targets, etc.)
  if (stat.includes('Stacks') || stat.includes('Targets') || stat.includes('targets')) {
    return Math.round(value).toString();
  }
  
  // Default numeric
  return value.toFixed(1);
}

/**
 * Format the value delta for description
 */
function formatValueDelta(upgrade) {
  const value = Math.abs(upgrade.valuePerLevel);
  const stat = upgrade.stat;
  
  if (stat.includes('Percent') || stat.includes('Chance') || stat.includes('Reduction') || stat.includes('Amplify') || stat.includes('Falloff')) {
    return `${Math.round(value * 100)}%`;
  }
  
  if (stat.includes('Duration') || stat.includes('duration')) {
    return `${value.toFixed(1)}s`;
  }
  
  if (stat.includes('Stacks') || stat.includes('Targets') || stat.includes('targets')) {
    return Math.round(value).toString();
  }
  
  return value.toFixed(1);
}

/**
 * Generate CSS styles for ability upgrades
 */
function getAbilityUpgradesStyles() {
  return `
    .tooltip-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 4px;
    }
    
    .tooltip-tab {
      flex: 1;
      padding: 6px 8px;
      background: rgba(0,0,0,0.3);
      border: none;
      border-radius: 4px 4px 0 0;
      color: rgba(255,255,255,0.6);
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
    }
    
    .tooltip-tab:hover {
      background: rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.8);
    }
    
    .tooltip-tab.active {
      background: rgba(255,255,255,0.15);
      color: #fff;
      border-bottom: 2px solid #4ecdc4;
    }
    
    .tooltip-tab-content {
      display: none;
    }
    
    .tooltip-tab-content.active {
      display: block;
    }
    
    .ability-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .ability-icon {
      font-size: 20px;
    }
    
    .ability-title {
      font-weight: bold;
      font-size: 14px;
    }
    
    .ability-desc {
      font-size: 11px;
      color: rgba(255,255,255,0.7);
      margin-bottom: 12px;
    }
    
    .ability-empty {
      text-align: center;
      padding: 20px;
      color: rgba(255,255,255,0.5);
    }
    
    .ability-upgrades-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .ability-upgrade-item {
      background: rgba(0,0,0,0.3);
      border-radius: 6px;
      padding: 8px;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
    }
    
    .ability-upgrade-item:hover:not(.maxed):not(.disabled) {
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.2);
    }
    
    .ability-upgrade-item.maxed {
      opacity: 0.7;
      cursor: default;
    }
    
    .ability-upgrade-item.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .ability-upgrade-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    
    .upgrade-icon {
      font-size: 14px;
    }
    
    .upgrade-name {
      font-weight: bold;
      font-size: 12px;
      flex: 1;
    }
    
    .upgrade-level {
      font-size: 10px;
      color: rgba(255,255,255,0.6);
      background: rgba(0,0,0,0.3);
      padding: 2px 6px;
      border-radius: 10px;
    }
    
    .ability-upgrade-desc {
      font-size: 10px;
      color: rgba(255,255,255,0.7);
      margin-bottom: 4px;
    }
    
    .ability-upgrade-current {
      font-size: 10px;
      color: rgba(255,255,255,0.8);
      margin-bottom: 4px;
    }
    
    .upgrade-next {
      color: #4ecdc4;
    }
    
    .ability-upgrade-cost {
      text-align: right;
    }
    
    .ability-upgrade-cost .cost {
      font-size: 11px;
      color: #f7b731;
    }
    
    .ability-upgrade-cost .cost.unaffordable {
      color: #fc5c65;
    }
    
    .ability-upgrade-cost .maxed-text {
      font-size: 10px;
      color: #4ecdc4;
      font-weight: bold;
    }
    
    /* Lightning charge slider */
    .lightning-charge-section {
      margin-top: 12px;
      padding: 8px;
      background: rgba(255, 215, 0, 0.1);
      border-radius: 6px;
      border: 1px solid rgba(255, 215, 0, 0.3);
    }
    
    .lightning-charge-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .lightning-charge-title {
      font-weight: bold;
      font-size: 12px;
      color: #ffd700;
    }
    
    .lightning-charge-value {
      font-size: 14px;
      font-weight: bold;
      color: #ffd700;
    }
    
    .lightning-charge-slider {
      width: 100%;
      height: 8px;
      border-radius: 4px;
      background: rgba(0,0,0,0.5);
      -webkit-appearance: none;
      appearance: none;
      cursor: pointer;
    }
    
    .lightning-charge-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #ffd700;
      cursor: pointer;
      box-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
    }
    
    .lightning-charge-info {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 10px;
      color: rgba(255,255,255,0.7);
    }
    
    .lightning-cost {
      color: #ffd700;
    }
    
    .lightning-damage {
      color: #fc5c65;
    }
  `;
}

/**
 * Generate lightning charge slider HTML
 * @param {Object} tower - Tower instance
 * @returns {string} HTML string or empty if not lightning
 */
function generateLightningChargeHTML(tower) {
  if (tower.elementPath !== 'lightning') return '';
  
  const chargeTarget = tower.lightningChargeTarget || 50;
  const abilities = getElementAbilities('lightning', tower.abilityUpgrades);
  const chargeConfig = abilities?.charge || { baseCost: 20, costExponent: 2.5, damageExponent: 2.0 };
  
  // Calculate cost and damage at current target
  const cost = Math.round(chargeConfig.baseCost * Math.pow(1 + chargeTarget / 100, chargeConfig.costExponent));
  const damageMult = Math.pow(1 + chargeTarget / 100, chargeConfig.damageExponent);
  
  return `
    <div class="lightning-charge-section">
      <div class="lightning-charge-header">
        <span class="lightning-charge-title">⚡ Charge Target</span>
        <span class="lightning-charge-value">${chargeTarget}%</span>
      </div>
      <input type="range" 
             class="lightning-charge-slider" 
             data-tower-id="${tower.id}"
             min="0" max="100" step="5" 
             value="${chargeTarget}">
      <div class="lightning-charge-info">
        <span class="lightning-cost">Energy: ${cost}</span>
        <span class="lightning-damage">Damage: x${damageMult.toFixed(2)}</span>
      </div>
    </div>
  `;
}

module.exports = {
  generateAbilityUpgradesHTML,
  generateLightningChargeHTML,
  getAbilityUpgradesStyles,
  formatUpgradeValue,
};
