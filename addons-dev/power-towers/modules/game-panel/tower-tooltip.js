/**
 * Power Towers TD - Tower Tooltip Handler
 * Manages floating tooltip display for tower info
 */

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
      
      // ============ DAMAGE ============
      const baseDmg = tower.baseDamage || 10;
      const leveledDmg = baseDmg * levelBonus;
      const afterTypeDmg = leveledDmg * attackType.dmgMod;
      const upgradeBonus = upgrades.damage ? upgrades.damage * 0.05 : 0;
      const finalDmg = afterTypeDmg * (1 + upgradeBonus);
      
      if (el.tooltipDmg) el.tooltipDmg.textContent = Math.floor(tower.damage || finalDmg);
      const detailDmg = document.getElementById('detail-dmg');
      if (detailDmg) {
        detailDmg.innerHTML = this.buildDetailPopup('DMG', baseDmg, level, attackType.dmgMod, upgrades.damage, tower.damage);
      }
      
      // ============ RANGE ============
      const baseRng = tower.baseRange || 70;
      if (el.tooltipRng) el.tooltipRng.textContent = Math.floor(tower.range || 0);
      const detailRng = document.getElementById('detail-rng');
      if (detailRng) {
        detailRng.innerHTML = this.buildDetailPopup('RNG', baseRng, level, attackType.rangeMod, upgrades.range, tower.range);
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
      if (el.tooltipSplashRow && el.tooltipSplash) {
        if (tower.splashRadius && tower.splashRadius > 0) {
          el.tooltipSplashRow.style.display = '';
          el.tooltipSplash.textContent = Math.floor(tower.splashRadius);
          const detailSplash = document.getElementById('detail-splash');
          if (detailSplash) {
            const baseSplash = attackType.splashRadius || 0;
            detailSplash.innerHTML = this.buildDetailPopup('SPLASH', baseSplash, level, 1, upgrades.splashRadius, tower.splashRadius, false, 0.08);
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
    }
    
    /**
     * Build detail popup HTML for percentage-based stats
     */
    buildDetailPopup(statName, baseValue, level, typeMod, upgradeLevel, finalValue, isFloat = false, upgradePercent = 0.05) {
      const levelBonus = 1 + (level - 1) * 0.01;
      const levelPercent = ((levelBonus - 1) * 100).toFixed(0);
      const afterLevel = baseValue * levelBonus;
      const afterType = afterLevel * typeMod;
      const upgradeLv = upgradeLevel || 0;
      const upgradeBonus = upgradeLv * upgradePercent;
      const upgradePct = (upgradeBonus * 100).toFixed(0);
      
      const formatVal = (v) => isFloat ? v.toFixed(2) : Math.floor(v);
      
      return `
        <div class="detail-line"><span class="detail-label">Base:</span><span class="detail-base">${formatVal(baseValue)}</span></div>
        <div class="detail-line"><span class="detail-label">Level ${level} (+${levelPercent}%):</span><span class="detail-level">${formatVal(afterLevel)}</span></div>
        <div class="detail-line"><span class="detail-label">Type (×${typeMod.toFixed(2)}):</span><span class="detail-value">${formatVal(afterType)}</span></div>
        <div class="detail-line"><span class="detail-label">Upgrades Lv.${upgradeLv} (+${upgradePct}%):</span><span class="detail-upgrade">${formatVal(afterType * (1 + upgradeBonus))}</span></div>
        <div class="detail-line"><span class="detail-label">Final:</span><span class="detail-final">${formatVal(finalValue || afterType * (1 + upgradeBonus))}</span></div>
        <div class="detail-formula">(Base × Lvl%) × Type × Upg%</div>
      `;
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
     */
    updateLevelProgress(tower) {
      const el = this.elements;
      if (!el.tooltipLevelProgress || !el.tooltipLevelText) return;
      
      const currentPoints = tower.upgradePoints || 0;
      
      // Level thresholds - XP needed to REACH each level
      // Level 1: 0 XP, Level 2: 10 XP, Level 3: 25 XP, etc.
      const POINTS_PER_LEVEL = [0, 10, 25, 50, 80, 120, 170, 230, 300, 380, 470];
      const EXTRA_POINTS_PER_LEVEL = 100;
      
      // Calculate current level from XP
      let currentLevel = 1;
      for (let i = 1; i < POINTS_PER_LEVEL.length; i++) {
        if (currentPoints >= POINTS_PER_LEVEL[i]) {
          currentLevel = i + 1;
        } else {
          break;
        }
      }
      // Beyond defined levels
      if (currentPoints >= POINTS_PER_LEVEL[POINTS_PER_LEVEL.length - 1]) {
        const extraPoints = currentPoints - POINTS_PER_LEVEL[POINTS_PER_LEVEL.length - 1];
        currentLevel = POINTS_PER_LEVEL.length + Math.floor(extraPoints / EXTRA_POINTS_PER_LEVEL);
      }
      
      // Update tower level if different
      if (tower.level !== currentLevel) {
        tower.level = currentLevel;
      }
      
      // Calculate progress to next level
      let pointsForCurrentLevel = 0;
      let pointsForNextLevel = 10;
      
      if (currentLevel <= POINTS_PER_LEVEL.length - 1) {
        pointsForCurrentLevel = POINTS_PER_LEVEL[currentLevel - 1] || 0;
        pointsForNextLevel = POINTS_PER_LEVEL[currentLevel] || (pointsForCurrentLevel + EXTRA_POINTS_PER_LEVEL);
      } else {
        // Beyond defined levels
        pointsForCurrentLevel = POINTS_PER_LEVEL[POINTS_PER_LEVEL.length - 1] + (currentLevel - POINTS_PER_LEVEL.length) * EXTRA_POINTS_PER_LEVEL;
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
