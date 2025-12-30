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
      
      // Update stats
      if (el.tooltipDmg) el.tooltipDmg.textContent = Math.floor(tower.damage || 0);
      if (el.tooltipRng) el.tooltipRng.textContent = Math.floor(tower.range || 0);
      if (el.tooltipSpd) el.tooltipSpd.textContent = (tower.fireRate || 1).toFixed(1);
      
      // Crit stats
      const critChance = tower.attackTypeConfig?.baseCritChance || tower.critChance || 0.05;
      const critDmg = tower.attackTypeConfig?.baseCritDmg || tower.critDmgMod || 1.5;
      if (el.tooltipCrit) el.tooltipCrit.textContent = `${Math.round(critChance * 100)}%`;
      if (el.tooltipCritdmg) el.tooltipCritdmg.textContent = `${Math.round(critDmg * 100)}%`;
      
      if (el.tooltipHp) {
        el.tooltipHp.textContent = `${Math.floor(tower.currentHp || 0)}/${Math.floor(tower.maxHp || 100)}`;
      }
      if (el.tooltipEnergy) {
        const current = Math.floor(tower.currentEnergy || 0);
        const max = Math.floor(tower.maxEnergy || 100);
        el.tooltipEnergy.textContent = `${current}/${max}`;
      }
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
