/**
 * PT Editor - Editor Controller
 * Handles editor UI logic and data manipulation
 */

const { FileManager } = require('./file-manager.js');

class EditorController {
  constructor() {
    this.container = null;
    this.config = null;
    this.enemyTypes = null;
    this.towerPaths = null;
    this.hasChanges = false;
  }

  init(container) {
    this.container = container;
    this.loadData();
    this.setupTabs();
    this.setupActions();
    this.populateFields();
  }

  loadData() {
    this.config = FileManager.readConfig();
    this.enemyTypes = FileManager.readEnemyTypes();
    this.towerPaths = FileManager.readTowerTypes();
    
    if (!this.config) {
      this.setStatus('Failed to load config - check Power Towers path', 'error');
    }
  }

  setupTabs() {
    const tabs = this.container.querySelectorAll('.tab-btn');
    const panels = this.container.querySelectorAll('.tab-panel');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        const panel = this.container.querySelector(`[data-panel="${tab.dataset.tab}"]`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  setupActions() {
    const saveBtn = this.container.querySelector('.btn-save');
    const reloadBtn = this.container.querySelector('.btn-reload');
    
    saveBtn?.addEventListener('click', () => this.saveChanges());
    reloadBtn?.addEventListener('click', () => {
      this.loadData();
      this.populateFields();
      this.setStatus('Reloaded from files', 'success');
    });
  }

  populateFields() {
    if (!this.config) return;
    
    // Populate config inputs
    this.container.querySelectorAll('[data-config]').forEach(input => {
      const key = input.dataset.config;
      if (this.config[key] !== undefined) {
        input.value = this.config[key];
        input.addEventListener('change', () => {
          this.config[key] = parseFloat(input.value);
          this.markChanged();
        });
      }
    });
    
    // Populate enemies
    this.renderEnemyList();
    
    // Populate towers
    this.renderTowerPaths();
  }

  renderEnemyList() {
    const list = this.container.querySelector('.enemy-list');
    if (!list || !this.enemyTypes) return;
    
    list.innerHTML = Object.entries(this.enemyTypes).map(([type, data]) => `
      <div class="enemy-card" data-enemy="${type}">
        <div class="enemy-card-header">
          <span class="enemy-emoji">${data.emoji}</span>
          <span class="enemy-name">${data.name}</span>
          <span class="enemy-type">${type}</span>
        </div>
        <div class="enemy-stats">
          <div class="field-group">
            <label>Health</label>
            <input type="number" data-enemy-stat="baseHealth" value="${data.baseHealth}" min="1">
          </div>
          <div class="field-group">
            <label>Speed</label>
            <input type="number" data-enemy-stat="baseSpeed" value="${data.baseSpeed}" min="1">
          </div>
          <div class="field-group">
            <label>Reward</label>
            <input type="number" data-enemy-stat="reward" value="${data.reward}" min="0">
          </div>
          <div class="field-group color-field">
            <label>Color</label>
            <input type="color" data-enemy-stat="color" value="${data.color}">
            <input type="text" data-enemy-stat="color-text" value="${data.color}">
          </div>
        </div>
      </div>
    `).join('');
    
    // Add listeners
    list.querySelectorAll('.enemy-card').forEach(card => {
      const type = card.dataset.enemy;
      card.querySelectorAll('[data-enemy-stat]').forEach(input => {
        const stat = input.dataset.enemyStat;
        
        if (stat === 'color') {
          input.addEventListener('input', () => {
            this.enemyTypes[type].color = input.value;
            card.querySelector('[data-enemy-stat="color-text"]').value = input.value;
            this.markChanged();
          });
        } else if (stat === 'color-text') {
          input.addEventListener('change', () => {
            if (/^#[0-9A-Fa-f]{6}$/.test(input.value)) {
              this.enemyTypes[type].color = input.value;
              card.querySelector('[data-enemy-stat="color"]').value = input.value;
              this.markChanged();
            }
          });
        } else {
          input.addEventListener('change', () => {
            this.enemyTypes[type][stat] = parseFloat(input.value);
            this.markChanged();
          });
        }
      });
    });
  }

  renderTowerPaths() {
    const list = this.container.querySelector('.tower-paths-list');
    if (!list || !this.towerPaths) return;
    
    list.innerHTML = Object.entries(this.towerPaths).map(([pathKey, pathData]) => `
      <div class="tower-path-card" data-path="${pathKey}">
        <div class="tower-path-header">
          <span class="tower-path-icon">${pathData.icon}</span>
          <span class="tower-path-name">${pathData.name}</span>
          <span class="tower-path-toggle">▼</span>
        </div>
        <div class="tower-path-content">
          ${pathData.tiers.map((tier, idx) => `
            <div class="tier-card" data-tier="${idx}">
              <div class="tier-header">
                Tier ${tier.tier}: ${tier.name}
              </div>
              <div class="tier-stats">
                <div class="field-group">
                  <label>Damage</label>
                  <input type="number" data-tier-stat="damage" value="${tier.damage}" min="1">
                </div>
                <div class="field-group">
                  <label>Range</label>
                  <input type="number" data-tier-stat="range" value="${tier.range}" min="10">
                </div>
                <div class="field-group">
                  <label>Fire Rate</label>
                  <input type="number" data-tier-stat="fireRate" value="${tier.fireRate}" min="0.1" step="0.1">
                </div>
                <div class="field-group">
                  <label>Energy Cost</label>
                  <input type="number" data-tier-stat="energyCost" value="${tier.energyCost}" min="0">
                </div>
                ${this.renderOptionalTierStat(tier, 'splashRadius', 'Splash Radius')}
                ${this.renderOptionalTierStat(tier, 'slowPercent', 'Slow %', 0, 1, 0.1)}
                ${this.renderOptionalTierStat(tier, 'slowDuration', 'Slow Duration')}
                ${this.renderOptionalTierStat(tier, 'burnDamage', 'Burn DMG')}
                ${this.renderOptionalTierStat(tier, 'burnDuration', 'Burn Duration')}
                ${this.renderOptionalTierStat(tier, 'chainCount', 'Chain Count')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
    
    // Toggle expand/collapse
    list.querySelectorAll('.tower-path-header').forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        const toggle = header.querySelector('.tower-path-toggle');
        content.classList.toggle('open');
        toggle.textContent = content.classList.contains('open') ? '▲' : '▼';
      });
    });
    
    // Add listeners for tier stats
    list.querySelectorAll('.tower-path-card').forEach(pathCard => {
      const pathKey = pathCard.dataset.path;
      pathCard.querySelectorAll('.tier-card').forEach(tierCard => {
        const tierIdx = parseInt(tierCard.dataset.tier);
        tierCard.querySelectorAll('[data-tier-stat]').forEach(input => {
          const stat = input.dataset.tierStat;
          input.addEventListener('change', () => {
            this.towerPaths[pathKey].tiers[tierIdx][stat] = parseFloat(input.value);
            this.markChanged();
          });
        });
      });
    });
  }

  renderOptionalTierStat(tier, stat, label, min = 0, max = null, step = 1) {
    if (tier[stat] === undefined) return '';
    const maxAttr = max !== null ? `max="${max}"` : '';
    return `
      <div class="field-group">
        <label>${label}</label>
        <input type="number" data-tier-stat="${stat}" value="${tier[stat]}" min="${min}" ${maxAttr} step="${step}">
      </div>
    `;
  }

  markChanged() {
    this.hasChanges = true;
    this.setStatus('Unsaved changes', '');
  }

  saveChanges() {
    try {
      if (this.config) {
        FileManager.writeConfig(this.config);
      }
      
      if (this.enemyTypes) {
        FileManager.writeEnemyTypes(this.enemyTypes);
      }
      
      if (this.towerPaths) {
        FileManager.writeTowerPaths(this.towerPaths);
      }
      
      this.hasChanges = false;
      this.setStatus('Saved successfully! Restart game to apply.', 'success');
    } catch (e) {
      console.error('[pt-editor] Save failed:', e);
      this.setStatus('Save failed: ' + e.message, 'error');
    }
  }

  setStatus(text, type = '') {
    const status = this.container.querySelector('.editor-status');
    if (status) {
      status.textContent = text;
      status.className = 'editor-status ' + type;
    }
  }
}

module.exports = { EditorController };
