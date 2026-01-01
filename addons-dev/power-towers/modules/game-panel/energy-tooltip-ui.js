/**
 * Power Towers TD - Energy Tooltip UI Mixin
 * Handles energy building tooltip, upgrades, and connections
 */

const { 
  updateBiomeSection,
  formatPercent,
  formatInt,
  createDetailBuilder
} = require('./utils');

// Building names map
const BUILDING_NAMES = {
  'base-generator': 'Basic Generator',
  'bio-generator': 'Bio Generator',
  'wind-generator': 'Wind Turbine',
  'solar-generator': 'Solar Panel',
  'water-generator': 'Hydro Generator',
  'battery': 'Battery',
  'power-transfer': 'Relay'
};

// Type display names
const TYPE_NAMES = {
  'base-generator': 'Generator',
  'bio-generator': 'Bio Generator',
  'wind-generator': 'Wind Generator',
  'solar-generator': 'Solar Generator',
  'water-generator': 'Hydro Generator',
  'battery': 'Storage',
  'power-transfer': 'Relay'
};

// Base upgrade costs
const BASE_UPGRADE_COSTS = {
  capacity: 20,
  outputRate: 25,
  range: 30,
  channels: 50
};

// Max upgrade levels
const MAX_UPGRADE_LEVELS = {
  capacity: 5,
  outputRate: 5,
  range: 5
};

/**
 * Calculate upgrade cost for energy building
 */
function calculateEnergyUpgradeCost(stat, currentLevel) {
  const baseCost = BASE_UPGRADE_COSTS[stat] || 20;
  return Math.floor(baseCost * Math.pow(1.5, currentLevel));
}

/**
 * Mixin for energy tooltip UI functionality
 * @param {Class} Base - GameController base class
 */
function EnergyTooltipMixin(Base) {
  return class extends Base {
    
    // =============================================
    // Energy Building Tooltip
    // =============================================
    
    /**
     * Show energy building info tooltip
     */
    showEnergyBuildingInfo(building) {
      const el = this.elements;
      if (!el.energyTooltip || !this.camera) return;
      
      this.selectedEnergyBuilding = building;
      
      // Update icon
      const { BUILDING_ICONS } = require('../../modules/energy/building-defs');
      if (el.energyTooltipIcon) {
        el.energyTooltipIcon.textContent = BUILDING_ICONS[building.type] || '⚡';
      }
      
      // Update name
      if (el.energyTooltipName) {
        el.energyTooltipName.textContent = BUILDING_NAMES[building.type] || building.type;
      }
      
      // Update level with XP bar
      if (el.energyTooltipLevel) {
        el.energyTooltipLevel.textContent = `Lvl ${building.level || 1}`;
        const xpProgress = building.getXpProgress?.() || { current: 0, needed: 10, percent: 0 };
        el.energyTooltipLevel.title = `XP: ${xpProgress.current}/${xpProgress.needed} (${formatInt(xpProgress.percent)}%)`;
      }
      
      // Update level progress bar
      const xpProgress = building.getXpProgress?.() || { current: 0, needed: 10, percent: 0 };
      if (el.energyLevelProgress) {
        el.energyLevelProgress.style.width = `${Math.min(100, xpProgress.percent)}%`;
      }
      if (el.energyLevelText) {
        el.energyLevelText.textContent = `${xpProgress.current}/${xpProgress.needed} XP`;
      }
      
      // Update type
      if (el.energyTooltipType) {
        el.energyTooltipType.textContent = TYPE_NAMES[building.type] || 'Unknown';
      }
      
      // Update connections
      if (el.energyTooltipConnections) {
        const energyModule = this.game.getModule('energy');
        const connections = energyModule?.getConnectionsCount?.(building.id) || 0;
        el.energyTooltipConnections.textContent = `${connections} links`;
      }
      
      // Update stored
      if (el.energyTooltipStored) {
        const stored = formatInt(building.stored || 0);
        const capacity = formatInt(building.getEffectiveCapacity?.() || building.capacity || 100);
        el.energyTooltipStored.textContent = `${stored}/${capacity}`;
      }
      
      // Update output
      if (el.energyTooltipOutput) {
        const outputRate = building.getEffectiveOutputRate?.() || building.outputRate || 0;
        el.energyTooltipOutput.textContent = `${outputRate.toFixed(1)}/s`;
      }
      
      // Update range
      if (el.energyTooltipRange) {
        const range = building.getEffectiveRange?.() || building.range || 0;
        el.energyTooltipRange.textContent = `${range} cells`;
      }
      
      // Show/hide generator rows
      const isGenerator = building.nodeType === 'generator';
      if (el.energyTooltipGenRow) {
        el.energyTooltipGenRow.style.display = isGenerator ? '' : 'none';
        if (isGenerator && el.energyTooltipGen) {
          el.energyTooltipGen.textContent = `${building.generation?.toFixed(1) || 0}/s`;
        }
      }
      
      // Efficiency row
      if (el.energyTooltipEffRow) {
        const state = building.getState?.() || {};
        const hasEfficiency = state.efficiency !== undefined && isGenerator;
        el.energyTooltipEffRow.style.display = hasEfficiency ? '' : 'none';
        if (hasEfficiency && el.energyTooltipEff) {
          el.energyTooltipEff.textContent = formatPercent(state.efficiency - 1);
        }
      }
      
      // Special stats row
      this.updateEnergySpecialStats(building);
      
      // Biome section
      this.updateEnergyBiomeSection(building);
      
      // Detail popups
      this.updateEnergyDetailPopups(building);
      
      // Position tooltip
      this.positionEnergyTooltip(building);
      
      this.energyTooltipBuildingPosition = { x: building.gridX, y: building.gridY };
    }
    
    /**
     * Update special stats (trees, wind, water, biome)
     */
    updateEnergySpecialStats(building) {
      const el = this.elements;
      const state = building.getState?.() || {};
      
      // Determine if we have special stats
      const hasSpecial = state.treesUsed !== undefined || 
                        state.generationMin !== undefined ||
                        state.waterTiles !== undefined ||
                        (state.currentBiome !== undefined && building.biomeEfficiency);
      
      if (el.energyTooltipSpecialRow) {
        el.energyTooltipSpecialRow.style.display = hasSpecial ? '' : 'none';
      }
      
      if (!hasSpecial || !el.energyTooltipSpecial) return;
      
      let specialText = null;
      
      if (state.treesUsed !== undefined) {
        // Bio Generator
        specialText = `${state.treesUsed}/${building.maxTrees || 12}`;
      } else if (state.generationMin !== undefined && state.generationMax !== undefined) {
        // Wind Generator
        const biomeName = state.currentBiome || 'default';
        specialText = `${formatInt(state.generationMin)}-${formatInt(state.generationMax)} (${biomeName})`;
      } else if (state.waterTiles !== undefined) {
        // Hydro Generator
        specialText = `${state.waterTiles}/${building.maxWaterTiles || 9}`;
      } else if (state.currentBiome !== undefined && building.biomeEfficiency) {
        // Solar Generator
        const effPct = building.biomeEfficiency?.[state.currentBiome] || 1;
        specialText = `${state.currentBiome} (${formatPercent(effPct - 1)})`;
      }
      
      if (specialText) {
        el.energyTooltipSpecial.textContent = specialText;
      }
    }
    
    /**
     * Update biome section display
     */
    updateEnergyBiomeSection(building) {
      const el = this.elements;
      if (!el.energyBiomeSection) return;
      
      const state = building.getState?.() || {};
      const biomeType = building.biomeType || state.currentBiome || 'default';
      const biomeModifiers = building.biomeModifiers || {};
      const nearbyBiomes = building.nearbyBiomes || [];
      
      el.energyBiomeSection.style.display = 'flex';
      
      updateBiomeSection(
        { icon: el.energyBiomeIcon, name: el.energyBiomeName, bonus: el.energyBiomeBonus },
        biomeType,
        { nearbyBiomes, modifiers: biomeModifiers }
      );
    }
    
    /**
     * Position energy tooltip near building
     */
    positionEnergyTooltip(building) {
      const el = this.elements;
      if (!el.energyTooltip || !this.camera) return;
      
      const screenPos = this.camera.worldToScreen(building.worldX, building.worldY);
      const containerRect = this.canvasContainer.getBoundingClientRect();
      
      let left = screenPos.x + 30;
      let top = screenPos.y - 50;
      
      // Keep within bounds
      if (left + 200 > containerRect.width) {
        left = screenPos.x - 220;
      }
      if (top < 10) top = 10;
      if (top + 200 > containerRect.height) {
        top = containerRect.height - 210;
      }
      
      el.energyTooltip.style.left = `${left}px`;
      el.energyTooltip.style.top = `${top}px`;
      el.energyTooltip.classList.add('visible');
    }
    
    /**
     * Update energy building detail popups with calculation info
     */
    updateEnergyDetailPopups(building) {
      if (!building) return;
      
      const el = this.elements;
      const level = building.level || 1;
      const upgrades = building.upgradeLevels || {};
      const state = building.getState?.() || {};
      const levelBonus = 1 + (level - 1) * 0.02; // +2% per level
      
      // ===== Stored Energy Detail =====
      if (el.energyDetailStored) {
        const stored = formatInt(building.stored || 0);
        const baseCap = building.baseCapacity || 100;
        const capacity = formatInt(building.capacity || baseCap);
        const capUpgrade = upgrades.capacity || 0;
        
        const builder = createDetailBuilder()
          .line('Current:', `${stored}/${capacity}`)
          .base('Base cap:', baseCap)
          .level(level, levelBonus)
          .when(capUpgrade > 0, () => `.upgrade('Upgrades', capUpgrade, 10, 1 + capUpgrade * 0.1)`)
          .final(capacity)
          .formula('Base × Lvl% × Upg%');
        
        // Manual build for complex case
        el.energyDetailStored.innerHTML = `
          <div class="detail-line"><span class="detail-label">Current:</span><span class="detail-value">${stored}/${capacity}</span></div>
          <div class="detail-line"><span class="detail-label">Base cap:</span><span class="detail-base">${baseCap}</span></div>
          <div class="detail-line"><span class="detail-label">Level ${level} (${formatPercent(levelBonus - 1)}):</span><span class="detail-level">×${levelBonus.toFixed(2)}</span></div>
          ${capUpgrade > 0 ? `<div class="detail-line"><span class="detail-label">Upgrades Lv.${capUpgrade} (+${capUpgrade * 10}%):</span><span class="detail-upgrade">×${(1 + capUpgrade * 0.1).toFixed(2)}</span></div>` : ''}
          <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${capacity}</span></div>
          <div class="detail-formula">Base × Lvl% × Upg%</div>
        `;
      }
      
      // ===== Output Rate Detail =====
      if (el.energyDetailOutput) {
        const baseOutput = building.baseOutputRate || 10;
        const output = building.outputRate || baseOutput;
        const outputUpgrade = upgrades.outputRate || 0;
        const afterLevel = baseOutput * levelBonus;
        const afterUpg = afterLevel * (1 + outputUpgrade * 0.05);
        
        el.energyDetailOutput.innerHTML = `
          <div class="detail-line"><span class="detail-label">Base:</span><span class="detail-base">${baseOutput.toFixed(1)}/s</span></div>
          <div class="detail-line"><span class="detail-label">Level ${level} (${formatPercent(levelBonus - 1)}):</span><span class="detail-level">${afterLevel.toFixed(2)}/s</span></div>
          ${outputUpgrade > 0 ? `<div class="detail-line"><span class="detail-label">Upgrades Lv.${outputUpgrade} (+${outputUpgrade * 5}%):</span><span class="detail-upgrade">${afterUpg.toFixed(2)}/s</span></div>` : ''}
          <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${output.toFixed(1)}/s</span></div>
          <div class="detail-formula">Base × Lvl% × Upg%</div>
        `;
      }
      
      // ===== Range Detail =====
      if (el.energyDetailRange) {
        const baseRange = building.baseRange || 4;
        const range = building.range || baseRange;
        const rangeUpgrade = upgrades.range || 0;
        const afterLevel = baseRange + Math.floor((level - 1) * 0.2);
        const final = afterLevel + rangeUpgrade;
        
        el.energyDetailRange.innerHTML = `
          <div class="detail-line"><span class="detail-label">Base:</span><span class="detail-base">${baseRange}</span></div>
          <div class="detail-line"><span class="detail-label">Level ${level} (+${Math.floor((level - 1) * 0.2)}):</span><span class="detail-level">${afterLevel}</span></div>
          ${rangeUpgrade > 0 ? `<div class="detail-line"><span class="detail-label">Upgrades Lv.${rangeUpgrade} (+${rangeUpgrade}):</span><span class="detail-upgrade">${final}</span></div>` : ''}
          <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${range}</span></div>
          <div class="detail-formula">Base + LvlBonus + Upg</div>
        `;
      }
      
      // ===== Generation Detail (for generators) =====
      if (el.energyDetailGen && building.nodeType === 'generator') {
        const baseGen = building.generation || 5;
        const rawBioMod = state.currentBiome ? building.biomeModifiers?.[state.currentBiome] : 1;
        const bioMod = typeof rawBioMod === 'number' ? rawBioMod : 1;
        const afterLevel = baseGen * levelBonus;
        const afterBio = afterLevel * bioMod;
        const biomeName = state.currentBiome ? state.currentBiome.toUpperCase() : 'None';
        
        el.energyDetailGen.innerHTML = `
          <div class="detail-line"><span class="detail-label">Base:</span><span class="detail-base">${baseGen.toFixed(1)}/s</span></div>
          <div class="detail-line"><span class="detail-label">Level ${level} (${formatPercent(levelBonus - 1)}):</span><span class="detail-level">${afterLevel.toFixed(2)}/s</span></div>
          ${bioMod !== 1 ? `<div class="detail-line"><span class="detail-label">Biome ${biomeName} (×${bioMod.toFixed(2)}):</span><span class="detail-value ${bioMod > 1 ? 'bonus' : 'penalty'}">${afterBio.toFixed(2)}/s</span></div>` : ''}
          <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${(building.getEffectiveGeneration?.() || baseGen).toFixed(1)}/s</span></div>
          <div class="detail-formula">Base × Lvl% × BiomeMod</div>
        `;
      }
      
      // ===== Efficiency Detail (for generators) =====
      if (el.energyDetailEfficiency && building.nodeType === 'generator') {
        const baseEff = state.efficiency !== undefined ? state.efficiency : 1;
        const biomeName = state.currentBiome ? state.currentBiome.toUpperCase() : 'Default';
        const rawBioBonus = state.currentBiome ? building.biomeModifiers?.[state.currentBiome] : 1;
        const bioBonus = typeof rawBioBonus === 'number' ? rawBioBonus : 1;
        
        el.energyDetailEfficiency.innerHTML = `
          <div class="detail-line"><span class="detail-label">Base:</span><span class="detail-base">100%</span></div>
          <div class="detail-line"><span class="detail-label">Biome ${biomeName}:</span><span class="detail-value ${bioBonus > 1 ? 'bonus' : 'penalty'}">${formatPercent(bioBonus - 1, true)}</span></div>
          <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${formatPercent(baseEff - 1, true)}</span></div>
          <div class="detail-formula">Base × BiomeBonus</div>
        `;
      }
      
      // ===== Special Stats Detail =====
      this.updateEnergySpecialDetail(building);
    }
    
    /**
     * Update special stats detail popup
     */
    updateEnergySpecialDetail(building) {
      const el = this.elements;
      if (!el.energyDetailSpecial || el.energyTooltipSpecialRow?.style.display === 'none') return;
      
      const state = building.getState?.() || {};
      let detailHTML = '';
      
      if (state.treesUsed !== undefined) {
        // Bio Generator
        detailHTML = `
          <div class="detail-line"><span class="detail-label">Trees nearby:</span><span class="detail-value">${state.treesUsed}</span></div>
          <div class="detail-line"><span class="detail-label">Max capacity:</span><span class="detail-base">${building.maxTrees || 12}</span></div>
          <div class="detail-formula">Used / Max</div>
        `;
      } else if (state.generationMin !== undefined) {
        // Wind Generator
        detailHTML = `
          <div class="detail-line"><span class="detail-label">Range:</span><span class="detail-value">${formatInt(state.generationMin)}-${formatInt(state.generationMax)}/s</span></div>
          <div class="detail-line"><span class="detail-label">Biome:</span><span class="detail-base">${state.currentBiome || 'default'}</span></div>
          <div class="detail-formula">Depends on terrain</div>
        `;
      } else if (state.waterTiles !== undefined) {
        // Hydro Generator
        detailHTML = `
          <div class="detail-line"><span class="detail-label">Water tiles:</span><span class="detail-value">${state.waterTiles}</span></div>
          <div class="detail-line"><span class="detail-label">Max capacity:</span><span class="detail-base">${building.maxWaterTiles || 9}</span></div>
          <div class="detail-formula">Gen rate × tiles</div>
        `;
      } else if (state.currentBiome !== undefined && building.biomeEfficiency) {
        // Solar Generator
        const bioMod = building.biomeEfficiency?.[state.currentBiome] || 1;
        detailHTML = `
          <div class="detail-line"><span class="detail-label">Current biome:</span><span class="detail-value">${state.currentBiome}</span></div>
          <div class="detail-line"><span class="detail-label">Efficiency:</span><span class="detail-base ${bioMod > 1 ? 'bonus' : bioMod < 1 ? 'penalty' : ''}">${formatPercent(bioMod - 1, true)}</span></div>
          <div class="detail-formula">Based on terrain</div>
        `;
      }
      
      if (detailHTML) {
        el.energyDetailSpecial.innerHTML = detailHTML;
      }
    }
    
    /**
     * Update energy tooltip in realtime (while visible)
     */
    updateEnergyTooltipRealtime(building) {
      if (!building || !this.elements.energyTooltip?.classList.contains('visible')) return;
      
      const el = this.elements;
      
      // ===== Update Level (if changed) =====
      if (el.energyTooltipLevel) {
        const levelText = `Lvl ${building.level || 1}`;
        if (el.energyTooltipLevel.textContent !== levelText) {
          el.energyTooltipLevel.textContent = levelText;
        }
      }
      
      // ===== Update Level Progress Bar =====
      const xpProgress = building.getXpProgress?.() || { current: 0, needed: 10, percent: 0 };
      if (el.energyLevelProgress) {
        el.energyLevelProgress.style.width = `${Math.min(100, xpProgress.percent)}%`;
      }
      if (el.energyLevelText) {
        el.energyLevelText.textContent = `${xpProgress.current}/${xpProgress.needed} XP`;
      }
      
      // ===== Update Effective Stats =====
      if (el.energyTooltipOutput) {
        const outputRate = building.getEffectiveOutputRate?.() || building.outputRate || 0;
        el.energyTooltipOutput.textContent = `${outputRate.toFixed(1)}/s`;
      }
      
      if (el.energyTooltipRange) {
        const range = building.getEffectiveRange?.() || building.range || 0;
        el.energyTooltipRange.textContent = `${range} cells`;
      }
      
      if (el.energyTooltipStored) {
        const stored = formatInt(building.stored || 0);
        const capacity = formatInt(building.getEffectiveCapacity?.() || building.capacity || 100);
        el.energyTooltipStored.textContent = `${stored}/${capacity}`;
      }
      
      if (el.energyTooltipGen && building.nodeType === 'generator' && building.generation !== undefined) {
        const generation = building.getEffectiveGeneration?.() || building.generation || 0;
        el.energyTooltipGen.textContent = `${generation.toFixed(1)}/s`;
      }
      
      if (el.energyTooltipEff) {
        const state = building.getState?.() || {};
        if (state.efficiency !== undefined) {
          el.energyTooltipEff.textContent = formatPercent(state.efficiency - 1, true);
        }
      }
      
      // ===== Update special stats =====
      this.updateEnergySpecialStats(building);
      
      // ===== Update Biome Section =====
      this.updateEnergyBiomeSection(building);
      
      // ===== Update connections count =====
      if (el.energyTooltipConnections) {
        const energyModule = this.game.getModule('energy');
        const connections = energyModule?.getConnectionsCount?.(building.id) || 0;
        el.energyTooltipConnections.textContent = `${connections} links`;
      }
      
      // Update detail popups
      this.updateEnergyDetailPopups(building);
    }
    
    /**
     * Hide energy building tooltip
     */
    hideEnergyBuildingInfo() {
      const el = this.elements;
      if (el.energyTooltip) {
        el.energyTooltip.classList.remove('visible');
      }
      this.selectedEnergyBuilding = null;
      this.energyTooltipBuildingPosition = null;
    }
    
    // =============================================
    // Energy Building Actions
    // =============================================
    
    /**
     * Sell selected energy building
     */
    sellSelectedEnergyBuilding() {
      if (!this.selectedEnergyBuilding || !this.game) return;
      
      const building = this.selectedEnergyBuilding;
      const energyModule = this.game.getModule('energy');
      const economy = this.game.getModule('economy');
      
      if (energyModule && economy) {
        const { ENERGY_BUILDINGS } = require('../../modules/energy/building-defs');
        const def = ENERGY_BUILDINGS[building.type];
        const sellPrice = Math.floor((def?.cost || 50) * 0.5);
        
        energyModule.removeBuilding(building.id);
        economy.addGold(sellPrice);
        
        this.hideEnergyBuildingInfo();
        this.updateUI(this.game.getState());
        this.renderGame();
      }
    }
    
    /**
     * Toggle energy upgrades panel
     */
    toggleEnergyUpgradesPanel() {
      const el = this.elements;
      if (!el.energyUpgradesSection) return;
      
      const isHidden = el.energyUpgradesSection.style.display === 'none';
      el.energyUpgradesSection.style.display = isHidden ? 'block' : 'none';
      
      if (el.energyBtnUpgrade) {
        el.energyBtnUpgrade.classList.toggle('active', isHidden);
      }
      
      if (isHidden && this.selectedEnergyBuilding) {
        this.updateEnergyUpgradesCosts();
      }
    }
    
    /**
     * Update energy upgrades costs display
     */
    updateEnergyUpgradesCosts() {
      if (!this.selectedEnergyBuilding || !this.game) return;
      
      const building = this.selectedEnergyBuilding;
      const gold = this.game.getState().gold || 0;
      const el = this.elements;
      
      const maxLevels = {
        ...MAX_UPGRADE_LEVELS,
        channels: building.maxChannelUpgrades || 4
      };
      
      const upgrades = building.upgrades || { capacity: 0, outputRate: 0, range: 0, channels: 0 };
      
      // Show/hide channels button for Relay only
      const channelsBtn = el.energyUpgradesGrid?.querySelector('[data-stat="channels"]');
      if (channelsBtn) {
        channelsBtn.style.display = building.type === 'power-transfer' ? '' : 'none';
      }
      
      Object.keys(BASE_UPGRADE_COSTS).forEach(stat => {
        const level = upgrades[stat] || 0;
        const maxLevel = maxLevels[stat] || 5;
        const cost = calculateEnergyUpgradeCost(stat, level);
        const canAfford = gold >= cost;
        const atMax = level >= maxLevel;
        
        const costEl = el.energyUpgradesGrid?.querySelector(`[data-stat="${stat}"] .stat-cost`);
        if (costEl) {
          costEl.textContent = atMax ? 'MAX' : `Lv${level + 1} ${cost}g`;
          costEl.style.color = atMax ? '#a0aec0' : (canAfford ? '#ffd700' : '#fc8181');
        }
        
        const btn = el.energyUpgradesGrid?.querySelector(`[data-stat="${stat}"]`);
        if (btn) {
          btn.classList.toggle('disabled', !canAfford || atMax);
        }
      });
    }
    
    /**
     * Upgrade energy building stat
     */
    upgradeEnergyBuildingStat(stat) {
      if (!this.selectedEnergyBuilding || !this.game) return;
      
      const building = this.selectedEnergyBuilding;
      const economy = this.game.getModule('economy');
      if (!economy) return;
      
      const maxLevels = {
        ...MAX_UPGRADE_LEVELS,
        channels: building.maxChannelUpgrades || 4
      };
      
      const upgrades = building.upgrades || { capacity: 0, outputRate: 0, range: 0, channels: 0 };
      const level = upgrades[stat] || 0;
      const maxLevel = maxLevels[stat] || 5;
      const cost = calculateEnergyUpgradeCost(stat, level);
      
      if (!economy.canAfford(cost)) return;
      if (level >= maxLevel) return;
      
      economy.spendGold(cost);
      
      if (building.upgrade) {
        building.upgrade(stat);
      } else {
        building.upgrades = building.upgrades || { capacity: 0, outputRate: 0, range: 0 };
        building.upgrades[stat]++;
      }
      
      console.log(`[EnergyTooltip] Upgraded ${stat} to level ${building.upgrades[stat]}`);
      
      this.showEnergyBuildingInfo(building);
      this.updateEnergyUpgradesCosts();
      this.updateUI(this.game.getState());
      this.renderGame();
    }
    
    // =============================================
    // Energy Connection Mode
    // =============================================
    
    /**
     * Start energy connection mode
     */
    startEnergyConnectionMode() {
      if (!this.selectedEnergyBuilding || !this.game) return;
      
      const energyModule = this.game.getModule('energy');
      if (!energyModule) return;
      
      this.connectingFromBuilding = this.selectedEnergyBuilding;
      this.isConnectingEnergy = true;
      
      const el = this.elements;
      if (el.energyBtnConnect) {
        el.energyBtnConnect.textContent = '❌ Cancel';
        el.energyBtnConnect.classList.add('active');
      }
      
      const range = this.connectingFromBuilding.getEffectiveRange?.() || this.connectingFromBuilding.range || 4;
      
      this.game.eventBus?.emit('ui:toast', { 
        message: `Click building or tower within ${range} cells to connect`, 
        type: 'info' 
      });
      
      this.renderGame();
    }
    
    /**
     * Cancel energy connection mode
     */
    cancelEnergyConnectionMode() {
      this.connectingFromBuilding = null;
      this.isConnectingEnergy = false;
      
      const el = this.elements;
      if (el.energyBtnConnect) {
        el.energyBtnConnect.textContent = '🔗 Connect';
        el.energyBtnConnect.classList.remove('active');
      }
    }
    
    /**
     * Complete energy connection to building
     */
    completeEnergyConnection(targetBuilding) {
      if (!this.connectingFromBuilding || !targetBuilding || !this.game) return;
      
      const energyModule = this.game.getModule('energy');
      if (!energyModule) return;
      
      const from = this.connectingFromBuilding;
      const to = targetBuilding;
      
      if (from.id === to.id) {
        this.cancelEnergyConnectionMode();
        return;
      }
      
      const dx = from.gridX - to.gridX;
      const dy = from.gridY - to.gridY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxRange = Math.max(from.range || 4, to.range || 4);
      
      if (distance > maxRange) {
        this.game.eventBus?.emit('ui:toast', { 
          message: 'Buildings too far apart!', 
          type: 'error' 
        });
        this.cancelEnergyConnectionMode();
        return;
      }
      
      const result = energyModule.connectBuildings?.(from.id, to.id);
      
      if (result === 'disconnected') {
        this.game.eventBus?.emit('ui:toast', { message: 'Connection removed', type: 'info' });
      } else if (result !== false) {
        this.game.eventBus?.emit('ui:toast', { message: 'Connection established!', type: 'success' });
      }
      
      this.cancelEnergyConnectionMode();
      this.renderGame();
    }
    
    /**
     * Complete energy connection to tower
     */
    completeEnergyConnectionToTower(tower) {
      if (!this.connectingFromBuilding || !tower || !this.game) return;
      
      const energyModule = this.game.getModule('energy');
      if (!energyModule) return;
      
      const from = this.connectingFromBuilding;
      
      const dx = from.gridX - tower.gridX;
      const dy = from.gridY - tower.gridY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxRange = from.range || 4;
      
      if (distance > maxRange) {
        this.game.eventBus?.emit('ui:toast', { 
          message: 'Tower too far from energy building!', 
          type: 'error' 
        });
        this.cancelEnergyConnectionMode();
        return;
      }
      
      const result = energyModule.connectTower?.(from.id, tower);
      
      if (result === 'disconnected') {
        this.game.eventBus?.emit('ui:toast', { message: '⚡ Tower disconnected from power', type: 'info' });
      } else if (result) {
        this.game.eventBus?.emit('ui:toast', { message: '⚡ Tower connected to power!', type: 'success' });
      } else {
        this.game.eventBus?.emit('ui:toast', { message: 'Failed to connect tower', type: 'error' });
      }
      
      this.cancelEnergyConnectionMode();
      this.renderGame();
    }
  };
}

module.exports = { EnergyTooltipMixin };
