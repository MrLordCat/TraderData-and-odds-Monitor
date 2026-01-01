/**
 * Power Towers TD - Tower Tooltip Handler
 * Manages floating tooltip display for tower info
 */

const { TOWER_LEVEL_CONFIG, calculateTowerLevel } = require('../../core/tower-upgrades');
const { calculateLightningChargeDamage, calculateLightningChargeCost, ELEMENT_ABILITIES } = require('../../core/element-abilities');
const { 
  getBiomeData, 
  formatBiomeBonuses,
  hasPenalty
} = require('./utils/biome-helpers');
const { 
  formatPercent, 
  formatNumber, 
  formatInt, 
  capitalize 
} = require('./utils/format-helpers');
const { 
  createDetailBuilder,
  buildStatDetail,
  buildCritDetail
} = require('./utils/stat-detail-builder');
const { 
  positionTowerTooltip 
} = require('./utils/tooltip-position');

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
      
      // Hide abilities panel when switching towers
      if (el.tooltipAbilitiesSection) {
        el.tooltipAbilitiesSection.style.display = 'none';
      }
      if (el.btnAbilities) {
        el.btnAbilities.classList.remove('active');
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
          name = capitalize(tower.attackTypeId);
          if (tower.elementPath) {
            name = `${capitalize(tower.elementPath)} ${name}`;
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
        const attackName = capitalize(tower.attackTypeId) || 'Base';
        el.tooltipAttackType.textContent = `${attackEmoji} ${attackName}`;
      }
      
      // Update element display
      if (el.tooltipElement) {
        if (tower.elementPath) {
          const elemEmoji = ELEMENT_EMOJIS[tower.elementPath] || '';
          el.tooltipElement.textContent = `${elemEmoji} ${capitalize(tower.elementPath)}`;
        } else {
          el.tooltipElement.textContent = '—';
        }
      }
      
      // Update Biome Section - using centralized biome helpers
      if (el.towerBiomeSection) {
        const biomeType = tower.biomeType || tower.terrainType || 'default';
        const dmgMod = tower.terrainDamageBonus || tower.terrainBonus || 1;
        const rngMod = tower.terrainRangeBonus || 1;
        const breakdown = tower.biomeBreakdown;
        
        el.towerBiomeSection.style.display = 'flex';
        
        // Build icons using helper
        const mainBiome = getBiomeData(biomeType);
        let iconsText = mainBiome.icon;
        let titleText = mainBiome.name;
        
        if (breakdown?.borders?.length > 0) {
          for (const border of breakdown.borders) {
            const nbData = getBiomeData(border.biome);
            iconsText += nbData.icon;
            titleText += ` + ${border.name}`;
          }
        }
        
        if (el.towerBiomeIcons) {
          el.towerBiomeIcons.textContent = iconsText;
          el.towerBiomeIcons.title = titleText;
        }
        
        // Show bonuses using helper
        if (el.towerBiomeBonus) {
          const bonuses = formatBiomeBonuses({ towerDamage: dmgMod, towerRange: rngMod });
          
          if (bonuses.length > 0) {
            el.towerBiomeBonus.textContent = bonuses.join(', ');
            el.towerBiomeBonus.classList.toggle('penalty', hasPenalty(bonuses));
          } else {
            el.towerBiomeBonus.textContent = '—';
            el.towerBiomeBonus.classList.remove('penalty');
          }
        }
        
        // Build detailed biome popup
        if (el.detailBiome) {
          el.detailBiome.innerHTML = this.buildBiomeDetailPopup(tower);
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
      
      // Get Lightning charge multiplier if applicable
      let lightningChargeMult = 1;
      if (tower.elementPath === 'lightning' && tower.lightningChargeEnabled) {
        const chargeConfig = tower.elementAbilities?.charge || ELEMENT_ABILITIES.lightning?.charge || {
          damageExponent: 2.0,
          costExponent: 2.5,
          baseCost: 20
        };
        const chargeTarget = tower.lightningChargeTarget || 50;
        lightningChargeMult = calculateLightningChargeDamage(chargeTarget, chargeConfig);
      }
      
      // ============ DAMAGE ============
      const baseDmg = tower.baseDamage || 10;
      const effectiveDmg = lightningChargeMult > 1 ? Math.floor((tower.damage || 0) * lightningChargeMult) : (tower.damage || 0);
      if (el.tooltipDmg) el.tooltipDmg.textContent = formatInt(effectiveDmg);
      const detailDmg = document.getElementById('detail-dmg');
      if (detailDmg) {
        const builder = createDetailBuilder()
          .base('Base:', formatInt(baseDmg))
          .level(level, Math.round((levelBonus - 1) * 100), formatInt(baseDmg * levelBonus))
          .type('Type', attackType.dmgMod, formatInt(baseDmg * levelBonus * attackType.dmgMod));
        
        if (upgrades.damage) {
          const upgradePct = upgrades.damage * 5;
          builder.upgrade(upgrades.damage, upgradePct, formatInt(tower.damage));
        }
        
        if (dmgBiomeBonus !== 1) {
          builder.biome('', dmgBiomeBonus, formatInt(tower.damage));
        }
        
        // Lightning charge multiplier
        if (lightningChargeMult > 1) {
          const chargeTarget = tower.lightningChargeTarget || 50;
          builder.line(`⚡ Charge ${chargeTarget}% (×${lightningChargeMult.toFixed(2)}):`, formatInt(effectiveDmg), 'detail-upgrade bonus');
        }
        
        builder.final(formatInt(effectiveDmg))
          .formula(lightningChargeMult > 1 ? 'Base×Lvl×Type×Upg×Biome×Charge' : '(Base × Lvl%) × Type × Upg%');
        
        detailDmg.innerHTML = builder.build();
      }
      
      // ============ RANGE ============
      const baseRng = tower.baseRange || 70;
      if (el.tooltipRng) el.tooltipRng.textContent = formatInt(tower.range || 0);
      const detailRng = document.getElementById('detail-rng');
      if (detailRng) {
        detailRng.innerHTML = buildStatDetail({
          baseValue: baseRng, level, typeMod: attackType.rangeMod,
          upgradeLevel: upgrades.range, upgradePercent: 0.05,
          finalValue: tower.range, biomeBonus: rngBiomeBonus
        });
      }
      
      // ============ SPEED ============
      const baseSpd = tower.baseFireRate || 1;
      if (el.tooltipSpd) el.tooltipSpd.textContent = formatNumber(tower.fireRate || 1, 1);
      const detailSpd = document.getElementById('detail-spd');
      if (detailSpd) {
        detailSpd.innerHTML = buildStatDetail({
          baseValue: baseSpd, level, typeMod: attackType.atkSpdMod,
          upgradeLevel: upgrades.attackSpeed, upgradePercent: 0.04,
          finalValue: tower.fireRate, isFloat: true
        });
      }
      
      // ============ CRIT CHANCE ============
      const baseCrit = attackType.critChance || tower.baseCritChance || 0.05;
      const critUpgrades = upgrades.critChance || 0;
      const finalCrit = tower.critChance || 0.05;
      if (el.tooltipCrit) el.tooltipCrit.textContent = `${Math.round(finalCrit * 100)}%`;
      const detailCrit = document.getElementById('detail-crit');
      if (detailCrit) {
        detailCrit.innerHTML = buildCritDetail({ baseCrit, upgradeLevel: critUpgrades, finalCrit, isCritDamage: false });
      }
      
      // ============ CRIT DAMAGE ============
      const baseCritDmg = attackType.critDmgMod || tower.baseCritDmgMod || 1.5;
      const critDmgUpgrades = upgrades.critDamage || 0;
      const finalCritDmg = tower.critDmgMod || 1.5;
      if (el.tooltipCritdmg) el.tooltipCritdmg.textContent = `${Math.round(finalCritDmg * 100)}%`;
      const detailCritDmg = document.getElementById('detail-critdmg');
      if (detailCritDmg) {
        detailCritDmg.innerHTML = buildCritDetail({ baseCrit: baseCritDmg, upgradeLevel: critDmgUpgrades, finalCrit: finalCritDmg, isCritDamage: true });
      }
      
      // ============ SPLASH ============
      // Note: Splash does NOT get level bonus, only upgrade bonus
      if (el.tooltipSplashRow && el.tooltipSplash) {
        if (tower.splashRadius && tower.splashRadius > 0) {
          el.tooltipSplashRow.style.display = '';
          el.tooltipSplash.textContent = formatInt(tower.splashRadius);
          const detailSplash = document.getElementById('detail-splash');
          if (detailSplash) {
            const baseSplash = attackType.splashRadius || 0;
            const splashUpgLv = upgrades.splashRadius || 0;
            const splashUpgPct = splashUpgLv * 8;
            detailSplash.innerHTML = createDetailBuilder()
              .base('Base:', formatInt(baseSplash))
              .upgrade(splashUpgLv, splashUpgPct, formatInt(baseSplash * (1 + splashUpgLv * 0.08)))
              .final(formatInt(tower.splashRadius))
              .formula('Base × Upg% (no level bonus)')
              .build();
          }
        } else {
          el.tooltipSplashRow.style.display = 'none';
        }
      }
      
      // ============ HP ============
      const baseHp = tower.baseHp || 100;
      const hpMult = tower.hpMultiplier || 1;
      if (el.tooltipHp) {
        el.tooltipHp.textContent = `${formatInt(tower.currentHp || 0)}/${formatInt(tower.maxHp || 100)}`;
      }
      const detailHp = document.getElementById('detail-hp');
      if (detailHp) {
        const hpUpgLv = upgrades.hp || 0;
        const hpUpgPct = hpUpgLv * 8;
        detailHp.innerHTML = createDetailBuilder()
          .base('Base:', formatInt(baseHp))
          .line('HP Multi:', `×${formatNumber(hpMult, 1)}`, 'detail-value')
          .level(level, Math.round((levelBonus - 1) * 100), `×${formatNumber(levelBonus, 2)}`)
          .upgrade(hpUpgLv, hpUpgPct, `×${formatNumber(1 + hpUpgLv * 0.08, 2)}`)
          .final(formatInt(tower.maxHp))
          .build();
      }
      
      // ============ ENERGY ============
      const current = formatInt(tower.currentEnergy || 0);
      const max = formatInt(tower.maxEnergy || 100);
      if (el.tooltipEnergy) {
        el.tooltipEnergy.textContent = `${current}/${max}`;
      }
      const detailEnergy = document.getElementById('detail-energy');
      if (detailEnergy) {
        const energyCost = tower.energyCost || 5;
        const baseEnergyCost = tower.baseEnergyCost || 5;
        const effUpgLv = upgrades.energyEfficiency || 0;
        const builder = createDetailBuilder()
          .line('Current:', `${current}/${max}`, 'detail-value')
          .base('Cost/shot:', formatNumber(energyCost, 1))
          .base('Base cost:', formatInt(baseEnergyCost));
        if (effUpgLv > 0) {
          builder.line(`Efficiency Lv.${effUpgLv} (-${effUpgLv * 3}%):`, `-${effUpgLv * 3}%`, 'detail-upgrade');
        }
        detailEnergy.innerHTML = builder.build();
      }
      
      // ============ POWER HIT COST ============
      // For Lightning with charge: uses calculateLightningChargeCost
      // For others: damage * 0.5 * powerHitCostMod * (1 + level%) * (1 - powerEfficiency%)
      let effectivePowerCost = tower.energyCostPerShot || 5;
      const powerHitCostMod = tower.powerHitCostMod || 1;
      const basePowerCost = tower.basePowerCost || (tower.damage * 0.5);
      const powerEffLvl = upgrades.powerEfficiency || 0;
      
      // Lightning charge cost override
      let lightningChargeCost = 0;
      if (tower.elementPath === 'lightning' && tower.lightningChargeEnabled && lightningChargeMult > 1) {
        const chargeConfig = tower.elementAbilities?.charge || ELEMENT_ABILITIES.lightning?.charge || {
          baseCost: 20,
          costExponent: 2.5
        };
        const chargeTarget = tower.lightningChargeTarget || 50;
        lightningChargeCost = calculateLightningChargeCost(chargeTarget, chargeConfig);
        effectivePowerCost = lightningChargeCost;
      }
      
      if (el.tooltipPowerCost) {
        el.tooltipPowerCost.textContent = Math.round(effectivePowerCost);
      }
      const detailPowerCost = document.getElementById('detail-powercost');
      if (detailPowerCost) {
        const levelCostBonus = 1 + (level - 1) * 0.01;
        const powerEffReduction = Math.min(0.8, powerEffLvl * 0.03);
        const attackTypeName = capitalize(tower.attackTypeId || 'base');
        
        if (lightningChargeCost > 0) {
          // Lightning charge cost display
          const chargeTarget = tower.lightningChargeTarget || 50;
          detailPowerCost.innerHTML = createDetailBuilder()
            .line('⚡ Charge Mode:', `${chargeTarget}%`, 'detail-value')
            .line('Base Cost:', formatInt(20), 'detail-base')
            .line(`Charge ${chargeTarget}%:`, formatInt(lightningChargeCost), 'detail-upgrade')
            .final(formatInt(lightningChargeCost))
            .formula(`Cost = Base × (1 + ${chargeTarget}%)^2.5`)
            .build();
        } else {
          // Normal power cost display
          detailPowerCost.innerHTML = `
            <div class="detail-line"><span class="detail-label">Base (50% of DMG):</span><span class="detail-base">${Math.round(basePowerCost)}</span></div>
            <div class="detail-line"><span class="detail-label">Level ${level} (+${((levelCostBonus-1)*100).toFixed(0)}%):</span><span class="detail-level">×${levelCostBonus.toFixed(2)}</span></div>
            <div class="detail-line"><span class="detail-label">${attackTypeName} (×${powerHitCostMod.toFixed(1)}):</span><span class="detail-value ${powerHitCostMod > 1 ? 'penalty' : 'bonus'}">${powerHitCostMod > 1 ? '+' : ''}${Math.round((powerHitCostMod-1)*100)}%</span></div>
            ${powerEffLvl > 0 ? `<div class="detail-line"><span class="detail-label">⚡ Power Eff Lv.${powerEffLvl} (-${(powerEffReduction*100).toFixed(0)}%):</span><span class="detail-upgrade bonus">-${(powerEffReduction*100).toFixed(0)}%</span></div>` : ''}
            <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${Math.round(effectivePowerCost)}</span></div>
            <div class="detail-formula">DMG×0.5×Lvl%×TypeMod×Eff%</div>
          `;
        }
      }
    }
    
    /**
     * Build detailed biome breakdown popup
     */
    buildBiomeDetailPopup(tower) {
      const breakdown = tower.biomeBreakdown;
      const dmgMod = tower.terrainDamageBonus || 1;
      const rngMod = tower.terrainRangeBonus || 1;
      
      const builder = createDetailBuilder().header('Biome Effects');
      
      if (breakdown) {
        // Show base biome with its modifiers
        const base = breakdown.base;
        const baseDmg = base.modifiers.towerDamage || 1;
        const baseRng = base.modifiers.towerRange || 1;
        
        builder.line(`${base.emoji} ${base.name}:`, '', 'detail-label');
        
        if (baseDmg !== 1) {
          builder.indented('DMG:', formatPercent(baseDmg));
        }
        if (baseRng !== 1) {
          builder.indented('RNG:', formatPercent(baseRng));
        }
        if (baseDmg === 1 && baseRng === 1) {
          builder.lines.push('<div class="detail-line" style="padding-left:12px;color:#718096">No modifiers</div>');
        }
        
        // Show border effects
        for (const border of breakdown.borders) {
          const borderDmg = border.modifiers.towerDamage;
          const borderRng = border.modifiers.towerRange;
          
          builder.line(`${border.emoji} ${border.name}:`, '', 'detail-label');
          
          if (borderDmg !== undefined && borderDmg !== 1) {
            builder.indented('DMG:', formatPercent(borderDmg));
          }
          if (borderRng !== undefined && borderRng !== 1) {
            builder.indented('RNG:', formatPercent(borderRng));
          }
          if ((!borderDmg || borderDmg === 1) && (!borderRng || borderRng === 1)) {
            builder.lines.push('<div class="detail-line" style="padding-left:12px;color:#718096">No modifiers</div>');
          }
        }
      } else {
        // Fallback to simple view
        const biomeType = tower.biomeType || 'default';
        const mainBiome = getBiomeData(biomeType);
        builder.line(`${mainBiome.icon} ${mainBiome.name}`, '', 'detail-label');
      }
      
      // Final totals
      builder.separator().line('Final:', '', 'detail-label');
      
      if (dmgMod !== 1) {
        builder.indented('⚔️ DMG:', formatPercent(dmgMod), 'detail-final');
      }
      if (rngMod !== 1) {
        builder.indented('📏 RNG:', formatPercent(rngMod), 'detail-final');
      }
      
      if (dmgMod === 1 && rngMod === 1) {
        builder.lines.push('<div class="detail-line" style="padding-left:12px;color:#718096">No bonuses</div>');
      }
      
      return builder.build();
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
      
      // Use centralized positioning utility
      positionTowerTooltip({
        tooltip: el.towerTooltip,
        tower,
        camera: this.camera,
        canvas: this.canvas,
        gridSize: this.CONFIG.GRID_SIZE
      });
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
      
      // Update abilities button visibility
      if (this.updateAbilitiesButtonVisibility) {
        this.updateAbilitiesButtonVisibility(tower);
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
