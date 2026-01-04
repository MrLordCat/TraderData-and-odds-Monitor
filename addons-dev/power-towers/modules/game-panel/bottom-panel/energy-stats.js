/**
 * Power Towers TD - Energy Stats UI
 * Energy building statistics display and detail popups
 */

/**
 * Mixin for energy building stats in bottom panel
 * @param {Class} Base - Base class
 */
function EnergyStatsMixin(Base) {
  return class extends Base {
    
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
      const el = this.elements;
      
      // Show/hide channels button for Relay only
      if (el.energyChannelsBtn) {
        el.energyChannelsBtn.style.display = building.type === 'power-transfer' ? '' : 'none';
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
      
      // BioGenerator trees stat (update in real-time)
      if (building.type === 'bio-generator' && el.panelTrees) {
        el.panelTrees.textContent = `${building.treesUsed || 0}/${building.maxTrees || 12}`;
      }
      
      // Update channels display
      const energyModule = this.game?.modules?.energy;
      const powerNetwork = energyModule?.buildingManager?.network;
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
        const energyModule = this.game?.modules?.energy;
        const powerNetwork = energyModule?.buildingManager?.network;
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
      
      // TREES (BioGenerator only)
      const detailTrees = document.getElementById('panel-detail-trees');
      if (detailTrees && building.type === 'bio-generator') {
        const treesUsed = building.treesUsed || 0;
        const maxTrees = building.maxTrees || 12;
        const treeRadius = building.treeRadius || 3;
        const genPerTree = building.generationPerTree || 2;
        detailTrees.innerHTML = createDetailBuilder()
          .line('Trees in range:', `${treesUsed}/${maxTrees}`, treesUsed >= maxTrees ? 'detail-crit' : 'detail-value')
          .line('Scan radius:', `${treeRadius} cells`, 'detail-base')
          .line('Gen per tree:', `+${genPerTree}/s`, 'detail-level')
          .line('Total from trees:', `+${treesUsed * genPerTree}/s`, 'detail-value')
          .build();
      }
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
      
      // BioGenerator trees stat
      const isBioGen = building.type === 'bio-generator';
      if (el.statRowTrees) el.statRowTrees.style.display = isBioGen ? '' : 'none';
      if (el.panelTrees && isBioGen) {
        el.panelTrees.textContent = `${building.treesUsed || 0}/${building.maxTrees || 12}`;
      }
      
      // Get used channels from power network
      const energyModule = this.game?.modules?.energy;
      const powerNetwork = energyModule?.buildingManager?.network;
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
  };
}

module.exports = { EnergyStatsMixin };
