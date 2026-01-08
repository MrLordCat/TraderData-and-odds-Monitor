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
      
      // Calculate effective damage (including combo bonus for Normal attack)
      let effectiveDamage = tower.damage || 0;
      let comboMultiplier = 1;
      if (tower.attackTypeId === 'normal' && tower.comboState) {
        const { getComboConfig } = require('../../towers/tower-combat');
        const comboConfig = getComboConfig(tower);
        comboMultiplier = 1 + (tower.comboState.stacks * comboConfig.dmgPerStack);
        effectiveDamage = (tower.damage || 0) * comboMultiplier;
      }
      
      // Update stats values only (no layout changes)
      if (el.panelDmg) {
        el.panelDmg.textContent = Math.floor(effectiveDamage);
        // Highlight if combo is active
        if (comboMultiplier > 1) {
          el.panelDmg.style.color = '#4da6ff'; // Blue tint for combo
          el.panelDmg.title = `Base: ${Math.floor(tower.damage)} (+${Math.round((comboMultiplier - 1) * 100)}% combo)`;
        } else {
          el.panelDmg.style.color = '';
          el.panelDmg.title = '';
        }
      }
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
      
      // Armor Shred for Siege attack type
      const shredRow = document.getElementById('stat-row-shred');
      if (tower.attackTypeId === 'siege' && tower.armorShredEnabled) {
        const shredPct = Math.round((tower.armorShredAmount || 0.05) * 100);
        const maxPct = shredPct * (tower.armorShredMaxStacks || 5);
        if (el.panelShred) el.panelShred.textContent = `-${shredPct}%`;
        if (shredRow) shredRow.style.display = '';
      } else if (shredRow) {
        shredRow.style.display = 'none';
      }
      
      // Ground Zone (Crater) for Siege attack type
      const craterRow = document.getElementById('stat-row-crater');
      if (tower.attackTypeId === 'siege') {
        if (tower.groundZoneEnabled) {
          const slowPct = Math.round((tower.groundZoneSlow || 0.25) * 100);
          if (el.panelCrater) el.panelCrater.textContent = `${slowPct}%`;
        } else {
          if (el.panelCrater) el.panelCrater.textContent = 'OFF';
        }
        if (craterRow) craterRow.style.display = '';
      } else if (craterRow) {
        craterRow.style.display = 'none';
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
      
      // === NORMAL ATTACK TYPE - Combo & Focus Fire Stats ===
      const comboRow = document.getElementById('stat-row-combo');
      const focusRow = document.getElementById('stat-row-focus');
      if (tower.attackTypeId === 'normal') {
        const { getComboConfig, getFocusFireConfig } = require('../../towers/tower-combat');
        const comboConfig = getComboConfig(tower);
        const focusConfig = getFocusFireConfig(tower);
        const comboState = tower.comboState || { stacks: 0, focusHits: 0 };
        
        // Combo stacks display
        if (el.panelCombo) {
          const comboDmgBonus = Math.round(comboState.stacks * comboConfig.dmgPerStack * 100);
          el.panelCombo.textContent = `${comboState.stacks}/${comboConfig.maxStacks}`;
          el.panelCombo.title = `+${comboDmgBonus}% DMG`;
        }
        if (comboRow) comboRow.style.display = '';
        
        // Focus progress display
        if (el.panelFocus) {
          const ready = comboState.focusHits >= focusConfig.hitsRequired;
          el.panelFocus.textContent = ready ? 'READY!' : `${comboState.focusHits}/${focusConfig.hitsRequired}`;
          el.panelFocus.style.color = ready ? '#ffd700' : '';
        }
        if (focusRow) focusRow.style.display = '';
      } else {
        if (comboRow) comboRow.style.display = 'none';
        if (focusRow) focusRow.style.display = 'none';
      }
      
      // === MAGIC ATTACK TYPE - Charge stats (real-time update) ===
      const chargeRow = document.getElementById('stat-row-charge');
      const magicbonusRow = document.getElementById('stat-row-magicbonus');
      const overflowRow = document.getElementById('stat-row-overflow');
      if (tower.attackTypeId === 'magic') {
        // Update real-time magic stats via updateMagicChargeUI
        this.updateMagicChargeUI(tower);
      } else {
        // Hide magic rows for non-magic towers
        if (chargeRow) chargeRow.style.display = 'none';
        if (magicbonusRow) magicbonusRow.style.display = 'none';
        if (overflowRow) overflowRow.style.display = 'none';
      }
      
      // === PIERCING ATTACK TYPE - Precision, Momentum, Execute, Bleed ===
      const precisionRow = document.getElementById('stat-row-precision');
      const momentumRow = document.getElementById('stat-row-momentum');
      const executeRow = document.getElementById('stat-row-execute');
      const bleedRow = document.getElementById('stat-row-bleed');
      if (tower.attackTypeId === 'piercing') {
        const { getPiercingConfig } = require('../../towers/tower-combat');
        const piercingConfig = getPiercingConfig(tower);
        const piercingState = tower.piercingState || { precisionHits: 0, momentumStacks: 0 };
        
        // Precision progress
        if (el.panelPrecision) {
          const ready = piercingState.precisionHits >= piercingConfig.precisionHitsRequired;
          el.panelPrecision.textContent = ready ? 'READY!' : `${piercingState.precisionHits}/${piercingConfig.precisionHitsRequired}`;
          el.panelPrecision.style.color = ready ? '#ffd700' : '';
        }
        if (precisionRow) precisionRow.style.display = '';
        
        // Momentum stacks
        if (el.panelMomentum) {
          const momentumBonus = Math.round(piercingState.momentumStacks * piercingConfig.momentumChancePerStack * 100);
          el.panelMomentum.textContent = `${piercingState.momentumStacks}/${piercingConfig.momentumMaxStacks}`;
          el.panelMomentum.title = `+${momentumBonus}% Crit Chance`;
          el.panelMomentum.style.color = piercingState.momentumStacks > 0 ? '#f59e0b' : '';
        }
        if (momentumRow) momentumRow.style.display = '';
        
        // Execute threshold
        if (el.panelExecute) {
          const threshold = Math.round(piercingConfig.executeThreshold * 100);
          const bonus = Math.round(piercingConfig.executeBonusDamage * 100);
          el.panelExecute.textContent = `<${threshold}%`;
          el.panelExecute.title = `+${bonus}% DMG vs targets below ${threshold}% HP`;
        }
        if (executeRow) executeRow.style.display = '';
        
        // Bleed status
        if (el.panelBleed) {
          if (piercingConfig.bleedEnabled) {
            const dps = piercingConfig.bleedDamage;
            el.panelBleed.textContent = `${dps}/s`;
            el.panelBleed.title = `${dps} DPS × ${piercingConfig.bleedMaxStacks} max stacks for ${piercingConfig.bleedDuration}s`;
          } else {
            el.panelBleed.textContent = 'OFF';
            el.panelBleed.title = 'Purchase Hemorrhage upgrade to enable';
          }
        }
        if (bleedRow) bleedRow.style.display = '';
        
        // Armor Penetration
        const armorpenRow = document.getElementById('stat-row-armorpen');
        if (el.panelArmorpen) {
          const armorPen = Math.round(piercingConfig.armorPenetration * 100);
          el.panelArmorpen.textContent = `${armorPen}%`;
          el.panelArmorpen.title = `Ignores ${armorPen}% of enemy armor`;
        }
        if (armorpenRow) armorpenRow.style.display = '';
      } else {
        // Hide piercing rows for non-piercing towers
        if (precisionRow) precisionRow.style.display = 'none';
        if (momentumRow) momentumRow.style.display = 'none';
        if (executeRow) executeRow.style.display = 'none';
        if (bleedRow) bleedRow.style.display = 'none';
        const armorpenRow = document.getElementById('stat-row-armorpen');
        if (armorpenRow) armorpenRow.style.display = 'none';
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
      const energy = tower.currentEnergy || 0;
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
      const attackTypeName = tower.attackTypeId || 'normal';
      const level = tower.level || 1;
      const levelBonus = 1 + (level - 1) * 0.01;
      const upgrades = tower.upgradeLevels || {};
      const dmgBiomeBonus = tower.terrainDamageBonus || tower.terrainBonus || 1;
      const rngBiomeBonus = tower.terrainRangeBonus || 1;
      
      // DAMAGE
      const detailDmg = document.getElementById('panel-detail-dmg');
      if (detailDmg) {
        const baseDmg = tower.baseDamage || 10;
        const typeMod = attackType.dmgMod || 1;
        const afterType = baseDmg * typeMod;
        const afterLevel = afterType * levelBonus;
        const builder = createDetailBuilder()
          .base('Base:', formatInt(baseDmg))
          .type('Type', typeMod, formatInt(afterType))
          .level(level, Math.round((levelBonus - 1) * 100), formatInt(afterLevel));
        
        if (upgrades.damage) {
          builder.upgrade(upgrades.damage, upgrades.damage * 5, formatInt(tower.damage));
        }
        if (dmgBiomeBonus !== 1) {
          builder.biome('', dmgBiomeBonus, formatInt(tower.damage));
        }
        
        // Add combo bonus for Normal attack type
        let effectiveDamage = tower.damage || 0;
        if (tower.attackTypeId === 'normal' && tower.comboState && tower.comboState.stacks > 0) {
          const { getComboConfig } = require('../../towers/tower-combat');
          const comboConfig = getComboConfig(tower);
          const comboMultiplier = 1 + (tower.comboState.stacks * comboConfig.dmgPerStack);
          const comboPercent = Math.round((comboMultiplier - 1) * 100);
          effectiveDamage = (tower.damage || 0) * comboMultiplier;
          builder.custom(`🔥 Combo (${tower.comboState.stacks}):`, `+${comboPercent}%`, formatInt(effectiveDamage), '#4da6ff');
        }
        
        builder.final(formatInt(effectiveDamage))
          .formula('(Base × Type) × Lvl% × Upg%' + (tower.attackTypeId === 'normal' ? ' × Combo%' : ''));
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
      
      // =========================================
      // SIEGE ATTACK TYPE STATS
      // =========================================
      
      // SPLASH RADIUS (Siege)
      const detailSplash = document.getElementById('panel-detail-splash');
      if (detailSplash && (attackTypeName === 'siege' || tower.splashRadius > 0)) {
        const baseSplash = attackType.splashRadius || 60;
        const splashUpg = upgrades.splashRadius || 0;
        const falloffUpg = upgrades.splashFalloff || 0;
        const falloffPct = Math.round((tower.splashDmgFalloff || 0.5) * 100);
        
        const builder = createDetailBuilder()
          .base('Base Radius:', `${baseSplash}px`);
        if (splashUpg > 0) {
          builder.line(`Blast Radius (${splashUpg}):`, `+${splashUpg * 8}%`, 'detail-upgrade');
        }
        builder.line('Final Radius:', `${formatInt(tower.splashRadius)}px`, 'detail-final')
          .line('Falloff:', `${falloffPct}%`, 'detail-base');
        if (falloffUpg > 0) {
          builder.line(`Concentrated (${falloffUpg}):`, `-${falloffUpg * 5}%`, 'detail-upgrade');
        }
        builder.final(`${formatInt(tower.splashRadius)}px`)
          .formula('AoE damage with edge falloff');
        detailSplash.innerHTML = builder.build();
      }
      
      // ARMOR SHRED (Siege)
      const detailShred = document.getElementById('panel-detail-shred');
      if (detailShred && attackTypeName === 'siege' && tower.armorShredEnabled) {
        const baseShred = 5; // 5% base
        const shredAmountUpg = upgrades.shredAmount || 0;
        const shredStacksUpg = upgrades.shredStacks || 0;
        const shredDurUpg = upgrades.shredDuration || 0;
        
        const shredPct = Math.round((tower.armorShredAmount || 0.05) * 100);
        const maxStacks = tower.armorShredMaxStacks || 5;
        const maxShred = shredPct * maxStacks;
        const duration = (tower.armorShredDuration || 4000) / 1000;
        
        const builder = createDetailBuilder()
          .base('Armor Reduction:', `-${shredPct}%/hit`);
        if (shredAmountUpg > 0) {
          builder.line(`Sunder (${shredAmountUpg}):`, `+${shredAmountUpg * 2}%`, 'detail-upgrade');
        }
        builder.line('Max Stacks:', `${maxStacks}`, 'detail-base');
        if (shredStacksUpg > 0) {
          builder.line(`Deep Wounds (${shredStacksUpg}):`, `+${shredStacksUpg}`, 'detail-upgrade');
        }
        builder.line('Duration:', `${duration.toFixed(1)}s`, 'detail-base');
        if (shredDurUpg > 0) {
          builder.line(`Lasting (${shredDurUpg}):`, `+${shredDurUpg}s`, 'detail-upgrade');
        }
        builder.line('Max Reduction:', `-${maxShred}%`, 'detail-biome')
          .final(`-${maxShred}%`)
          .formula('Stacking armor debuff');
        detailShred.innerHTML = builder.build();
      }
      
      // GROUND ZONE / CRATER (Siege)
      const detailCrater = document.getElementById('panel-detail-crater');
      if (detailCrater && attackTypeName === 'siege') {
        // Ground Zone upgrades are ATTACK TYPE upgrades, not stat upgrades!
        const attackUpgrades = tower.attackTypeUpgrades || {};
        const craterUnlocked = tower.groundZoneEnabled;
        const craterUnlockUpg = attackUpgrades.groundZoneUnlock || 0;
        const slowUpg = attackUpgrades.groundZoneSlow || 0;
        const durUpg = attackUpgrades.groundZoneDuration || 0;
        const radiusUpg = attackUpgrades.groundZoneRadius || 0;
        
        const builder = createDetailBuilder();
        
        if (craterUnlocked) {
          const slowPct = Math.round((tower.groundZoneSlow || 0.25) * 100);
          const duration = (tower.groundZoneDuration || 2000) / 1000;
          const radius = tower.groundZoneRadius || 40;
          
          builder.base('Status:', '✅ Unlocked', 'detail-upgrade')
            .line('Slow:', `${slowPct}%`, 'detail-base');
          if (slowUpg > 0) {
            builder.line(`Tar Pit (${slowUpg}):`, `+${slowUpg * 5}%`, 'detail-upgrade');
          }
          builder.line('Duration:', `${duration.toFixed(1)}s`, 'detail-base');
          if (durUpg > 0) {
            builder.line(`Lingering (${durUpg}):`, `+${(durUpg * 0.5).toFixed(1)}s`, 'detail-upgrade');
          }
          builder.line('Radius:', `${radius}px`, 'detail-base');
          if (radiusUpg > 0) {
            builder.line(`Wide (${radiusUpg}):`, `+${radiusUpg * 5}px`, 'detail-upgrade');
          }
          builder.final(`${slowPct}% slow`)
            .formula('Explosions leave slowing craters');
        } else {
          builder.base('Status:', '🔒 Locked', 'detail-locked')
            .line('Unlock:', 'Crater Zone upgrade', 'detail-base')
            .final('OFF')
            .formula('Purchase Crater Zone to unlock');
        }
        detailCrater.innerHTML = builder.build();
      }
      
      // COMBO SYSTEM (Normal Attack)
      const detailCombo = document.getElementById('panel-detail-combo');
      if (detailCombo && attackTypeName === 'normal') {
        const { getComboConfig } = require('../../../modules/towers/tower-combat');
        const config = getComboConfig(tower);
        const attackUpg = tower.attackTypeUpgrades || {};
        const comboDmgLv = attackUpg.comboDamage || 0;
        const comboStacksLv = attackUpg.comboMaxStacks || 0;
        const comboDecayLv = attackUpg.comboDecay || 0;
        
        const currentStacks = tower.comboStacks || 0;
        const totalBonus = Math.round(currentStacks * config.dmgPerStack * 100);
        
        const builder = createDetailBuilder()
          .base('Dmg/Stack:', `+${Math.round(config.dmgPerStack * 100)}%`);
        if (comboDmgLv > 0) {
          builder.line(`  Upgrades (${comboDmgLv}):`, `+${comboDmgLv}%`, 'detail-upgrade');
        }
        builder.line('Max Stacks:', `${config.maxStacks}`, 'detail-base');
        if (comboStacksLv > 0) {
          builder.line(`  Upgrades (${comboStacksLv}):`, `+${comboStacksLv * 2}`, 'detail-upgrade');
        }
        builder.line('Decay Time:', `${config.decayTime.toFixed(1)}s`, 'detail-base');
        if (comboDecayLv > 0) {
          builder.line(`  Upgrades (${comboDecayLv}):`, `+${(comboDecayLv * 0.5).toFixed(1)}s`, 'detail-upgrade');
        }
        builder.line('Current:', `${currentStacks}/${config.maxStacks}`, 'detail-biome')
          .final(`+${totalBonus}%`)
          .formula('Bonus = Stacks × Dmg/Stack');
        detailCombo.innerHTML = builder.build();
      }
      
      // FOCUS FIRE (Normal Attack)
      const detailFocus = document.getElementById('panel-detail-focus');
      if (detailFocus && attackTypeName === 'normal') {
        const { getFocusFireConfig } = require('../../../modules/towers/tower-combat');
        const config = getFocusFireConfig(tower);
        const attackUpg = tower.attackTypeUpgrades || {};
        const focusLv = attackUpg.focusFire || 0;
        const focusCritLv = attackUpg.focusCritBonus || 0;
        
        const currentHits = tower.focusHits || 0;
        const effectiveCrit = (tower.critDmgMod || 1.5) + config.critBonus;
        
        const builder = createDetailBuilder()
          .base('Hits Required:', `${config.hitsRequired}`);
        if (focusLv > 0) {
          builder.line(`  Upgrades (${focusLv}):`, `-${focusLv}`, 'detail-upgrade');
        }
        builder.line('Crit Bonus:', `+${Math.round(config.critBonus * 100)}%`, 'detail-base');
        if (focusCritLv > 0) {
          builder.line(`  Upgrades (${focusCritLv}):`, `+${Math.round(focusCritLv * 0.15 * 100)}%`, 'detail-upgrade');
        }
        builder.line('Progress:', `${currentHits}/${config.hitsRequired}`, 'detail-biome')
          .final(`${effectiveCrit.toFixed(1)}x`)
          .formula('Focus = Guaranteed Crit + Bonus');
        detailFocus.innerHTML = builder.build();
      }
      
      // MAGIC CHARGE stat popup
      const detailCharge = document.getElementById('panel-detail-charge');
      if (detailCharge && attackTypeName === 'magic') {
        const { getMagicConfig } = require('../../../modules/towers/tower-combat');
        const config = getMagicConfig(tower);
        const magicState = tower.magicState || {};
        const shotCost = magicState.shotCost || 0;
        const currentCharge = magicState.currentCharge || 0;
        const chargePercent = magicState.chargePercent || 50;
        
        // New formula values from magicState
        const dmgComponent = magicState.dmgComponent || (tower.damage || 10) * (config.dmgMultiplier || 1.2);
        const afterLinear = magicState.afterLinear || dmgComponent * (1 + chargePercent / 100);
        const afterQuadratic = magicState.afterQuadratic || afterLinear * (1 + chargePercent / 100);
        
        const builder = createDetailBuilder()
          .base('Charge %:', `${chargePercent}%`)
          .line('Formula:', `DMG×${config.dmgMultiplier} × (1+%)²`, 'detail-base')
          .line('DMG Component:', `${Math.round(dmgComponent)}⚡`, 'detail-level')
          .line(`Linear (+${chargePercent}%):`, `${Math.round(afterLinear)}⚡`, 'detail-upgrade')
          .line(`Quadratic (+${chargePercent}%):`, `${Math.round(afterQuadratic)}⚡`, 'detail-upgrade')
          .line('Current:', `${Math.round(currentCharge)}/${Math.round(shotCost)}⚡`, 'detail-biome')
          .final(`${Math.round(shotCost)}⚡`)
          .formula('Higher % = more damage but slower');
        detailCharge.innerHTML = builder.build();
      }
      
      // MAGIC BONUS stat popup
      const detailMagicBonus = document.getElementById('panel-detail-magicbonus');
      if (detailMagicBonus && attackTypeName === 'magic') {
        const { getMagicConfig } = require('../../../modules/towers/tower-combat');
        const config = getMagicConfig(tower);
        const magicState = tower.magicState || {};
        const shotCost = magicState.shotCost || 0;
        const bonusDamage = magicState.bonusDamage || 0;
        const upgrades = tower.upgradeLevels || {};
        const efficiencyLv = upgrades.magicEfficiency || 0;
        
        const builder = createDetailBuilder()
          .base('Base Divisor:', `${config.baseDivisor}`);
        if (efficiencyLv > 0) {
          builder.line(`Upgrades (${efficiencyLv}):`, `-${(efficiencyLv * 0.1).toFixed(1)}`, 'detail-upgrade');
        }
        builder.line('Current Divisor:', `${config.efficiencyDivisor.toFixed(1)}`, 'detail-level')
          .line('Shot Cost:', `${Math.round(shotCost)}⚡`, 'detail-base')
          .line('Formula:', `Cost / Divisor`, 'detail-base')
          .final(`+${Math.round(bonusDamage)}`)
          .formula('Energy invested → bonus damage');
        detailMagicBonus.innerHTML = builder.build();
      }
      
      // OVERFLOW stat popup
      const detailOverflow = document.getElementById('panel-detail-overflow');
      if (detailOverflow && attackTypeName === 'magic') {
        const { getMagicConfig } = require('../../../modules/towers/tower-combat');
        const config = getMagicConfig(tower);
        const upgrades = tower.upgradeLevels || {};
        const overflowRangeLv = upgrades.overflowRange || 0;
        const overflowDmgLv = upgrades.overflowDamage || 0;
        
        const baseTransfer = 0.75;
        const finalTransfer = config.overflowTransfer;
        const baseRadius = 80;
        const finalRadius = config.overflowRadius;
        
        const builder = createDetailBuilder()
          .base('Base Transfer:', `${Math.round(baseTransfer * 100)}%`);
        if (overflowDmgLv > 0) {
          builder.line(`Cascade (${overflowDmgLv}):`, `+${overflowDmgLv * 10}%`, 'detail-upgrade');
        }
        builder.line('Base Radius:', `${baseRadius}px`, 'detail-base');
        if (overflowRangeLv > 0) {
          builder.line(`Reach (${overflowRangeLv}):`, `+${overflowRangeLv * 20}px`, 'detail-upgrade');
        }
        builder.line('Search Radius:', `${Math.round(finalRadius)}px`, 'detail-level')
          .final(`${Math.round(finalTransfer * 100)}%`)
          .formula('Overkill damage → nearest enemy');
        detailOverflow.innerHTML = builder.build();
      }
      
      // =========================================
      // PIERCING ATTACK TYPE STATS
      // =========================================
      
      // PRECISION (Piercing)
      const detailPrecision = document.getElementById('panel-detail-precision');
      if (detailPrecision && attackTypeName === 'piercing') {
        const { getPiercingConfig } = require('../../../modules/towers/tower-combat');
        const config = getPiercingConfig(tower);
        const piercingState = tower.piercingState || {};
        const attackUpg = tower.attackTypeUpgrades || {};
        const precHitsLv = attackUpg.precisionHits || 0;
        const precDmgLv = attackUpg.precisionDamage || 0;
        
        const currentHits = piercingState.precisionHits || 0;
        const hitsRequired = config.precisionHitsRequired;
        const bonusDmg = Math.round(config.precisionBonusDamage * 100);
        const ready = currentHits >= hitsRequired;
        
        const builder = createDetailBuilder()
          .base('Hits Required:', `${hitsRequired}`);
        if (precHitsLv > 0) {
          builder.line(`Deadly Precision (${precHitsLv}):`, `-${precHitsLv}`, 'detail-upgrade');
        }
        builder.line('Crit Bonus:', `+${bonusDmg}%`, 'detail-base');
        if (precDmgLv > 0) {
          builder.line(`Perfect Strike (${precDmgLv}):`, `+${precDmgLv * 10}%`, 'detail-upgrade');
        }
        builder.line('Progress:', `${currentHits}/${hitsRequired}`, ready ? 'detail-biome' : 'detail-level')
          .final(ready ? '🎯 READY!' : `${currentHits}/${hitsRequired}`)
          .formula('Guaranteed crit after N hits');
        detailPrecision.innerHTML = builder.build();
      }
      
      // MOMENTUM (Piercing)
      const detailMomentum = document.getElementById('panel-detail-momentum');
      if (detailMomentum && attackTypeName === 'piercing') {
        const { getPiercingConfig, getMomentumCritBonus } = require('../../../modules/towers/tower-combat');
        const config = getPiercingConfig(tower);
        const piercingState = tower.piercingState || {};
        const attackUpg = tower.attackTypeUpgrades || {};
        const stacksLv = attackUpg.momentumStacks || 0;
        const decayLv = attackUpg.momentumDecay || 0;
        
        const currentStacks = piercingState.momentumStacks || 0;
        const maxStacks = config.momentumMaxStacks;
        const critBonus = Math.round(getMomentumCritBonus(tower) * 100);
        const chancePerStack = Math.round(config.momentumChancePerStack * 100);
        const decay = config.momentumDecayTime;
        
        const builder = createDetailBuilder()
          .base('Per Stack:', `+${chancePerStack}% Crit`);
        builder.line('Max Stacks:', `${maxStacks}`, 'detail-base');
        if (stacksLv > 0) {
          builder.line(`Killing Spree (${stacksLv}):`, `+${stacksLv}`, 'detail-upgrade');
        }
        builder.line('Decay Time:', `${decay.toFixed(1)}s`, 'detail-base');
        if (decayLv > 0) {
          builder.line(`Sustained Fury (${decayLv}):`, `+${(decayLv * 0.5).toFixed(1)}s`, 'detail-upgrade');
        }
        builder.line('Current:', `${currentStacks}/${maxStacks}`, currentStacks > 0 ? 'detail-biome' : 'detail-level')
          .final(`+${critBonus}% Crit`)
          .formula('Each crit adds stack, decays over time');
        detailMomentum.innerHTML = builder.build();
      }
      
      // EXECUTE (Piercing)
      const detailExecute = document.getElementById('panel-detail-execute');
      if (detailExecute && attackTypeName === 'piercing') {
        const { getPiercingConfig } = require('../../../modules/towers/tower-combat');
        const config = getPiercingConfig(tower);
        const attackUpg = tower.attackTypeUpgrades || {};
        const thresholdLv = attackUpg.executeThreshold || 0;
        const damageLv = attackUpg.executeDamage || 0;
        const critLv = attackUpg.executeCrit || 0;
        
        const threshold = Math.round(config.executeThreshold * 100);
        const bonus = Math.round(config.executeBonusDamage * 100);
        const critBonus = Math.round(config.executeCritBonus * 100);
        
        const builder = createDetailBuilder()
          .base('HP Threshold:', `<${threshold}%`);
        if (thresholdLv > 0) {
          builder.line(`Executioner (${thresholdLv}):`, `+${thresholdLv * 5}%`, 'detail-upgrade');
        }
        builder.line('Damage Bonus:', `+${bonus}%`, 'detail-base');
        if (damageLv > 0) {
          builder.line(`Coup de Grace (${damageLv}):`, `+${damageLv * 15}%`, 'detail-upgrade');
        }
        builder.line('Crit vs Execute:', `+${critBonus}%`, 'detail-base');
        if (critLv > 0) {
          builder.line(`Merciless (${critLv}):`, `+${critLv * 10}%`, 'detail-upgrade');
        }
        builder.final(`+${bonus}% DMG`)
          .formula('Bonus damage to low HP enemies');
        detailExecute.innerHTML = builder.build();
      }
      
      // BLEED (Piercing)
      const detailBleed = document.getElementById('panel-detail-bleed');
      if (detailBleed && attackTypeName === 'piercing') {
        const { getPiercingConfig } = require('../../../modules/towers/tower-combat');
        const config = getPiercingConfig(tower);
        const attackUpg = tower.attackTypeUpgrades || {};
        const damageLv = attackUpg.bleedDamage || 0;
        const durationLv = attackUpg.bleedDuration || 0;
        const stacksLv = attackUpg.bleedStacks || 0;
        const unlocked = config.bleedEnabled;
        
        const builder = createDetailBuilder();
        
        if (unlocked) {
          const dps = config.bleedDamage;
          const duration = config.bleedDuration;
          const maxStacks = config.bleedMaxStacks;
          const totalDmg = dps * duration * maxStacks;
          
          builder.base('Status:', '✅ Unlocked', 'detail-upgrade')
            .line('DPS:', `${dps}/s`, 'detail-base');
          if (damageLv > 0) {
            builder.line(`Deep Cuts (${damageLv}):`, `+${damageLv}`, 'detail-upgrade');
          }
          builder.line('Duration:', `${duration}s`, 'detail-base');
          if (durationLv > 0) {
            builder.line(`Lingering (${durationLv}):`, `+${durationLv}s`, 'detail-upgrade');
          }
          builder.line('Max Stacks:', `${maxStacks}`, 'detail-base');
          if (stacksLv > 0) {
            builder.line(`Arterial (${stacksLv}):`, `+${stacksLv}`, 'detail-upgrade');
          }
          builder.line('Max Total DMG:', `${totalDmg}`, 'detail-biome')
            .final(`${dps}/s`)
            .formula('Crits apply bleeding DoT');
        } else {
          builder.base('Status:', '🔒 Locked', 'detail-locked')
            .line('Unlock:', 'Hemorrhage upgrade', 'detail-base')
            .final('OFF')
            .formula('Purchase Hemorrhage to unlock');
        }
        detailBleed.innerHTML = builder.build();
      }
      
      // ARMOR PENETRATION (Piercing)
      const detailArmorpen = document.getElementById('panel-detail-armorpen');
      if (detailArmorpen && attackTypeName === 'piercing') {
        const { getPiercingConfig } = require('../../../modules/towers/tower-combat');
        const config = getPiercingConfig(tower);
        const attackUpg = tower.attackTypeUpgrades || {};
        const armorPenLv = attackUpg.armorPen || 0;
        
        const baseArmorPen = 20; // 20% base
        const armorPen = Math.round(config.armorPenetration * 100);
        
        const builder = createDetailBuilder()
          .base('Base:', `${baseArmorPen}%`);
        if (armorPenLv > 0) {
          builder.line(`Armor Piercing (${armorPenLv}):`, `+${armorPenLv * 5}%`, 'detail-upgrade');
        }
        builder.final(`${armorPen}%`)
          .formula('Ignores % of enemy armor');
        detailArmorpen.innerHTML = builder.build();
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
        actionAttackType.style.display = tower.attackTypeId === 'base' ? 'flex' : 'none';
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
        actionElement.style.display = showElement ? 'flex' : 'none';
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
      
      // Show/hide floating Magic charge control panel
      const magicChargePanel = el.magicChargePanel || el.bottomPanel?.querySelector('#magic-charge-panel');
      if (magicChargePanel) {
        magicChargePanel.style.display = tower.attackTypeId === 'magic' ? 'block' : 'none';
        
        // Initialize magic charge slider if not done
        if (tower.attackTypeId === 'magic' && !magicChargePanel._eventsAttached) {
          magicChargePanel._eventsAttached = true;
          const slider = magicChargePanel.querySelector('#magic-charge-slider');
          if (slider) {
            slider.addEventListener('input', (e) => {
              const percent = parseInt(e.target.value, 10);
              this.setMagicChargePercent(percent);
            });
          }
        }
        
        // Update magic charge UI
        if (tower.attackTypeId === 'magic') {
          this.updateMagicChargeUI(tower);
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
      
      // Update biome effects display
      this.updateBiomeDisplay(tower);
    }
    
    /**
     * Update biome effects display in avatar section
     */
    updateBiomeDisplay(tower) {
      const biomeSummary = document.getElementById('biome-summary');
      const biomePopupContent = document.getElementById('biome-popup-content');
      
      if (!biomeSummary || !biomePopupContent) return;
      
      // Get biome breakdown from tower
      const breakdown = tower.biomeBreakdown;
      
      if (!breakdown || !breakdown.base) {
        biomeSummary.innerHTML = '<span style="color: #a0aec0">None</span>';
        biomePopupContent.innerHTML = '<div style="color: #a0aec0; text-align: center;">No biome effects</div>';
        return;
      }
      
      // Calculate total modifiers (multipliers: multiply them together)
      const totalMods = {};
      
      // Add base biome modifiers
      if (breakdown.base.modifiers) {
        for (const [stat, value] of Object.entries(breakdown.base.modifiers)) {
          totalMods[stat] = (totalMods[stat] || 1) * value;
        }
      }
      
      // Multiply border modifiers
      if (breakdown.borders) {
        for (const border of breakdown.borders) {
          if (border.modifiers) {
            for (const [stat, value] of Object.entries(border.modifiers)) {
              totalMods[stat] = (totalMods[stat] || 1) * value;
            }
          }
        }
      }
      
      // Define which stats are for towers vs energy buildings
      const towerStats = ['towerDamage', 'towerRange', 'attackSpeed', 'critChance', 'hp', 'armor'];
      const energyStats = ['energyProduction', 'buildCost', 'windEfficiency', 'solarEfficiency', 'hydroEfficiency', 'bioEfficiency'];
      
      // Determine if this is a tower (has attackTypeId) or energy building
      const isTower = !!tower.attackTypeId || tower.type === 'tower';
      const relevantStats = isTower ? towerStats : energyStats;
      
      // Format summary - show only relevant stats for this building type
      const summaryParts = [];
      const statLabels = {
        towerDamage: 'DMG', towerRange: 'RNG', attackSpeed: 'SPD', critChance: 'CRIT',
        energyProduction: 'NRG', hp: 'HP', armor: 'ARM', buildCost: 'COST',
        windEfficiency: 'WIND', solarEfficiency: 'SUN', hydroEfficiency: 'HYDRO', bioEfficiency: 'BIO'
      };
      
      for (const [stat, value] of Object.entries(totalMods)) {
        // Skip if value is 1.0 (no effect) or 0
        if (value === 1 || value === 0) continue;
        // Skip if not relevant for this building type (in summary only)
        if (!relevantStats.includes(stat)) continue;
        
        const label = statLabels[stat] || stat.substring(0, 3).toUpperCase();
        // Convert multiplier to percentage bonus: 0.8 -> -20%, 1.2 -> +20%
        const bonus = (value - 1) * 100;
        const sign = bonus > 0 ? '+' : '';
        const percent = Math.round(bonus);
        const cls = bonus > 0 ? 'positive' : 'negative';
        // Format: LABEL VALUE%
        summaryParts.push(`<span class="mod-item ${cls}">${label} ${sign}${percent}%</span>`);
      }
      
      biomeSummary.innerHTML = summaryParts.length > 0 
        ? summaryParts.join('') 
        : `${breakdown.base.emoji || '🌍'} ${breakdown.base.name || 'Default'}`;
      
      // Build popup content - show ALL effects in popup
      let popupHtml = '';
      
      // Base biome
      popupHtml += `
        <div class="biome-source">
          <div class="biome-source-header">
            <span class="biome-source-emoji">${breakdown.base.emoji || '🌍'}</span>
            <span class="biome-source-name">${breakdown.base.name || 'Unknown'}</span>
            <span class="biome-source-type">Base</span>
          </div>
          <div class="biome-modifiers">
            ${this.formatBiomeMods(breakdown.base.modifiers)}
          </div>
        </div>
      `;
      
      // Border effects
      if (breakdown.borders && breakdown.borders.length > 0) {
        for (const border of breakdown.borders) {
          popupHtml += `
            <div class="biome-source">
              <div class="biome-source-header">
                <span class="biome-source-emoji">${border.emoji || '🔗'}</span>
                <span class="biome-source-name">${border.name || 'Border'}</span>
                <span class="biome-source-type">Border</span>
              </div>
              ${border.description ? `<div style="font-size: 9px; color: #a0aec0; margin-bottom: 4px;">${border.description}</div>` : ''}
              <div class="biome-modifiers">
                ${this.formatBiomeMods(border.modifiers)}
              </div>
            </div>
          `;
        }
      }
      
      biomePopupContent.innerHTML = popupHtml;
    }
    
    /**
     * Format biome modifiers for display
     * Biome modifiers are multipliers: 0.8 = -20%, 1.2 = +20%
     */
    formatBiomeMods(modifiers) {
      if (!modifiers) return '<span style="color: #a0aec0">No effects</span>';
      
      const statLabels = {
        towerDamage: 'Damage', towerRange: 'Range', attackSpeed: 'Speed', critChance: 'Crit',
        energyProduction: 'Energy', hp: 'HP', armor: 'Armor', buildCost: 'Build Cost',
        windEfficiency: 'Wind', solarEfficiency: 'Solar', hydroEfficiency: 'Hydro'
      };
      
      const parts = [];
      for (const [stat, value] of Object.entries(modifiers)) {
        // Skip if value is 1.0 (no effect) or 0
        if (value === 1 || value === 0) continue;
        const label = statLabels[stat] || stat;
        // Convert multiplier to percentage bonus: 0.8 -> -20%, 1.2 -> +20%
        const bonus = (value - 1) * 100;
        const sign = bonus > 0 ? '+' : '';
        const percent = Math.round(bonus);
        const cls = bonus > 0 ? 'positive' : 'negative';
        parts.push(`<span class="biome-mod ${cls}">${sign}${percent}% ${label}</span>`);
      }
      
      return parts.length > 0 ? parts.join('') : '<span style="color: #a0aec0">No effects</span>';
    }
    
    // =========================================
    // MAGIC CHARGE CONTROL
    // =========================================
    
    /**
     * Set magic charge percent from UI slider
     * @param {number} percent - Charge percent (1-100)
     */
    setMagicChargePercent(percent) {
      const tower = this.game?.selectedTower;
      if (!tower || tower.attackTypeId !== 'magic') return;
      
      // Import setMagicChargePercent from tower-combat
      const { setMagicChargePercent } = require('../../towers/tower-combat');
      setMagicChargePercent(tower, percent);
      
      // Update UI immediately
      this.updateMagicChargeUI(tower);
    }
    
    /**
     * Update Magic charge UI elements
     * @param {Object} tower - Tower instance
     */
    updateMagicChargeUI(tower) {
      if (!tower || tower.attackTypeId !== 'magic') return;
      if (!tower.magicState) return;
      
      const el = this.elements;
      const state = tower.magicState;
      const isReady = state.currentCharge >= state.shotCost;
      
      // Update slider position
      const slider = document.getElementById('magic-charge-slider');
      if (slider && slider.value != state.chargePercent) {
        slider.value = state.chargePercent;
      }
      
      // Update percent label
      const percentLabel = document.getElementById('charge-percent-label');
      if (percentLabel) percentLabel.textContent = `${state.chargePercent}%`;
      
      // Update shot cost
      const shotCostEl = document.getElementById('magic-shot-cost');
      if (shotCostEl) shotCostEl.textContent = `${Math.floor(state.shotCost)} ⚡`;
      
      // Update bonus damage
      const bonusDmgEl = document.getElementById('magic-bonus-damage');
      if (bonusDmgEl) bonusDmgEl.textContent = `+${Math.floor(state.bonusDamage)}`;
      
      // Update final damage
      const finalDmgEl = document.getElementById('magic-final-damage');
      const finalDamage = (tower.damage || 10) + state.bonusDamage;
      if (finalDmgEl) finalDmgEl.textContent = Math.floor(finalDamage);
      
      // Update progress bar
      const progressFill = document.getElementById('magic-charge-progress');
      const progressText = document.getElementById('magic-charge-text');
      const progress = state.shotCost > 0 ? (state.currentCharge / state.shotCost) * 100 : 0;
      if (progressFill) progressFill.style.width = `${Math.min(100, progress)}%`;
      if (progressText) progressText.textContent = `${Math.floor(state.currentCharge)}/${Math.floor(state.shotCost)} ⚡`;
      
      // Update status text (Ready/Charging/No Energy)
      const statusEl = document.getElementById('magic-charge-status');
      if (statusEl) {
        if (isReady) {
          statusEl.textContent = '✓ Ready';
          statusEl.style.color = '#86efac';
        } else if (tower.currentEnergy > 0) {
          statusEl.textContent = 'Charging...';
          statusEl.style.color = '#a78bfa';
        } else {
          statusEl.textContent = 'No Energy';
          statusEl.style.color = '#fc8181';
        }
      }
      
      // Update stats panel magic-specific rows
      const chargeRow = document.getElementById('stat-row-charge');
      const bonusRow = document.getElementById('stat-row-magicbonus');
      const overflowRow = document.getElementById('stat-row-overflow');
      
      if (chargeRow) {
        chargeRow.style.display = '';
        const chargeEl = document.getElementById('panel-charge');
        if (chargeEl) chargeEl.textContent = `${Math.floor(state.currentCharge)}/${Math.floor(state.shotCost)}`;
      }
      
      if (bonusRow) {
        bonusRow.style.display = '';
        const bonusEl = document.getElementById('panel-magicbonus');
        if (bonusEl) bonusEl.textContent = `+${Math.floor(state.bonusDamage)}`;
      }
      
      if (overflowRow) {
        overflowRow.style.display = '';
        const { getMagicConfig } = require('../../towers/tower-combat');
        const config = getMagicConfig(tower);
        const overflowEl = document.getElementById('panel-overflow');
        if (overflowEl) overflowEl.textContent = `${Math.round(config.overflowTransfer * 100)}%`;
      }
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
