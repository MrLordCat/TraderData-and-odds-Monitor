/**
 * Power Towers TD - Tower Stats UI
 * Tower statistics display and detail popups
 */

/**
 * Mixin for tower stats in bottom panel
 * @param {Class} Base - Base class
 */
function TowerStatsMixin(Base) {
  return class extends Base {
    
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
        const slowPct = Math.floor((abilities.slow?.basePercent || 0.3) * 100);
        if (el.panelSlow) el.panelSlow.textContent = `${slowPct}%`;
        if (slowRow) slowRow.style.display = '';
        
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
        const shockChance = Math.floor((abilities.shock?.baseChance || 0.1) * 100);
        if (el.panelShock) el.panelShock.textContent = `${shockChance}%`;
        if (shockRow) shockRow.style.display = '';
      } else {
        if (shockRow) shockRow.style.display = 'none';
      }
      
      // Dark element - Life drain %
      const drainRow = document.getElementById('stat-row-drain');
      if (tower.elementPath === 'dark') {
        const drainPct = Math.floor((abilities.drain?.basePercent || 0.1) * 100);
        if (el.panelDrain) el.panelDrain.textContent = `${drainPct}%`;
        if (drainRow) drainRow.style.display = '';
      } else {
        if (drainRow) drainRow.style.display = 'none';
      }
      
      // Update level
      if (el.avatarLevel) el.avatarLevel.textContent = `Lvl ${tower.level || 1}`;
      
      // Update XP bar and value using xp-utils
      const { getTowerXpProgress } = require('../../../core/utils/xp-utils');
      const xp = tower.upgradePoints || 0;
      const level = tower.level || 1;
      const xpProgress = getTowerXpProgress(xp, level);
      
      if (el.avatarXpFill) {
        el.avatarXpFill.style.width = `${xpProgress.percent}%`;
      }
      if (el.avatarXpValue) {
        el.avatarXpValue.textContent = `${xpProgress.current}/${xpProgress.needed}`;
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
      const { formatInt } = require('./utils/format-helpers');
      
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
     */
    updateAbilityStatDetailPopups(tower) {
      const { createDetailBuilder } = require('./utils/stat-detail-builder');
      const { formatInt } = require('./utils/format-helpers');
      const { ELEMENT_ABILITIES } = require('../../../core/element-abilities');
      
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
      
      // XP bar - use xp-utils
      if (el.avatarXpFill) {
        const { getTowerXpProgress } = require('../../../core/utils/xp-utils');
        const xp = tower.upgradePoints || 0;
        const level = tower.level || 1;
        const xpProgress = getTowerXpProgress(xp, level);
        el.avatarXpFill.style.width = `${xpProgress.percent}%`;
      }
      
      // Show tower actions (flex for 3-column layout)
      if (el.actionsBuild) el.actionsBuild.style.display = 'none';
      if (el.actionsTower) el.actionsTower.style.display = 'flex';
      if (el.actionsEnergy) el.actionsEnergy.style.display = 'none';
      
      // Show/hide attack type and element sections
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
  };
}

module.exports = { TowerStatsMixin };
