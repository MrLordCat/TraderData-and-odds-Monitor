/**
 * Power Towers TD - Tower Tooltip Handler
 * Manages floating tooltip display for tower info
 */

const { TOWER_LEVEL_CONFIG, calculateTowerLevel } = require('../../core/tower-upgrades');

const ATTACK_TYPE_EMOJIS = {
  base: '⚪',
  siege: '💥',
  normal: '🎯',
  magic: '✨',
  piercing: '🗡️'
};

const ELEMENT_EMOJIS = {
  fire: '🔥',
  ice: '❄️',
  lightning: '⚡',
  nature: '🌿',
  dark: '💀'
};

/**
 * Mixin for tower tooltip functionality
 * @param {Class} Base - GameController base class
 */
function TowerTooltipMixin(Base) {
  return class extends Base {
    /**
     * Update tower tooltip without closing upgrades panel
     * Used for real-time updates (XP gain, etc.)
     */
    updateTowerInfo(tower) {
      const el = this.elements;
      if (!el.towerTooltip || !el.towerTooltip.classList.contains('visible')) return;
      
      // Just update the data, don't touch panel visibility
      this.refreshTooltipData(tower);
      
      // Update upgrades grid if visible
      if (el.tooltipUpgradesSection?.style.display !== 'none') {
        this.populateUpgradesGrid(tower);
      }
    }
    
    /**
     * Show tower tooltip near the tower (full show with panel reset)
     */
    showTowerInfo(tower) {
      const el = this.elements;
      if (!el.towerTooltip || !this.camera) return;
      
      // Hide upgrades panel when switching towers
      if (el.tooltipUpgradesSection) {
        el.tooltipUpgradesSection.style.display = 'none';
      }
      if (el.btnUpgrade) {
        el.btnUpgrade.classList.remove('active');
      }
      
      // Refresh all tooltip data
      this.refreshTooltipData(tower);
      
      // Position tooltip near the tower
      this.positionTooltipNearTower(tower);
      
      // Show tooltip
      el.towerTooltip.classList.add('visible');
      
      // Store tower position for re-positioning during camera movement
      this.tooltipTowerPosition = { x: tower.gridX, y: tower.gridY };
      
      // Update attack type section visibility and buttons
      this.updateTooltipSections(tower);
      
      // Update affordability for upgrade buttons
      this.updateTowerAffordability();
    }
    
    /**
     * Refresh tooltip data only (shared by show and update)
     */
    refreshTooltipData(tower) {
      const el = this.elements;
      
      // Update tower icon
      if (el.tooltipIcon) {
        el.tooltipIcon.textContent = tower.elementEmoji || ATTACK_TYPE_EMOJIS[tower.attackTypeId] || '🏗️';
      }
      
      // Update tower name based on attack type and element
      if (el.tooltipName) {
        let name = 'Base Tower';
        if (tower.attackTypeId && tower.attackTypeId !== 'base') {
          name = tower.attackTypeId.charAt(0).toUpperCase() + tower.attackTypeId.slice(1);
          if (tower.elementPath) {
            const elemName = tower.elementPath.charAt(0).toUpperCase() + tower.elementPath.slice(1);
            name = `${elemName} ${name}`;
          }
          name += ' Tower';
        }
        el.tooltipName.textContent = name;
      }
      
      // Update level and progress
      if (el.tooltipLevel) {
        el.tooltipLevel.textContent = `Lvl ${tower.level || 1}`;
      }
      
      // Update level progress bar
      this.updateLevelProgress(tower);
      
      // Update attack type display
      if (el.tooltipAttackType) {
        const attackEmoji = ATTACK_TYPE_EMOJIS[tower.attackTypeId] || '⚪';
        const attackName = tower.attackTypeId?.charAt(0).toUpperCase() + tower.attackTypeId?.slice(1) || 'Base';
        el.tooltipAttackType.textContent = `${attackEmoji} ${attackName}`;
      }
      
      // Update element display
      if (el.tooltipElement) {
        if (tower.elementPath) {
          const elemEmoji = ELEMENT_EMOJIS[tower.elementPath] || '';
          const elemName = tower.elementPath.charAt(0).toUpperCase() + tower.elementPath.slice(1);
          el.tooltipElement.textContent = `${elemEmoji} ${elemName}`;
        } else {
          el.tooltipElement.textContent = '—';
        }
      }
      
      // Update Biome Section - show icons only, names on hover, detailed popup
      if (el.towerBiomeSection) {
        const biomeType = tower.biomeType || tower.terrainType || 'default';
        const dmgMod = tower.terrainDamageBonus || tower.terrainBonus || 1;
        const rngMod = tower.terrainRangeBonus || 1;
        const nearbyBiomes = tower.nearbyBiomes || [];
        const breakdown = tower.biomeBreakdown;
        
        // Always show biome section
        el.towerBiomeSection.style.display = 'flex';
        
        // Biome icons and names
        const biomeData = {
          'forest': { icon: '🌲', name: 'Forest' },
          'mountains': { icon: '⛰️', name: 'Mountains' },
          'desert': { icon: '🏜️', name: 'Desert' },
          'water': { icon: '🌊', name: 'Water' },
          'swamp': { icon: '🌿', name: 'Swamp' },
          'tundra': { icon: '❄️', name: 'Tundra' },
          'plains': { icon: '🌾', name: 'Plains' },
          'elevated': { icon: '🏔️', name: 'Elevated' },
          'burned': { icon: '🔥', name: 'Burned' },
          'default': { icon: '🗺️', name: 'Unknown' }
        };
        
        // Build icons - show main + borders with actual effects
        const mainBiome = biomeData[biomeType] || biomeData['default'];
        let iconsText = mainBiome.icon;
        let titleText = mainBiome.name;
        
        // Only show border biomes that have actual effects (from breakdown)
        if (breakdown && breakdown.borders && breakdown.borders.length > 0) {
          for (const border of breakdown.borders) {
            const nbData = biomeData[border.biome] || biomeData['default'];
            iconsText += nbData.icon;
            titleText += ` + ${border.name}`;
          }
        }
        
        if (el.towerBiomeIcons) {
          el.towerBiomeIcons.textContent = iconsText;
          el.towerBiomeIcons.title = titleText;
        }
        
        // Show all biome bonuses (DMG and RNG)
        if (el.towerBiomeBonus) {
          const bonuses = [];
          if (dmgMod !== 1) {
            const dmgPct = Math.round((dmgMod - 1) * 100);
            bonuses.push(`${dmgPct >= 0 ? '+' : ''}${dmgPct}% DMG`);
          }
          if (rngMod !== 1) {
            const rngPct = Math.round((rngMod - 1) * 100);
            bonuses.push(`${rngPct >= 0 ? '+' : ''}${rngPct}% RNG`);
          }
          
          if (bonuses.length > 0) {
            el.towerBiomeBonus.textContent = bonuses.join(', ');
            el.towerBiomeBonus.classList.toggle('penalty', (dmgMod < 1 || rngMod < 1));
          } else {
            el.towerBiomeBonus.textContent = '—';
            el.towerBiomeBonus.classList.remove('penalty');
          }
        }
        
        // Build detailed biome popup
        if (el.detailBiome) {
          el.detailBiome.innerHTML = this.buildBiomeDetailPopup(tower, biomeData);
        }
      }
      
      // Update stats with detail popups
      this.updateStatWithDetails(tower);
    }
    
    /**
     * Update all stats with detail popup information
     */
    updateStatWithDetails(tower) {
      const el = this.elements;
      const attackType = tower.attackTypeConfig || { dmgMod: 1, rangeMod: 1, atkSpdMod: 1, energyCostMod: 1 };
      const level = tower.level || 1;
      const levelBonus = 1 + (level - 1) * 0.01;
      const upgrades = tower.upgradeLevels || {};
      
      // Get biome bonuses
      const dmgBiomeBonus = tower.terrainDamageBonus || tower.terrainBonus || 1;
      const rngBiomeBonus = tower.terrainRangeBonus || 1;
      
      // ============ DAMAGE ============
      const baseDmg = tower.baseDamage || 10;
      const leveledDmg = baseDmg * levelBonus;
      const afterTypeDmg = leveledDmg * attackType.dmgMod;
      const upgradeBonus = upgrades.damage ? upgrades.damage * 0.05 : 0;
      const finalDmg = afterTypeDmg * (1 + upgradeBonus);
      
      if (el.tooltipDmg) el.tooltipDmg.textContent = Math.floor(tower.damage || finalDmg);
      const detailDmg = document.getElementById('detail-dmg');
      if (detailDmg) {
        detailDmg.innerHTML = this.buildDetailPopup('DMG', baseDmg, level, attackType.dmgMod, upgrades.damage, tower.damage, false, 0.05, dmgBiomeBonus);
      }
      
      // ============ RANGE ============
      const baseRng = tower.baseRange || 70;
      if (el.tooltipRng) el.tooltipRng.textContent = Math.floor(tower.range || 0);
      const detailRng = document.getElementById('detail-rng');
      if (detailRng) {
        detailRng.innerHTML = this.buildDetailPopup('RNG', baseRng, level, attackType.rangeMod, upgrades.range, tower.range, false, 0.05, rngBiomeBonus);
      }
      
      // ============ SPEED ============
      const baseSpd = tower.baseFireRate || 1;
      if (el.tooltipSpd) el.tooltipSpd.textContent = (tower.fireRate || 1).toFixed(1);
      const detailSpd = document.getElementById('detail-spd');
      if (detailSpd) {
        detailSpd.innerHTML = this.buildDetailPopup('SPD', baseSpd, level, attackType.atkSpdMod, upgrades.attackSpeed, tower.fireRate, true, 0.04);
      }
      
      // ============ CRIT CHANCE ============
      const baseCrit = (attackType.critChance || tower.baseCritChance || 0.05) * 100;
      const critUpgrades = upgrades.critChance || 0;
      const finalCrit = tower.critChance || 0.05;
      if (el.tooltipCrit) el.tooltipCrit.textContent = `${Math.round(finalCrit * 100)}%`;
      const detailCrit = document.getElementById('detail-crit');
      if (detailCrit) {
        detailCrit.innerHTML = `
          <div class="detail-line"><span class="detail-label">Base:</span><span class="detail-base">${baseCrit.toFixed(0)}%</span></div>
          <div class="detail-line"><span class="detail-label">Upgrades (+${critUpgrades}%):</span><span class="detail-upgrade">+${critUpgrades}%</span></div>
          <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${Math.round(finalCrit * 100)}%</span></div>
          <div class="detail-formula">Base + Upgrades (cap 75%)</div>
        `;
      }
      
      // ============ CRIT DAMAGE ============
      const baseCritDmg = (attackType.critDmgMod || tower.baseCritDmgMod || 1.5) * 100;
      const critDmgUpgrades = upgrades.critDamage || 0;
      const finalCritDmg = tower.critDmgMod || 1.5;
      if (el.tooltipCritdmg) el.tooltipCritdmg.textContent = `${Math.round(finalCritDmg * 100)}%`;
      const detailCritDmg = document.getElementById('detail-critdmg');
      if (detailCritDmg) {
        detailCritDmg.innerHTML = `
          <div class="detail-line"><span class="detail-label">Base:</span><span class="detail-base">${baseCritDmg.toFixed(0)}%</span></div>
          <div class="detail-line"><span class="detail-label">Upgrades (+${critDmgUpgrades * 10}%):</span><span class="detail-upgrade">+${critDmgUpgrades * 10}%</span></div>
          <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${Math.round(finalCritDmg * 100)}%</span></div>
          <div class="detail-formula">Base + (Lv × 10%)</div>
        `;
      }
      
      // ============ SPLASH ============
      // Note: Splash does NOT get level bonus, only upgrade bonus
      if (el.tooltipSplashRow && el.tooltipSplash) {
        if (tower.splashRadius && tower.splashRadius > 0) {
          el.tooltipSplashRow.style.display = '';
          el.tooltipSplash.textContent = Math.floor(tower.splashRadius);
          const detailSplash = document.getElementById('detail-splash');
          if (detailSplash) {
            const baseSplash = attackType.splashRadius || 0;
            const splashUpgLv = upgrades.splashRadius || 0;
            const splashUpgBonus = splashUpgLv * 0.08;
            detailSplash.innerHTML = `
              <div class="detail-line"><span class="detail-label">Base:</span><span class="detail-base">${Math.floor(baseSplash)}</span></div>
              <div class="detail-line"><span class="detail-label">Upgrades Lv.${splashUpgLv} (+${(splashUpgBonus * 100).toFixed(0)}%):</span><span class="detail-upgrade">${Math.floor(baseSplash * (1 + splashUpgBonus))}</span></div>
              <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${Math.floor(tower.splashRadius)}</span></div>
              <div class="detail-formula">Base × Upg% (no level bonus)</div>
            `;
          }
        } else {
          el.tooltipSplashRow.style.display = 'none';
        }
      }
      
      // ============ HP ============
      const baseHp = tower.baseHp || 100;
      const hpMult = tower.hpMultiplier || 1;
      if (el.tooltipHp) {
        el.tooltipHp.textContent = `${Math.floor(tower.currentHp || 0)}/${Math.floor(tower.maxHp || 100)}`;
      }
      const detailHp = document.getElementById('detail-hp');
      if (detailHp) {
        const hpUpgradeBonus = upgrades.hp ? upgrades.hp * 0.08 : 0;
        detailHp.innerHTML = `
          <div class="detail-line"><span class="detail-label">Base:</span><span class="detail-base">${baseHp}</span></div>
          <div class="detail-line"><span class="detail-label">HP Multi:</span><span class="detail-value">×${hpMult.toFixed(1)}</span></div>
          <div class="detail-line"><span class="detail-label">Level ${level} (+${((levelBonus-1)*100).toFixed(0)}%):</span><span class="detail-level">×${levelBonus.toFixed(2)}</span></div>
          <div class="detail-line"><span class="detail-label">Upgrades Lv.${upgrades.hp||0} (+${(hpUpgradeBonus*100).toFixed(0)}%):</span><span class="detail-upgrade">×${(1+hpUpgradeBonus).toFixed(2)}</span></div>
          <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${Math.floor(tower.maxHp)}</span></div>
        `;
      }
      
      // ============ ENERGY ============
      const current = Math.floor(tower.currentEnergy || 0);
      const max = Math.floor(tower.maxEnergy || 100);
      if (el.tooltipEnergy) {
        el.tooltipEnergy.textContent = `${current}/${max}`;
      }
      const detailEnergy = document.getElementById('detail-energy');
      if (detailEnergy) {
        const energyCost = tower.energyCost || 5;
        const baseEnergyCost = tower.baseEnergyCost || 5;
        const effUpgrades = upgrades.energyEfficiency || 0;
        detailEnergy.innerHTML = `
          <div class="detail-line"><span class="detail-label">Current:</span><span class="detail-value">${current}/${max}</span></div>
          <div class="detail-line"><span class="detail-label">Cost/shot:</span><span class="detail-base">${energyCost.toFixed(1)}</span></div>
          <div class="detail-line"><span class="detail-label">Base cost:</span><span class="detail-base">${baseEnergyCost}</span></div>
          <div class="detail-line"><span class="detail-label">Efficiency Lv.${effUpgrades} (-${(effUpgrades*3)}%):</span><span class="detail-upgrade">${effUpgrades > 0 ? '-' + (effUpgrades*3) + '%' : '—'}</span></div>
        `;
      }
      
      // ============ POWER HIT COST (NEW) ============
      // Formula: damage * 0.5 * powerHitCostMod * (1 + level%) * (1 - powerEfficiency%)
      const energyCostPerShot = tower.energyCostPerShot || 5;
      const powerHitCostMod = tower.powerHitCostMod || 1;
      const basePowerCost = tower.basePowerCost || (tower.damage * 0.5);
      const powerEffLvl = upgrades.powerEfficiency || 0;
      
      if (el.tooltipPowerCost) {
        el.tooltipPowerCost.textContent = Math.round(energyCostPerShot);
      }
      const detailPowerCost = document.getElementById('detail-powercost');
      if (detailPowerCost) {
        const levelCostBonus = 1 + (level - 1) * 0.01;
        const powerEffReduction = Math.min(0.8, powerEffLvl * 0.03); // 3% per level, max 80%
        
        // Attack type names for display
        const attackTypeName = (tower.attackTypeId || 'base').charAt(0).toUpperCase() + (tower.attackTypeId || 'base').slice(1);
        
        detailPowerCost.innerHTML = `
          <div class="detail-line"><span class="detail-label">Base (50% of DMG):</span><span class="detail-base">${Math.round(basePowerCost)}</span></div>
          <div class="detail-line"><span class="detail-label">Level ${level} (+${((levelCostBonus-1)*100).toFixed(0)}%):</span><span class="detail-level">×${levelCostBonus.toFixed(2)}</span></div>
          <div class="detail-line"><span class="detail-label">${attackTypeName} (×${powerHitCostMod.toFixed(1)}):</span><span class="detail-value ${powerHitCostMod > 1 ? 'penalty' : 'bonus'}">${powerHitCostMod > 1 ? '+' : ''}${Math.round((powerHitCostMod-1)*100)}%</span></div>
          ${powerEffLvl > 0 ? `<div class="detail-line"><span class="detail-label">⚡ Power Eff Lv.${powerEffLvl} (-${(powerEffReduction*100).toFixed(0)}%):</span><span class="detail-upgrade bonus">-${(powerEffReduction*100).toFixed(0)}%</span></div>` : ''}
          <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${Math.round(energyCostPerShot)}</span></div>
          <div class="detail-formula">DMG×0.5×Lvl%×TypeMod×Eff%</div>
        `;
      }
    }
    
    /**
     * Build detail popup HTML for percentage-based stats
     */
    buildDetailPopup(statName, baseValue, level, typeMod, upgradeLevel, finalValue, isFloat = false, upgradePercent = 0.05, biomeBonus = 1) {
      const levelBonus = 1 + (level - 1) * 0.01;
      const levelPercent = ((levelBonus - 1) * 100).toFixed(0);
      const afterLevel = baseValue * levelBonus;
      const afterType = afterLevel * typeMod;
      const upgradeLv = upgradeLevel || 0;
      const upgradeBonus = upgradeLv * upgradePercent;
      const upgradePct = (upgradeBonus * 100).toFixed(0);
      const afterUpgrade = afterType * (1 + upgradeBonus);
      const afterBiome = afterUpgrade * biomeBonus;
      
      const formatVal = (v) => isFloat ? v.toFixed(2) : Math.floor(v);
      
      // Build biome line if there's a bonus
      let biomeLine = '';
      if (biomeBonus !== 1) {
        const biomePct = Math.round((biomeBonus - 1) * 100);
        const biomeSign = biomePct >= 0 ? '+' : '';
        biomeLine = `<div class="detail-line"><span class="detail-label">Biome (${biomeSign}${biomePct}%):</span><span class="detail-biome">${formatVal(afterBiome)}</span></div>`;
      }
      
      return `
        <div class="detail-line"><span class="detail-label">Base:</span><span class="detail-base">${formatVal(baseValue)}</span></div>
        <div class="detail-line"><span class="detail-label">Level ${level} (+${levelPercent}%):</span><span class="detail-level">${formatVal(afterLevel)}</span></div>
        <div class="detail-line"><span class="detail-label">Type (×${typeMod.toFixed(2)}):</span><span class="detail-value">${formatVal(afterType)}</span></div>
        <div class="detail-line"><span class="detail-label">Upgrades Lv.${upgradeLv} (+${upgradePct}%):</span><span class="detail-upgrade">${formatVal(afterUpgrade)}</span></div>
        ${biomeLine}
        <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${formatVal(finalValue || afterBiome)}</span></div>
        <div class="detail-formula">(Base × Lvl%) × Type × Upg%${biomeBonus !== 1 ? ' × Biome' : ''}</div>
      `;
    }
    
    /**
     * Build detailed biome breakdown popup
     */
    buildBiomeDetailPopup(tower, biomeData) {
      const breakdown = tower.biomeBreakdown;
      const dmgMod = tower.terrainDamageBonus || 1;
      const rngMod = tower.terrainRangeBonus || 1;
      
      let html = `<div class="detail-header">Biome Effects</div>`;
      
      if (breakdown) {
        // Show base biome with its modifiers
        const base = breakdown.base;
        const baseDmg = base.modifiers.towerDamage || 1;
        const baseRng = base.modifiers.towerRange || 1;
        
        html += `<div class="detail-line"><span class="detail-label">${base.emoji} ${base.name}:</span></div>`;
        if (baseDmg !== 1) {
          const pct = Math.round((baseDmg - 1) * 100);
          html += `<div class="detail-line" style="padding-left:12px"><span class="detail-label">DMG:</span><span class="detail-value">${pct >= 0 ? '+' : ''}${pct}%</span></div>`;
        }
        if (baseRng !== 1) {
          const pct = Math.round((baseRng - 1) * 100);
          html += `<div class="detail-line" style="padding-left:12px"><span class="detail-label">RNG:</span><span class="detail-value">${pct >= 0 ? '+' : ''}${pct}%</span></div>`;
        }
        if (baseDmg === 1 && baseRng === 1) {
          html += `<div class="detail-line" style="padding-left:12px;color:#718096">No modifiers</div>`;
        }
        
        // Show border effects
        for (const border of breakdown.borders) {
          const borderDmg = border.modifiers.towerDamage;
          const borderRng = border.modifiers.towerRange;
          
          html += `<div class="detail-line"><span class="detail-label">${border.emoji} ${border.name}:</span></div>`;
          if (borderDmg !== undefined && borderDmg !== 1) {
            const pct = Math.round((borderDmg - 1) * 100);
            html += `<div class="detail-line" style="padding-left:12px"><span class="detail-label">DMG:</span><span class="detail-value">${pct >= 0 ? '+' : ''}${pct}%</span></div>`;
          }
          if (borderRng !== undefined && borderRng !== 1) {
            const pct = Math.round((borderRng - 1) * 100);
            html += `<div class="detail-line" style="padding-left:12px"><span class="detail-label">RNG:</span><span class="detail-value">${pct >= 0 ? '+' : ''}${pct}%</span></div>`;
          }
          if ((!borderDmg || borderDmg === 1) && (!borderRng || borderRng === 1)) {
            html += `<div class="detail-line" style="padding-left:12px;color:#718096">No modifiers</div>`;
          }
        }
      } else {
        // Fallback to simple view
        const biomeType = tower.biomeType || 'default';
        const mainBiome = biomeData[biomeType] || biomeData['default'];
        html += `<div class="detail-line"><span class="detail-label">${mainBiome.icon} ${mainBiome.name}</span></div>`;
      }
      
      // Final totals
      html += `<div class="detail-separator"></div>`;
      html += `<div class="detail-line"><span class="detail-label">Final:</span></div>`;
      
      if (dmgMod !== 1) {
        const dmgPct = Math.round((dmgMod - 1) * 100);
        html += `<div class="detail-line" style="padding-left:12px"><span class="detail-label">⚔️ DMG:</span><span class="detail-final">${dmgPct >= 0 ? '+' : ''}${dmgPct}%</span></div>`;
      }
      if (rngMod !== 1) {
        const rngPct = Math.round((rngMod - 1) * 100);
        html += `<div class="detail-line" style="padding-left:12px"><span class="detail-label">📏 RNG:</span><span class="detail-final">${rngPct >= 0 ? '+' : ''}${rngPct}%</span></div>`;
      }
      
      if (dmgMod === 1 && rngMod === 1) {
        html += `<div class="detail-line" style="padding-left:12px;color:#718096">No bonuses</div>`;
      }
      
      return html;
    }

    /**
     * Update only energy display (called on every tick for real-time update)
     */
    updateTooltipEnergy(tower) {
      const el = this.elements;
      if (!el.tooltipEnergy) return;
      
      const current = Math.floor(tower.currentEnergy || 0);
      const max = Math.floor(tower.maxEnergy || 100);
      el.tooltipEnergy.textContent = `${current}/${max}`;
    }

    /**
     * Position tooltip near the selected tower
     */
    positionTooltipNearTower(tower) {
      const el = this.elements;
      if (!el.towerTooltip || !this.camera || !this.canvas) return;
      
      const GRID = this.CONFIG.GRID_SIZE;
      
      // Get tower center in world coords
      const towerWorldX = (tower.gridX + 0.5) * GRID;
      const towerWorldY = tower.gridY * GRID;
      
      // Convert to screen coords
      const screenPos = this.camera.worldToScreen(towerWorldX, towerWorldY);
      
      // Get canvas and tooltip dimensions
      const canvasRect = this.canvas.getBoundingClientRect();
      const tooltipRect = el.towerTooltip.getBoundingClientRect();
      const tooltipWidth = tooltipRect.width || 200;
      const tooltipHeight = tooltipRect.height || 300;
      
      // Calculate position (above the tower by default)
      let left = screenPos.x - tooltipWidth / 2;
      let top = screenPos.y - tooltipHeight - 20; // 20px gap above tower
      
      // Clamp to canvas bounds
      const padding = 10;
      
      // Horizontal bounds
      if (left < padding) left = padding;
      if (left + tooltipWidth > canvasRect.width - padding) {
        left = canvasRect.width - tooltipWidth - padding;
      }
      
      // Vertical bounds - if tooltip doesn't fit above, show below
      if (top < padding) {
        top = screenPos.y + GRID * this.camera.scale + 10;
      }
      if (top + tooltipHeight > canvasRect.height - padding) {
        top = canvasRect.height - tooltipHeight - padding;
      }
      
      // Apply position
      el.towerTooltip.style.left = `${left}px`;
      el.towerTooltip.style.top = `${top}px`;
    }

    /**
     * Update tooltip sections based on tower state
     */
    updateTooltipSections(tower) {
      const el = this.elements;
      
      // Show attack type section if tower has no attack type yet (base tower)
      if (el.tooltipAttackSection) {
        el.tooltipAttackSection.style.display = tower.attackTypeId === 'base' ? 'block' : 'none';
      }
      
      // Show element section if tower has attack type but no element
      if (el.tooltipElementSection) {
        const showElement = tower.attackTypeId !== 'base' && !tower.elementPath;
        el.tooltipElementSection.style.display = showElement ? 'block' : 'none';
      }
      
      // Update button states
      this.updateTooltipButtonStates(tower);
    }

    /**
     * Update tooltip button active/disabled states
     */
    updateTooltipButtonStates(tower) {
      const el = this.elements;
      const gold = this.game?.modules?.economy?.gold || 0;
      
      // Attack type buttons
      el.tooltipTypeBtns?.forEach(btn => {
        const type = btn.dataset.type;
        const cost = parseInt(btn.dataset.cost) || 0;
        const isActive = tower.attackTypeId === type;
        const canAfford = gold >= cost;
        
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('disabled', !canAfford && !isActive);
      });
      
      // Element buttons
      el.tooltipElementBtns?.forEach(btn => {
        const element = btn.dataset.element;
        const cost = parseInt(btn.dataset.cost) || 0;
        const isActive = tower.elementPath === element;
        const canAfford = gold >= cost;
        
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('disabled', !canAfford && !isActive);
      });
    }

    /**
     * Update level progress bar display
     * Uses unified TOWER_LEVEL_CONFIG from core/tower-upgrades.js
     */
    updateLevelProgress(tower) {
      const el = this.elements;
      if (!el.tooltipLevelProgress || !el.tooltipLevelText) return;
      
      const currentPoints = tower.upgradePoints || 0;
      const config = TOWER_LEVEL_CONFIG;
      const POINTS_PER_LEVEL = config.pointsPerLevel;
      const EXTRA_POINTS_PER_LEVEL = config.extraPointsPerLevel;
      
      // Use the unified calculateTowerLevel function
      const currentLevel = tower.level || calculateTowerLevel(tower);
      
      // Calculate progress to next level
      let pointsForCurrentLevel = 0;
      let pointsForNextLevel = POINTS_PER_LEVEL[1] || 3;
      
      if (currentLevel <= POINTS_PER_LEVEL.length) {
        pointsForCurrentLevel = POINTS_PER_LEVEL[currentLevel - 1] || 0;
        pointsForNextLevel = POINTS_PER_LEVEL[currentLevel] || (pointsForCurrentLevel + EXTRA_POINTS_PER_LEVEL);
      } else {
        // Beyond defined levels
        const lastDefined = POINTS_PER_LEVEL.length;
        pointsForCurrentLevel = POINTS_PER_LEVEL[lastDefined - 1] + (currentLevel - lastDefined) * EXTRA_POINTS_PER_LEVEL;
        pointsForNextLevel = pointsForCurrentLevel + EXTRA_POINTS_PER_LEVEL;
      }
      
      const progressInLevel = currentPoints - pointsForCurrentLevel;
      const pointsNeeded = pointsForNextLevel - pointsForCurrentLevel;
      const percent = Math.min(100, Math.max(0, (progressInLevel / pointsNeeded) * 100));
      
      el.tooltipLevelProgress.style.width = `${percent}%`;
      el.tooltipLevelText.textContent = `${progressInLevel}/${pointsNeeded} XP`;
    }

    /**
     * Update tooltip position when camera moves
     */
    updateTooltipPosition() {
      if (!this.tooltipTowerPosition || !this.game?.selectedTower) return;
      this.positionTooltipNearTower(this.game.selectedTower);
    }

    /**
     * Hide tower tooltip
     */
    hideTowerInfo() {
      const el = this.elements;
      if (el.towerTooltip) {
        el.towerTooltip.classList.remove('visible');
      }
      // Also hide upgrades panel if open
      if (el.tooltipUpgradesSection) {
        el.tooltipUpgradesSection.style.display = 'none';
      }
      if (el.btnUpgrade) {
        el.btnUpgrade.classList.remove('active');
      }
      this.tooltipTowerPosition = null;
    }
    
    /**
     * Deselect current tower and hide tooltip
     */
    deselectTower() {
      if (this.game) {
        this.game.selectTower(null);
      }
      this.hideTowerInfo();
    }
  };
}

module.exports = { TowerTooltipMixin, ATTACK_TYPE_EMOJIS, ELEMENT_EMOJIS };
