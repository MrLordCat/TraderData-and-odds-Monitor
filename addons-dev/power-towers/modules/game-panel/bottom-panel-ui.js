/**
 * Power Towers TD - Bottom Panel UI
 * Handles the new 3-section bottom panel
 */

console.log('[BottomPanelModule] ===== MODULE LOADED =====');

/**
 * Mixin for bottom panel UI functionality
 * @param {Class} Base - GameController base class
 */
function BottomPanelMixin(Base) {
  console.log('[BottomPanelModule] BottomPanelMixin called with Base:', Base?.name);
  return class extends Base {
    
    /**
     * Setup bottom panel event listeners
     */
    setupBottomPanelEvents() {
      console.log('[BottomPanel] ===== setupBottomPanelEvents CALLED =====');
      console.log('[BottomPanel] this.elements:', this.elements);
      const el = this.elements;
      console.log('[BottomPanel] el.bottomPanel:', el?.bottomPanel);
      if (!el.bottomPanel) {
        console.warn('[BottomPanel] NO bottomPanel element! Aborting setup.');
        return; // Panel not ready yet
      }
      
      // Build grid items - support both old .build-item and new .build-card
      el.buildItems = el.bottomPanel.querySelectorAll('.build-item, .build-card');
      console.log('[BottomPanel] Found build items:', el.buildItems.length);
      console.log('[BottomPanel] Build items:', Array.from(el.buildItems).map(i => ({
        type: i.dataset.type,
        building: i.dataset.building,
        classes: i.className
      })));
      
      el.buildItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const type = item.dataset.type;
          const building = item.dataset.building;
          
          if (type === 'tower') {
            this.enterPlacementMode();
            this.updateBuildItemStates();
          } else if (type === 'energy') {
            this.enterEnergyPlacementMode(building);
            this.updateBuildItemStates();
          }
        });
      });
      
      // Avatar sell button
      if (el.avatarBtnSell) {
        el.avatarBtnSell.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.game?.selectedTower) {
            this.sellSelectedTower();
          } else if (this.selectedEnergyBuilding) {
            this.sellSelectedEnergyBuilding();
          }
        });
      }
      
      // Pause menu buttons
      if (el.pauseBtnResume) {
        el.pauseBtnResume.addEventListener('click', () => this.closePauseMenu());
      }
      if (el.pauseBtnSettings) {
        el.pauseBtnSettings.addEventListener('click', () => {
          // TODO: Open settings
          console.log('Settings not implemented yet');
        });
      }
      if (el.pauseBtnQuit) {
        el.pauseBtnQuit.addEventListener('click', () => this.quitToMenu());
      }
      
      // ESC key handler
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (this.currentScreen === 'game' && this.game) {
            this.togglePauseMenu();
          }
        }
        // Space - Start/Resume wave
        if (e.key === ' ' || e.code === 'Space') {
          // Prevent scrolling
          if (this.currentScreen === 'game') {
            e.preventDefault();
            this.toggleGame();
          }
        }
      });
      
      // Energy panel actions
      if (el.actionConnect) {
        el.actionConnect.addEventListener('click', (e) => {
          e.stopPropagation();
          this.startEnergyConnectionMode();
        });
      }
      if (el.actionUpgradeEnergy) {
        el.actionUpgradeEnergy.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleEnergyUpgradesPanel_Bottom();
        });
      }
      
      // Energy upgrade buttons in bottom panel
      const energyUpgradeBtns = el.bottomPanel?.querySelectorAll('#energy-upgrades-panel .action-btn[data-stat]') || [];
      energyUpgradeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (btn.classList.contains('disabled')) return;
          const stat = btn.dataset.stat;
          this.upgradeEnergyBuildingStat(stat);
        });
      });
      
      // Tower action cards (attack type)
      const attackTypeCards = el.bottomPanel?.querySelectorAll('[data-action="attack-type"]') || [];
      attackTypeCards.forEach(card => {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          if (card.classList.contains('disabled')) return;
          const type = card.dataset.type;
          this.setTowerAttackType(type);
        });
      });
      
      // Tower action cards (element)
      const elementCards = el.bottomPanel?.querySelectorAll('[data-action="element"]') || [];
      elementCards.forEach(card => {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          if (card.classList.contains('disabled')) return;
          const element = card.dataset.element;
          this.setTowerElement(element);
        });
      });
      
      // Setup unified hover tooltips (for stats and build cards)
      // NOTE: Tooltips now work via pure CSS :hover, no JS needed
    }
    
    /**
     * @deprecated Tooltips now use pure CSS :hover
     */
    setupHoverTooltips() {
      // No-op - CSS handles this now
    }
    
    /**
     * Setup stat hover popups - now handled by pure CSS like build cards
     * CSS :hover on .stat-item shows .stat-detail-popup
     */
    setupStatHoverPopups() {
      // No-op - CSS handles this identically to build-card-popup
    }
    
    /**
     * Update build item states based on affordability
     */
    updateBuildItemStates() {
      const el = this.elements;
      const gold = this.game?.getState().gold || 0;
      
      el.buildItems?.forEach(item => {
        const type = item.dataset.type;
        const building = item.dataset.building;
        let cost = 0;
        
        if (type === 'tower') {
          cost = this.CONFIG?.TOWER_COST || 50;
        } else if (type === 'energy') {
          const defs = this.game?.getModule('energy')?.getBuildingDefinitions() || {};
          cost = defs[building]?.cost || 50;
        }
        
        const canAfford = gold >= cost;
        item.classList.toggle('disabled', !canAfford);
        
        // Update placing state
        if (this.placingTower && type === 'tower') {
          item.classList.add('placing');
        } else if (this.placingEnergy === building) {
          item.classList.add('placing');
        } else {
          item.classList.remove('placing');
        }
      });
    }
    
    /**
     * Toggle pause menu
     */
    togglePauseMenu() {
      const el = this.elements;
      if (!el.pauseMenuOverlay) return;
      
      const isVisible = el.pauseMenuOverlay.style.display !== 'none';
      
      if (isVisible) {
        this.closePauseMenu();
      } else {
        this.openPauseMenu();
      }
    }
    
    /**
     * Open pause menu
     */
    openPauseMenu() {
      const el = this.elements;
      if (!el.pauseMenuOverlay) return;
      
      // Pause game
      if (this.game && !this.game.paused) {
        this.game.pause();
      }
      
      el.pauseMenuOverlay.style.display = 'flex';
    }
    
    /**
     * Close pause menu
     */
    closePauseMenu() {
      const el = this.elements;
      if (!el.pauseMenuOverlay) return;
      
      el.pauseMenuOverlay.style.display = 'none';
      
      // Resume game
      if (this.game && this.game.paused) {
        this.game.resume();
      }
      
      this.updateUI(this.game?.getState() || {});
    }
    
    /**
     * Quit to main menu
     */
    quitToMenu() {
      this.closePauseMenu();
      
      // Cleanup game
      if (this.game) {
        this.game.destroy();
        this.game = null;
      }
      
      // Show menu screen
      this.showScreen('menu');
    }
    
    /**
     * Toggle energy upgrades panel in bottom panel
     */
    toggleEnergyUpgradesPanel_Bottom() {
      const el = this.elements;
      if (!el.energyUpgradesPanel) return;
      
      const isHidden = el.energyUpgradesPanel.style.display === 'none';
      el.energyUpgradesPanel.style.display = isHidden ? 'block' : 'none';
      
      if (isHidden && this.selectedEnergyBuilding) {
        this.updateEnergyUpgradesCosts_Bottom();
      }
    }
    
    /**
     * Update energy upgrades costs in bottom panel
     */
    updateEnergyUpgradesCosts_Bottom() {
      if (!this.selectedEnergyBuilding || !this.game) return;
      
      const building = this.selectedEnergyBuilding;
      const gold = this.game.getState().gold || 0;
      const el = this.elements;
      
      // Show/hide channels button for Relay only
      if (el.energyChannelsBtn) {
        el.energyChannelsBtn.style.display = building.type === 'power-transfer' ? '' : 'none';
      }
    }
    
    /**
     * Update bottom panel stats in real-time (called on game tick)
     */
    updateBottomPanelStats(tower) {
      if (!tower) return;
      const el = this.elements;
      
      // Update stats values only (no layout changes)
      if (el.panelDmg) el.panelDmg.textContent = Math.floor(tower.damage || 0);
      if (el.panelRng) el.panelRng.textContent = Math.floor(tower.range || 0);
      if (el.panelSpd) el.panelSpd.textContent = (tower.attackSpeed || tower.fireRate || 1).toFixed(1);
      if (el.panelCrit) el.panelCrit.textContent = `${Math.floor((tower.critChance || 0) * 100)}%`;
      if (el.panelCritdmg) el.panelCritdmg.textContent = `${Math.floor((tower.critMultiplier || tower.critDmgMod || 1.5) * 100)}%`;
      if (el.panelPower) el.panelPower.textContent = Math.floor(tower.energyCostPerShot || 0);
      
      // HP stat (if tower has HP)
      const hpRow = document.getElementById('stat-row-hp');
      if (el.panelHp && tower.maxHp !== undefined) {
        el.panelHp.textContent = `${Math.floor(tower.hp || 0)}/${Math.floor(tower.maxHp || 0)}`;
        if (hpRow) hpRow.style.display = '';
      } else if (hpRow) {
        hpRow.style.display = 'none';
      }
      
      // Splash for Siege attack type
      const splashRow = document.getElementById('stat-row-splash');
      if (tower.attackTypeId === 'siege' || tower.splashRadius > 0) {
        if (el.panelSplash) el.panelSplash.textContent = Math.floor(tower.splashRadius || 0);
        if (splashRow) splashRow.style.display = '';
      } else if (splashRow) {
        splashRow.style.display = 'none';
      }
      
      // Chain for Lightning attack type
      const chainRow = document.getElementById('stat-row-chain');
      if (tower.attackTypeId === 'lightning' || tower.chainTargets > 0) {
        if (el.panelChain) el.panelChain.textContent = tower.chainTargets || 0;
        if (chainRow) chainRow.style.display = '';
      } else if (chainRow) {
        chainRow.style.display = 'none';
      }
      
      // Fire element - Burn DPS
      const burnRow = document.getElementById('stat-row-burn');
      const spreadRow = document.getElementById('stat-row-spread');
      const abilities = tower.elementAbilities || {};
      if (tower.elementPath === 'fire') {
        const burnDmg = abilities.burn?.baseDamage || 5;
        if (el.panelBurn) el.panelBurn.textContent = `${burnDmg}/s`;
        if (burnRow) burnRow.style.display = '';
        
        // Spread chance
        const spreadChance = Math.floor((abilities.ignite?.spreadChance || 0.15) * 100);
        if (el.panelSpread) el.panelSpread.textContent = `${spreadChance}%`;
        if (spreadRow) spreadRow.style.display = '';
      } else {
        if (burnRow) burnRow.style.display = 'none';
        if (spreadRow) spreadRow.style.display = 'none';
      }
      
      // Ice element - Slow % and Freeze chance
      const slowRow = document.getElementById('stat-row-slow');
      const freezeRow = document.getElementById('stat-row-freeze');
      if (tower.elementPath === 'ice') {
        // Use basePercent from ELEMENT_ABILITIES
        const slowPct = Math.floor((abilities.slow?.basePercent || 0.3) * 100);
        if (el.panelSlow) el.panelSlow.textContent = `${slowPct}%`;
        if (slowRow) slowRow.style.display = '';
        
        // Use baseChance from ELEMENT_ABILITIES
        const freezeChance = Math.floor((abilities.freeze?.baseChance || 0.08) * 100);
        if (el.panelFreeze) el.panelFreeze.textContent = `${freezeChance}%`;
        if (freezeRow) freezeRow.style.display = '';
      } else {
        if (slowRow) slowRow.style.display = 'none';
        if (freezeRow) freezeRow.style.display = 'none';
      }
      
      // Nature element - Poison DPS
      const poisonRow = document.getElementById('stat-row-poison');
      if (tower.elementPath === 'nature') {
        const poisonDmg = abilities.poison?.baseDamage || 4;
        if (el.panelPoison) el.panelPoison.textContent = `${poisonDmg.toFixed(1)}/s`;
        if (poisonRow) poisonRow.style.display = '';
      } else {
        if (poisonRow) poisonRow.style.display = 'none';
      }
      
      // Lightning element - Shock chance  
      const shockRow = document.getElementById('stat-row-shock');
      if (tower.elementPath === 'lightning') {
        // Use baseChance from ELEMENT_ABILITIES
        const shockChance = Math.floor((abilities.shock?.baseChance || 0.1) * 100);
        if (el.panelShock) el.panelShock.textContent = `${shockChance}%`;
        if (shockRow) shockRow.style.display = '';
      } else {
        if (shockRow) shockRow.style.display = 'none';
      }
      
      // Dark element - Life drain %
      const drainRow = document.getElementById('stat-row-drain');
      if (tower.elementPath === 'dark') {
        // Use basePercent from ELEMENT_ABILITIES
        const drainPct = Math.floor((abilities.drain?.basePercent || 0.1) * 100);
        if (el.panelDrain) el.panelDrain.textContent = `${drainPct}%`;
        if (drainRow) drainRow.style.display = '';
      } else {
        if (drainRow) drainRow.style.display = 'none';
      }
      
      // Update level
      if (el.avatarLevel) el.avatarLevel.textContent = `Lvl ${tower.level || 1}`;
      
      // Update XP bar and value using actual level thresholds
      const xp = tower.upgradePoints || 0;
      const level = tower.level || 1;
      // Level thresholds from tower-upgrades.js TOWER_LEVEL_CONFIG
      const levelThresholds = [0, 3, 8, 15, 25, 40, 60, 85, 115, 150];
      const currentThreshold = levelThresholds[level - 1] || 0;
      const nextThreshold = levelThresholds[level] || (currentThreshold + 40);
      const xpInLevel = xp - currentThreshold;
      const xpNeeded = nextThreshold - currentThreshold;
      const xpPercent = Math.min(100, (xpInLevel / xpNeeded) * 100);
      
      if (el.avatarXpFill) {
        el.avatarXpFill.style.width = `${xpPercent}%`;
      }
      if (el.avatarXpValue) {
        el.avatarXpValue.textContent = `${xpInLevel}/${xpNeeded}`;
      }
      
      // Update Energy bar and value
      const energy = tower.energy || 0;
      const maxEnergy = tower.maxEnergy || tower.energyStorage || 100;
      const energyPercent = Math.min(100, (energy / maxEnergy) * 100);
      
      if (el.avatarEnergyFill) {
        el.avatarEnergyFill.style.width = `${energyPercent}%`;
      }
      if (el.avatarEnergyValue) {
        el.avatarEnergyValue.textContent = `${Math.floor(energy)}/${Math.floor(maxEnergy)}`;
      }
      
      // Update stat detail popups
      this.updateStatDetailPopups(tower);
    }
    
    /**
     * Update stat detail popups for tower
     */
    updateStatDetailPopups(tower) {
      const { createDetailBuilder, buildStatDetail, buildCritDetail } = require('./utils/stat-detail-builder');
      const { formatInt, formatNumber, formatPercent } = require('./utils/format-helpers');
      
      const attackType = tower.attackTypeConfig || { dmgMod: 1, rangeMod: 1, atkSpdMod: 1 };
      const level = tower.level || 1;
      const levelBonus = 1 + (level - 1) * 0.01;
      const upgrades = tower.upgradeLevels || {};
      const dmgBiomeBonus = tower.terrainDamageBonus || tower.terrainBonus || 1;
      const rngBiomeBonus = tower.terrainRangeBonus || 1;
      
      // DAMAGE
      const detailDmg = document.getElementById('panel-detail-dmg');
      if (detailDmg) {
        const baseDmg = tower.baseDamage || 10;
        const builder = createDetailBuilder()
          .base('Base:', formatInt(baseDmg))
          .level(level, Math.round((levelBonus - 1) * 100), formatInt(baseDmg * levelBonus))
          .type('Type', attackType.dmgMod || 1, formatInt(baseDmg * levelBonus * (attackType.dmgMod || 1)));
        
        if (upgrades.damage) {
          builder.upgrade(upgrades.damage, upgrades.damage * 5, formatInt(tower.damage));
        }
        if (dmgBiomeBonus !== 1) {
          builder.biome('', dmgBiomeBonus, formatInt(tower.damage));
        }
        builder.final(formatInt(tower.damage || 0))
          .formula('Base × Lvl% × Type × Upg%');
        detailDmg.innerHTML = builder.build();
      }
      
      // SPEED
      const detailSpd = document.getElementById('panel-detail-spd');
      if (detailSpd) {
        const baseSpd = tower.baseFireRate || 1;
        detailSpd.innerHTML = buildStatDetail({
          baseValue: baseSpd, level, typeMod: attackType.atkSpdMod || 1,
          upgradeLevel: upgrades.attackSpeed, upgradePercent: 0.04,
          finalValue: tower.fireRate || tower.attackSpeed, isFloat: true
        });
      }
      
      // RANGE
      const detailRng = document.getElementById('panel-detail-rng');
      if (detailRng) {
        const baseRng = tower.baseRange || 70;
        detailRng.innerHTML = buildStatDetail({
          baseValue: baseRng, level, typeMod: attackType.rangeMod || 1,
          upgradeLevel: upgrades.range, upgradePercent: 0.05,
          finalValue: tower.range, biomeBonus: rngBiomeBonus
        });
      }
      
      // CRIT CHANCE
      const detailCrit = document.getElementById('panel-detail-crit');
      if (detailCrit) {
        const baseCrit = attackType.critChance || tower.baseCritChance || 0.05;
        detailCrit.innerHTML = buildCritDetail({
          baseCrit, upgradeLevel: upgrades.critChance || 0,
          finalCrit: tower.critChance || 0.05, isCritDamage: false
        });
      }
      
      // CRIT DAMAGE
      const detailCritDmg = document.getElementById('panel-detail-critdmg');
      if (detailCritDmg) {
        const baseCritDmg = attackType.critDmgMod || tower.baseCritDmgMod || 1.5;
        detailCritDmg.innerHTML = buildCritDetail({
          baseCrit: baseCritDmg, upgradeLevel: upgrades.critDamage || 0,
          finalCrit: tower.critDmgMod || tower.critMultiplier || 1.5, isCritDamage: true
        });
      }
      
      // POWER COST
      const detailPower = document.getElementById('panel-detail-power');
      if (detailPower) {
        const basePower = tower.baseEnergyCost || 5;
        const effUpgLv = upgrades.powerEfficiency || 0;
        const builder = createDetailBuilder()
          .base('Base:', formatInt(basePower));
        if (effUpgLv > 0) {
          builder.upgrade(effUpgLv, effUpgLv * -3, `${formatInt(tower.energyCostPerShot)}`);
        }
        builder.final(formatInt(tower.energyCostPerShot || 0))
          .formula('Base × (1 - Efficiency%)');
        detailPower.innerHTML = builder.build();
      }
      
      // Update ability stat popups
      this.updateAbilityStatDetailPopups(tower);
    }
    
    /**
     * Update ability stat detail popups for tower
     * Shows base value, upgrade bonuses, and total for element abilities
     * Uses actual tower.elementAbilities which are computed from abilityUpgrades
     */
    updateAbilityStatDetailPopups(tower) {
      const { createDetailBuilder } = require('./utils/stat-detail-builder');
      const { formatInt } = require('./utils/format-helpers');
      const { ELEMENT_ABILITIES } = require('../../core/element-abilities');
      
      const elementPath = tower.elementPath;
      if (!elementPath || !ELEMENT_ABILITIES[elementPath]) return;
      
      const abilities = tower.elementAbilities || {};
      const abilityUpgrades = tower.abilityUpgrades || {};
      const baseConfig = ELEMENT_ABILITIES[elementPath];
      
      // BURN (Fire) - DPS stat
      const detailBurn = document.getElementById('panel-detail-burn');
      if (detailBurn && elementPath === 'fire') {
        const baseDmg = baseConfig.burn?.baseDamage || 5;
        const finalDmg = abilities.burn?.baseDamage || baseDmg;
        const upgLevel = abilityUpgrades.burn_damage || 0;
        const valuePerLevel = baseConfig.upgrades?.burn_damage?.valuePerLevel || 2;
        
        const builder = createDetailBuilder()
          .base('Base:', `${baseDmg}/s`);
        if (upgLevel > 0) {
          builder.line(`Upgrades (${upgLevel}):`, `+${upgLevel * valuePerLevel}`, 'detail-upgrade');
        }
        builder.final(`${formatInt(finalDmg)}/s`)
          .formula('Fire damage per second');
        detailBurn.innerHTML = builder.build();
      }
      
      // SPREAD (Fire) - Ignite chance
      const detailSpread = document.getElementById('panel-detail-spread');
      if (detailSpread && elementPath === 'fire') {
        const baseChance = baseConfig.ignite?.spreadChance || 0.15;
        const finalChance = abilities.ignite?.spreadChance || baseChance;
        const upgLevel = abilityUpgrades.spread_chance || 0;
        const valuePerLevel = baseConfig.upgrades?.spread_chance?.valuePerLevel || 0.08;
        
        const builder = createDetailBuilder()
          .base('Base:', `${Math.round(baseChance * 100)}%`);
        if (upgLevel > 0) {
          builder.line(`Upgrades (${upgLevel}):`, `+${Math.round(upgLevel * valuePerLevel * 100)}%`, 'detail-upgrade');
        }
        builder.final(`${Math.round(finalChance * 100)}%`)
          .formula('Chance to spread fire');
        detailSpread.innerHTML = builder.build();
      }
      
      // SLOW (Ice) - Slow amount
      const detailSlow = document.getElementById('panel-detail-slow');
      if (detailSlow && elementPath === 'ice') {
        const baseSlow = baseConfig.slow?.basePercent || 0.3;
        const finalSlow = abilities.slow?.basePercent || baseSlow;
        const upgLevel = abilityUpgrades.slow_percent || 0;
        const valuePerLevel = baseConfig.upgrades?.slow_percent?.valuePerLevel || 0.08;
        
        const builder = createDetailBuilder()
          .base('Base:', `${Math.round(baseSlow * 100)}%`);
        if (upgLevel > 0) {
          builder.line(`Upgrades (${upgLevel}):`, `+${Math.round(upgLevel * valuePerLevel * 100)}%`, 'detail-upgrade');
        }
        builder.final(`${Math.round(finalSlow * 100)}%`)
          .formula('Enemy speed reduction');
        detailSlow.innerHTML = builder.build();
      }
      
      // FREEZE (Ice) - Freeze chance
      const detailFreeze = document.getElementById('panel-detail-freeze');
      if (detailFreeze && elementPath === 'ice') {
        const baseChance = baseConfig.freeze?.baseChance || 0.08;
        const finalChance = abilities.freeze?.baseChance || baseChance;
        const upgLevel = abilityUpgrades.freeze_chance || 0;
        const valuePerLevel = baseConfig.upgrades?.freeze_chance?.valuePerLevel || 0.04;
        
        const builder = createDetailBuilder()
          .base('Base:', `${Math.round(baseChance * 100)}%`);
        if (upgLevel > 0) {
          builder.line(`Upgrades (${upgLevel}):`, `+${Math.round(upgLevel * valuePerLevel * 100)}%`, 'detail-upgrade');
        }
        builder.final(`${Math.round(finalChance * 100)}%`)
          .formula('Chance to freeze enemy');
        detailFreeze.innerHTML = builder.build();
      }
      
      // POISON (Nature) - DPS stat
      const detailPoison = document.getElementById('panel-detail-poison');
      if (detailPoison && elementPath === 'nature') {
        const baseDmg = baseConfig.poison?.baseDamage || 4;
        const finalDmg = abilities.poison?.baseDamage || baseDmg;
        const upgLevel = abilityUpgrades.poison_damage || 0;
        const valuePerLevel = baseConfig.upgrades?.poison_damage?.valuePerLevel || 1.5;
        
        const builder = createDetailBuilder()
          .base('Base:', `${baseDmg}/s`);
        if (upgLevel > 0) {
          builder.line(`Upgrades (${upgLevel}):`, `+${(upgLevel * valuePerLevel).toFixed(1)}`, 'detail-upgrade');
        }
        builder.final(`${finalDmg.toFixed(1)}/s`)
          .formula('Poison damage per second');
        detailPoison.innerHTML = builder.build();
      }
      
      // SHOCK (Lightning) - Stun chance
      const detailShock = document.getElementById('panel-detail-shock');
      if (detailShock && elementPath === 'lightning') {
        const baseChance = baseConfig.shock?.baseChance || 0.1;
        const finalChance = abilities.shock?.baseChance || baseChance;
        const upgLevel = abilityUpgrades.shock_chance || 0;
        const valuePerLevel = baseConfig.upgrades?.shock_chance?.valuePerLevel || 0.05;
        
        const builder = createDetailBuilder()
          .base('Base:', `${Math.round(baseChance * 100)}%`);
        if (upgLevel > 0) {
          builder.line(`Upgrades (${upgLevel}):`, `+${Math.round(upgLevel * valuePerLevel * 100)}%`, 'detail-upgrade');
        }
        builder.final(`${Math.round(finalChance * 100)}%`)
          .formula('Chance to stun enemy');
        detailShock.innerHTML = builder.build();
      }
      
      // DRAIN (Dark) - Life steal
      const detailDrain = document.getElementById('panel-detail-drain');
      if (detailDrain && elementPath === 'dark') {
        const baseDrain = baseConfig.drain?.basePercent || 0.1;
        const finalDrain = abilities.drain?.basePercent || baseDrain;
        const upgLevel = abilityUpgrades.drain_percent || 0;
        const valuePerLevel = baseConfig.upgrades?.drain_percent?.valuePerLevel || 0.05;
        
        const builder = createDetailBuilder()
          .base('Base:', `${Math.round(baseDrain * 100)}%`);
        if (upgLevel > 0) {
          builder.line(`Upgrades (${upgLevel}):`, `+${Math.round(upgLevel * valuePerLevel * 100)}%`, 'detail-upgrade');
        }
        builder.final(`${Math.round(finalDrain * 100)}%`)
          .formula('HP restored per hit');
        detailDrain.innerHTML = builder.build();
      }
    }
    
    /**
     * Update bottom panel energy stats in real-time
     */
    updateBottomPanelEnergyStats(building) {
      if (!building) return;
      const el = this.elements;
      const state = building.getState?.() || {};
      
      if (el.panelStored) el.panelStored.textContent = `${Math.floor(building.stored || 0)}/${Math.floor(building.capacity || 0)}`;
      if (el.panelOutput) el.panelOutput.textContent = `${Math.floor(building.outputRate || 0)}/s`;
      if (el.panelRange) el.panelRange.textContent = Math.floor(building.range || 0);
      if (el.panelGen) el.panelGen.textContent = `${Math.floor(state.generation || 0)}/s`;
      
      // Update channels display
      const energyModule = this.game?.modules?.energy;
      const powerNetwork = energyModule?.powerNetwork;
      let usedInputs = 0, usedOutputs = 0;
      if (powerNetwork && building.id) {
        const connections = powerNetwork.connections || [];
        usedInputs = connections.filter(c => c.to === building.id).length;
        usedOutputs = connections.filter(c => c.from === building.id).length;
      }
      const maxInputs = building.inputChannels || 0;
      const maxOutputs = building.outputChannels || 0;
      if (el.panelChannels) {
        if (maxInputs > 0 && maxOutputs > 0) {
          el.panelChannels.textContent = `${usedInputs}/${maxInputs} : ${usedOutputs}/${maxOutputs}`;
        } else if (maxOutputs > 0) {
          el.panelChannels.textContent = `Out: ${usedOutputs}/${maxOutputs}`;
        } else if (maxInputs > 0) {
          el.panelChannels.textContent = `In: ${usedInputs}/${maxInputs}`;
        } else {
          el.panelChannels.textContent = '-';
        }
      }
      
      // Update XP bar
      if (el.avatarXpFill) {
        const xpProgress = building.getXpProgress?.() || { percent: 0 };
        el.avatarXpFill.style.width = `${xpProgress.percent}%`;
      }
      if (el.avatarLevel) el.avatarLevel.textContent = `Lvl ${building.level || 1}`;
      
      // Update energy detail popups
      this.updateEnergyDetailPopups(building);
    }
    
    /**
     * Update energy building detail popups
     */
    updateEnergyDetailPopups(building) {
      const { createDetailBuilder } = require('./utils/stat-detail-builder');
      const { formatInt } = require('./utils/format-helpers');
      
      const state = building.getState?.() || {};
      const level = building.level || 1;
      
      // STORED
      const detailStored = document.getElementById('panel-detail-stored');
      if (detailStored) {
        detailStored.innerHTML = createDetailBuilder()
          .line('Current:', `${formatInt(building.stored || 0)}`, 'detail-value')
          .line('Capacity:', `${formatInt(building.capacity || 0)}`, 'detail-base')
          .line('Fill %:', `${Math.round((building.stored / building.capacity) * 100 || 0)}%`, 'detail-level')
          .build();
      }
      
      // OUTPUT
      const detailOutput = document.getElementById('panel-detail-output');
      if (detailOutput) {
        detailOutput.innerHTML = createDetailBuilder()
          .base('Rate:', `${formatInt(building.outputRate || 0)}/s`)
          .line('Connections:', `${building.connections?.length || 0}`, 'detail-value')
          .build();
      }
      
      // CHANNELS (In/Out)
      const detailChannels = document.getElementById('panel-detail-channels');
      if (detailChannels) {
        // Get used channels from power network
        const energyModule = this.game?.modules?.energy;
        const powerNetwork = energyModule?.powerNetwork;
        let usedInputs = 0, usedOutputs = 0;
        if (powerNetwork && building.id) {
          const connections = powerNetwork.connections || [];
          usedInputs = connections.filter(c => c.to === building.id).length;
          usedOutputs = connections.filter(c => c.from === building.id).length;
        }
        const maxInputs = building.inputChannels || 0;
        const maxOutputs = building.outputChannels || 0;
        const baseIn = building.baseInputChannels || 0;
        const baseOut = building.baseOutputChannels || 0;
        const upg = building.upgradeLevels?.channels || 0;
        
        const builder = createDetailBuilder();
        if (maxInputs > 0) {
          builder.line('📥 Inputs:', `${usedInputs}/${maxInputs} used`, usedInputs >= maxInputs ? 'detail-crit' : 'detail-value');
        }
        if (maxOutputs > 0) {
          builder.line('📤 Outputs:', `${usedOutputs}/${maxOutputs} used`, usedOutputs >= maxOutputs ? 'detail-crit' : 'detail-value');
        }
        builder.line('Base:', `${baseIn > 0 ? baseIn : '-'}/${baseOut > 0 ? baseOut : '-'}`, 'detail-base');
        builder.line('Upgraded:', upg > 0 ? `+${upg}` : '-', 'detail-level');
        
        detailChannels.innerHTML = builder.build();
      }
      
      // GENERATION
      const detailGen = document.getElementById('panel-detail-gen');
      if (detailGen) {
        const baseGen = building.baseGeneration || 0;
        detailGen.innerHTML = createDetailBuilder()
          .base('Base:', `${formatInt(baseGen)}/s`)
          .level(level, (level - 1) * 5, `${formatInt(state.generation || 0)}/s`)
          .final(`${formatInt(state.generation || 0)}/s`)
          .build();
      }
      
      // RANGE
      const detailRange = document.getElementById('panel-detail-energy-range');
      if (detailRange) {
        detailRange.innerHTML = createDetailBuilder()
          .base('Range:', `${formatInt(building.range || 0)} cells`)
          .line('Level bonus:', `+${(level - 1) * 5}%`, 'detail-level')
          .build();
      }
    }

    /**
     * Show tower in bottom panel
     */
    showTowerInBottomPanel(tower) {
      if (!tower) {
        this.hideBottomPanelSelection();
        return;
      }
      
      const el = this.elements;
      
      // Show stats content
      if (el.panelStatsEmpty) el.panelStatsEmpty.style.display = 'none';
      if (el.panelStatsContent) el.panelStatsContent.style.display = 'block';
      if (el.statsGridTower) el.statsGridTower.style.display = 'grid';
      if (el.statsGridEnergy) el.statsGridEnergy.style.display = 'none';
      
      // Update stats
      if (el.panelDmg) el.panelDmg.textContent = Math.floor(tower.damage || 0);
      if (el.panelRng) el.panelRng.textContent = Math.floor(tower.range || 0);
      if (el.panelSpd) el.panelSpd.textContent = (tower.attackSpeed || tower.fireRate || 1).toFixed(1);
      if (el.panelCrit) el.panelCrit.textContent = `${Math.floor((tower.critChance || 0) * 100)}%`;
      if (el.panelCritdmg) el.panelCritdmg.textContent = `${Math.floor((tower.critMultiplier || 1.5) * 100)}%`;
      if (el.panelPower) el.panelPower.textContent = Math.floor(tower.energyCostPerShot || 0);
      
      // Show avatar
      if (el.avatarEmpty) el.avatarEmpty.style.display = 'none';
      if (el.avatarContent) el.avatarContent.style.display = 'flex';
      if (el.avatarIcon) el.avatarIcon.textContent = this.getTowerEmoji(tower);
      if (el.avatarName) el.avatarName.textContent = this.getTowerDisplayName(tower);
      if (el.avatarLevel) el.avatarLevel.textContent = `Lvl ${tower.level || 1}`;
      
      // XP bar - use actual level thresholds
      if (el.avatarXpFill && tower.calculateLevel) {
        const xp = tower.upgradePoints || 0;
        const level = tower.level || 1;
        const maxLevel = 10;
        
        // Use actual level thresholds from tower-upgrades.js
        const levelThresholds = [0, 3, 8, 15, 25, 40, 60, 85, 115, 150];
        
        if (level >= maxLevel) {
          el.avatarXpFill.style.width = '100%';
        } else {
          const currentLevelXp = levelThresholds[level - 1] || 0;
          const nextLevelXp = levelThresholds[level] || currentLevelXp + 10;
          const xpInLevel = xp - currentLevelXp;
          const xpNeeded = nextLevelXp - currentLevelXp;
          const percent = Math.min(100, (xpInLevel / xpNeeded) * 100);
          el.avatarXpFill.style.width = `${percent}%`;
        }
      }
      
      // Show tower actions (flex for 3-column layout)
      if (el.actionsBuild) el.actionsBuild.style.display = 'none';
      if (el.actionsTower) el.actionsTower.style.display = 'flex';
      if (el.actionsEnergy) el.actionsEnergy.style.display = 'none';
      
      // Show/hide attack type and element sections (now inside avatar section)
      // Re-query elements in case they weren't found during init
      const actionAttackType = el.actionAttackType || el.bottomPanel?.querySelector('#action-attack-type');
      const actionElement = el.actionElement || el.bottomPanel?.querySelector('#action-element');
      
      if (actionAttackType) {
        actionAttackType.style.display = tower.attackTypeId === 'base' ? 'block' : 'none';
        // Re-attach click handlers if not done
        if (!actionAttackType._eventsAttached) {
          actionAttackType._eventsAttached = true;
          actionAttackType.querySelectorAll('[data-action="attack-type"]').forEach(card => {
            card.addEventListener('click', (e) => {
              e.stopPropagation();
              const type = card.dataset.type;
              this.setTowerAttackType(type);
            });
          });
        }
      }
      if (actionElement) {
        const showElement = tower.attackTypeId !== 'base' && !tower.elementPath;
        actionElement.style.display = showElement ? 'block' : 'none';
        // Re-attach click handlers if not done
        if (!actionElement._eventsAttached) {
          actionElement._eventsAttached = true;
          actionElement.querySelectorAll('[data-action="element"]').forEach(card => {
            card.addEventListener('click', (e) => {
              e.stopPropagation();
              const element = card.dataset.element;
              this.setTowerElement(element);
            });
          });
        }
      }
      
      // Always show tower actions panel when tower is selected
      if (el.actionsTower) {
        el.actionsTower.style.display = 'flex';
      }
      
      // Always update upgrade and abilities grids
      this.updateTowerUpgradesInPanel(tower);
      
      // Update special stats (splash, chain, element abilities)
      this.updateBottomPanelStats(tower);
      
      // Update stat detail popups content
      this.updateStatDetailPopups(tower);
      
      // Re-setup hover positioning for new elements
      this.setupStatHoverPopups();
    }
    
    /**
     * Show energy building in bottom panel
     */
    showEnergyBuildingInBottomPanel(building) {
      if (!building) {
        this.hideBottomPanelSelection();
        return;
      }
      
      const el = this.elements;
      
      // Show stats content
      if (el.panelStatsEmpty) el.panelStatsEmpty.style.display = 'none';
      if (el.panelStatsContent) el.panelStatsContent.style.display = 'block';
      if (el.statsGridTower) el.statsGridTower.style.display = 'none';
      if (el.statsGridEnergy) el.statsGridEnergy.style.display = 'grid';
      
      // Update stats
      const state = building.getState?.() || {};
      if (el.panelStored) el.panelStored.textContent = `${Math.floor(building.stored || 0)}/${Math.floor(building.capacity || 0)}`;
      if (el.panelOutput) el.panelOutput.textContent = `${Math.floor(building.outputRate || 0)}/s`;
      if (el.panelRange) el.panelRange.textContent = Math.floor(building.range || 0);
      if (el.panelGen) el.panelGen.textContent = `${Math.floor(state.generation || 0)}/s`;
      
      // Get used channels from power network
      const energyModule = this.game?.modules?.energy;
      const powerNetwork = energyModule?.powerNetwork;
      let usedInputs = 0, usedOutputs = 0;
      if (powerNetwork && building.id) {
        const connections = powerNetwork.connections || [];
        usedInputs = connections.filter(c => c.to === building.id).length;
        usedOutputs = connections.filter(c => c.from === building.id).length;
      }
      const maxInputs = building.inputChannels || 0;
      const maxOutputs = building.outputChannels || 0;
      if (el.panelChannels) {
        // Format: "usedIn/maxIn : usedOut/maxOut" or just one side if only that exists
        if (maxInputs > 0 && maxOutputs > 0) {
          el.panelChannels.textContent = `${usedInputs}/${maxInputs} : ${usedOutputs}/${maxOutputs}`;
        } else if (maxOutputs > 0) {
          el.panelChannels.textContent = `Out: ${usedOutputs}/${maxOutputs}`;
        } else if (maxInputs > 0) {
          el.panelChannels.textContent = `In: ${usedInputs}/${maxInputs}`;
        } else {
          el.panelChannels.textContent = '-';
        }
      }
      
      // Show avatar
      if (el.avatarEmpty) el.avatarEmpty.style.display = 'none';
      if (el.avatarContent) el.avatarContent.style.display = 'flex';
      if (el.avatarIcon) el.avatarIcon.textContent = this.getEnergyBuildingEmoji(building);
      if (el.avatarName) el.avatarName.textContent = this.getEnergyBuildingName(building);
      if (el.avatarLevel) el.avatarLevel.textContent = `Lvl ${building.level || 1}`;
      
      // Hide attack type and element sections (tower-only)
      if (el.actionAttackType) el.actionAttackType.style.display = 'none';
      if (el.actionElement) el.actionElement.style.display = 'none';
      
      // XP bar for energy buildings
      if (el.avatarXpFill) {
        const xpProgress = building.getXpProgress?.() || { percent: 0 };
        el.avatarXpFill.style.width = `${xpProgress.percent}%`;
      }
      
      // Show energy actions (with upgrades)
      if (el.actionsBuild) el.actionsBuild.style.display = 'none';
      if (el.actionsTower) el.actionsTower.style.display = 'none';
      if (el.actionsEnergy) el.actionsEnergy.style.display = 'flex';
      
      // Update energy upgrades grid
      this.updateEnergyUpgradesInPanel(building);
      
      // Update energy detail popups
      this.updateEnergyDetailPopups(building);
      
      // Setup stat hover popups
      this.setupStatHoverPopups();
    }
    
    /**
     * Update energy building upgrades in panel
     */
    updateEnergyUpgradesInPanel(building) {
      const el = this.elements;
      const upgradesGrid = el.bottomPanel?.querySelector('#energy-upgrades-grid');
      if (!upgradesGrid) return;
      
      const gold = this.game?.getState?.().gold || 0;
      const CONFIG = require('../../core/config');
      const costs = CONFIG.ENERGY_UPGRADE_COSTS || {};
      const bonuses = CONFIG.ENERGY_UPGRADE_BONUSES || {};
      const costMultiplier = CONFIG.ENERGY_UPGRADE_COST_MULTIPLIER || 1.2;
      
      // Clear grid
      upgradesGrid.innerHTML = '';
      
      // Energy building upgrade definitions (costs and bonuses from CONFIG)
      const ENERGY_UPGRADES = [
        { id: 'capacity', name: 'Capacity', emoji: '🔋', stat: 'capacity', 
          bonus: `+${Math.round((bonuses.capacity || 0.10) * 100)}%`, baseCost: costs.capacity || 30 },
        { id: 'output', name: 'Output', emoji: '📤', stat: 'outputRate', 
          bonus: `+${Math.round((bonuses.outputRate || 0.05) * 100)}%`, baseCost: costs.output || 40 },
        { id: 'channels', name: 'Channels', emoji: '🔌', stat: 'channels', 
          bonus: `+${bonuses.channels || 1} In/Out`, baseCost: costs.channels || 60 },
        { id: 'range', name: 'Range', emoji: '📡', stat: 'range', 
          bonus: `+${bonuses.range || 1}`, baseCost: costs.range || 50 },
        { id: 'efficiency', name: 'Efficiency', emoji: '⚡', stat: 'efficiency', 
          bonus: `+${Math.round((bonuses.efficiency || 0.10) * 100)}%`, baseCost: costs.efficiency || 35 },
      ];
      
      // Add generation upgrade for generators
      if (building.type === 'generator' || building.type === 'solar' || building.type === 'hydro' || building.type === 'wind' || building.type === 'geo') {
        ENERGY_UPGRADES.push({ id: 'generation', name: 'Gen Rate', emoji: '⚡', stat: 'generationRate', 
          bonus: `+${Math.round((bonuses.generation || 0.15) * 100)}%`, baseCost: costs.generation || 45 });
      }
      
      for (const upgrade of ENERGY_UPGRADES) {
        const currentLevel = building.upgradeLevels?.[upgrade.id] || 0;
        const cost = Math.floor(upgrade.baseCost * Math.pow(costMultiplier, currentLevel));
        const canAfford = gold >= cost;
        
        const card = document.createElement('div');
        card.className = `upgrade-card${!canAfford ? ' disabled' : ''}`;
        card.dataset.upgradeId = upgrade.id;
        card.innerHTML = `
          <div class="card-top">
            <span class="card-icon">${upgrade.emoji}</span>
            <span class="card-name">${upgrade.name}</span>
          </div>
          <div class="card-bottom">
            <span class="card-cost">${cost}g</span>
            <span class="card-level">Lv.${currentLevel}</span>
            <span class="card-bonus">${upgrade.bonus}</span>
          </div>
        `;
        card.title = `${upgrade.name}\nLevel ${currentLevel} → ${currentLevel + 1}\nCost: ${cost}g`;
        
        if (canAfford) {
          card.addEventListener('click', (e) => {
            e.stopPropagation();
            this.purchaseEnergyUpgrade(building, upgrade.id, cost);
          });
        }
        
        upgradesGrid.appendChild(card);
      }
    }
    
    /**
     * Purchase energy building upgrade
     */
    purchaseEnergyUpgrade(building, upgradeId, cost) {
      const economy = this.game?.modules?.economy;
      if (!economy || economy.gold < cost) return;
      
      // Deduct gold
      economy.spendGold(cost);
      
      // Apply upgrade
      if (!building.upgradeLevels) building.upgradeLevels = {};
      building.upgradeLevels[upgradeId] = (building.upgradeLevels[upgradeId] || 0) + 1;
      
      // Get bonuses from CONFIG
      const CONFIG = require('../../core/config');
      const bonuses = CONFIG.ENERGY_UPGRADE_BONUSES || {};
      
      // Apply stat boost based on upgrade type
      const level = building.upgradeLevels[upgradeId];
      switch (upgradeId) {
        case 'capacity':
          building.capacity = Math.floor((building.baseCapacity || 50) * (1 + level * (bonuses.capacity || 0.10)));
          break;
        case 'output':
          building.outputRate = Math.floor((building.baseOutputRate || 10) * (1 + level * (bonuses.outputRate || 0.05)));
          break;
        case 'range':
          building.range = (building.baseRange || 4) + level * (bonuses.range || 1);
          break;
        case 'efficiency':
          building.efficiency = 1 + level * (bonuses.efficiency || 0.10);
          break;
        case 'generation':
          if (building.generationRate !== undefined) {
            building.generationRate = Math.floor((building.baseGenerationRate || 5) * (1 + level * (bonuses.generation || 0.15)));
          }
          break;
        case 'channels':
          // Channels upgrade: +1 input AND +1 output per level
          // BUT only if building has that channel type (generators have 0 inputs)
          const channelsBonus = bonuses.channels || 1;
          const channelsLevel = level * channelsBonus;
          if ((building.baseInputChannels || 0) > 0) {
            building.inputChannels = building.baseInputChannels + channelsLevel;
          }
          if ((building.baseOutputChannels || 0) > 0) {
            building.outputChannels = building.baseOutputChannels + channelsLevel;
          }
          break;
      }
      
      // Also call recalculateStats if building has it (for PowerNode)
      if (building.recalculateStats) {
        building.recalculateStats();
      }
      
      // Refresh panel
      this.showEnergyBuildingInBottomPanel(building);
    }
    
    /**
     * Hide bottom panel selection (show build grid)
     */
    hideBottomPanelSelection() {
      const el = this.elements;
      
      // Reset stats section
      if (el.panelStatsEmpty) el.panelStatsEmpty.style.display = 'flex';
      if (el.panelStatsContent) el.panelStatsContent.style.display = 'none';
      
      // Reset avatar
      if (el.avatarEmpty) el.avatarEmpty.style.display = 'flex';
      if (el.avatarContent) el.avatarContent.style.display = 'none';
      
      // Show build grid (flex for new layout)
      if (el.actionsBuild) el.actionsBuild.style.display = 'flex';
      if (el.actionsTower) el.actionsTower.style.display = 'none';
      if (el.actionsEnergy) el.actionsEnergy.style.display = 'none';
      
      this.updateBuildItemStates();
    }
    
    /**
     * Get tower emoji - shows element if has one, otherwise attack type
     */
    getTowerEmoji(tower) {
      if (tower.elementPath) {
        const elementEmojis = { fire: '🔥', ice: '❄️', lightning: '⚡', nature: '🌿', dark: '💀' };
        return elementEmojis[tower.elementPath] || '🏗️';
      }
      if (tower.attackTypeId && tower.attackTypeId !== 'base') {
        const typeEmojis = { siege: '💥', normal: '🎯', magic: '✨', piercing: '🗡️', lightning: '⚡' };
        return typeEmojis[tower.attackTypeId] || '🏗️';
      }
      return '🏗️';
    }
    
    /**
     * Get tower display name - shows both attack type and element if present
     */
    getTowerDisplayName(tower) {
      const typeNames = { siege: 'Siege', normal: 'Normal', magic: 'Magic', piercing: 'Piercing', lightning: 'Lightning' };
      const elementNames = { fire: 'Fire', ice: 'Ice', lightning: 'Lightning', nature: 'Nature', dark: 'Dark' };
      
      const hasAttackType = tower.attackTypeId && tower.attackTypeId !== 'base';
      const hasElement = !!tower.elementPath;
      
      if (hasAttackType && hasElement) {
        // Show both: "Siege Fire Tower"
        return `${typeNames[tower.attackTypeId] || ''} ${elementNames[tower.elementPath] || ''} Tower`;
      }
      if (hasElement) {
        return `${elementNames[tower.elementPath] || ''} Tower`;
      }
      if (hasAttackType) {
        return `${typeNames[tower.attackTypeId] || ''} Tower`;
      }
      return 'Tower';
    }
    
    /**
     * Get energy building emoji
     */
    getEnergyBuildingEmoji(building) {
      const emojis = {
        'base-generator': '⚡',
        'bio-generator': '🌳',
        'wind-generator': '💨',
        'solar-generator': '☀️',
        'water-generator': '💧',
        'battery': '🔋',
        'power-transfer': '🔌'
      };
      return emojis[building.type] || '⚡';
    }
    
    /**
     * Get energy building name
     */
    getEnergyBuildingName(building) {
      const names = {
        'base-generator': 'Generator',
        'bio-generator': 'Bio Gen',
        'wind-generator': 'Wind',
        'solar-generator': 'Solar',
        'water-generator': 'Hydro',
        'battery': 'Battery',
        'power-transfer': 'Relay'
      };
      return names[building.type] || 'Building';
    }

    /**
     * Update tower upgrades in bottom panel - compact card layout
     */
    updateTowerUpgradesInPanel(tower) {
      const el = this.elements;
      
      // Try to get element directly if not in cache
      if (!el.upgradesGridPanel) {
        el.upgradesGridPanel = el.bottomPanel?.querySelector('#upgrades-grid-panel');
      }
      
      if (!el.upgradesGridPanel) {
        console.warn('[BottomPanel] upgradesGridPanel not found');
        return;
      }
      
      console.log('[BottomPanel] Updating upgrades for tower:', tower?.id, 'attackTypeId:', tower?.attackTypeId);
      
      const gold = this.game?.getState?.().gold || 0;
      const towerLevel = tower.level || 1;
      
      // Clear current upgrades
      el.upgradesGridPanel.innerHTML = '';
      
      // Get upgrade utilities
      const { 
        STAT_UPGRADES, 
        calculateUpgradeCost, 
        isUpgradeAvailable,
        getUpgradeEffectValue 
      } = require('../../core/tower-upgrade-list');
      
      // All possible stat upgrades
      const allUpgrades = [
        'damage', 'attackSpeed', 'range', 'critChance', 'critDamage',
        'powerEfficiency', 'hp', 'hpRegen', 'energyStorage',
        'splashRadius', 'chainCount', 'powerScaling'
      ];
      
      // Filter to available upgrades for this tower
      const availableUpgrades = allUpgrades.filter(id => {
        const upgrade = STAT_UPGRADES[id];
        const available = upgrade && isUpgradeAvailable(upgrade, tower);
        return available;
      });
      
      console.log('[BottomPanel] Available upgrades:', availableUpgrades.length, availableUpgrades);
      
      for (const upgradeId of availableUpgrades) {
        const upgrade = STAT_UPGRADES[upgradeId];
        if (!upgrade) continue;
        
        const currentLevel = tower.getUpgradeLevel?.(upgradeId) || 0;
        const cost = calculateUpgradeCost(upgrade, currentLevel, towerLevel);
        const canAfford = gold >= cost;
        
        // Calculate bonus text
        let bonusText = '';
        if (upgrade.effect.percentPerLevel) {
          bonusText = `+${Math.round(upgrade.effect.percentPerLevel * 100)}%`;
        } else if (upgrade.effect.valuePerLevel) {
          const val = upgrade.effect.valuePerLevel;
          if (val < 1) {
            bonusText = `+${Math.round(val * 100)}%`;
          } else {
            bonusText = `+${val}`;
          }
        }
        
        // Short name for card
        const shortNames = {
          damage: 'DMG',
          attackSpeed: 'SPD',
          range: 'RNG',
          critChance: 'CRIT',
          critDamage: 'CDMG',
          powerEfficiency: 'PWR',
          hp: 'HP',
          hpRegen: 'REGEN',
          energyStorage: 'STOR',
          splashRadius: 'SPLASH',
          chainCount: 'CHAIN',
          powerScaling: 'SCALE'
        };
        
        const card = document.createElement('div');
        card.className = `upgrade-card${!canAfford ? ' disabled' : ''}`;
        card.dataset.upgradeId = upgradeId;
        card.dataset.category = upgrade.category || 'offense';
        card.innerHTML = `
          <div class="card-top">
            <span class="card-icon">${upgrade.emoji}</span>
            <span class="card-name">${shortNames[upgradeId] || upgrade.name.slice(0, 4)}</span>
          </div>
          <div class="card-bottom">
            <span class="card-cost">${cost}g</span>
            <span class="card-level">Lv.${currentLevel}</span>
            <span class="card-bonus">${bonusText}</span>
          </div>
        `;
        card.title = `${upgrade.name}\nLevel ${currentLevel} → ${currentLevel + 1}\nCost: ${cost}g\n${upgrade.description}`;
        
        if (canAfford) {
          card.addEventListener('click', (e) => {
            e.stopPropagation();
            this.purchaseUpgrade(upgradeId);
            // Refresh after purchase
            if (this.game?.selectedTower) {
              this.showTowerInBottomPanel(this.game.selectedTower);
            }
          });
        }
        
        el.upgradesGridPanel.appendChild(card);
      }
      
      console.log('[BottomPanel] Added cards to grid, children count:', el.upgradesGridPanel.children.length);
      
      // Also update abilities panel
      this.updateTowerAbilitiesInPanel(tower);
    }
    
    /**
     * Update tower abilities in bottom panel
     * Shows ELEMENT_ABILITIES upgrades (burn_damage, slow_percent, etc.)
     */
    updateTowerAbilitiesInPanel(tower) {
      const el = this.elements;
      if (!el.abilitiesGridPanel) return;
      
      const gold = this.game?.getState?.().gold || 0;
      
      // Clear current abilities
      el.abilitiesGridPanel.innerHTML = '';
      
      // Get element abilities
      const { ELEMENT_ABILITIES, getAbilityUpgradeCost } = require('../../core/element-abilities');
      
      const elementPath = tower.elementPath;
      if (!elementPath || !ELEMENT_ABILITIES[elementPath]) {
        // No element - show hint
        el.abilitiesGridPanel.innerHTML = `
          <div class="ability-hint">
            Choose an element first
          </div>
        `;
        return;
      }
      
      const elementConfig = ELEMENT_ABILITIES[elementPath];
      const abilityUpgrades = tower.abilityUpgrades || {};
      
      // Show all upgrades for this element
      for (const [upgradeId, upgrade] of Object.entries(elementConfig.upgrades || {})) {
        const currentLevel = abilityUpgrades[upgradeId] || 0;
        const maxLevel = upgrade.maxLevel;
        const isMaxed = currentLevel >= maxLevel;
        const cost = isMaxed ? 0 : getAbilityUpgradeCost(elementPath, upgradeId, currentLevel);
        const canAfford = gold >= cost;
        
        // Format value for display
        let bonusText = '';
        const value = upgrade.valuePerLevel;
        const stat = upgrade.stat;
        if (stat.includes('Percent') || stat.includes('Chance') || stat.includes('Reduction')) {
          bonusText = `+${Math.round(value * 100)}%`;
        } else if (stat.includes('Duration')) {
          bonusText = `+${value.toFixed(1)}s`;
        } else {
          bonusText = value < 1 ? `+${Math.round(value * 100)}%` : `+${value}`;
        }
        
        const card = document.createElement('div');
        card.className = `upgrade-card${isMaxed ? ' maxed' : ''}${!canAfford && !isMaxed ? ' disabled' : ''}`;
        card.dataset.upgradeId = upgradeId;
        card.dataset.element = elementPath;
        card.innerHTML = `
          <div class="card-top">
            <span class="card-icon">${upgrade.icon}</span>
            <span class="card-name">${upgrade.name.slice(0, 6)}</span>
          </div>
          <div class="card-bottom">
            <span class="card-cost">${isMaxed ? 'MAX' : `${cost}g`}</span>
            <span class="card-level">${currentLevel}/${maxLevel}</span>
            <span class="card-bonus">${bonusText}</span>
          </div>
        `;
        card.title = `${upgrade.name}\nLevel ${currentLevel}/${maxLevel}\n${isMaxed ? 'MAXED' : `Cost: ${cost}g`}\n${upgrade.description.replace('{value}', bonusText)}`;
        
        if (canAfford && !isMaxed) {
          card.addEventListener('click', (e) => {
            e.stopPropagation();
            // Purchase ability upgrade
            if (this.purchaseAbilityUpgrade) {
              this.purchaseAbilityUpgrade(upgradeId);
            }
          });
        }
        
        el.abilitiesGridPanel.appendChild(card);
      }
    }
  };
}

module.exports = { BottomPanelMixin };
