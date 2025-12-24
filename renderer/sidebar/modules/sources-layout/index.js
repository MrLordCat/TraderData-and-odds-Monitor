/**
 * Sources Layout Module - Broker grid layout selector and management
 */

const { SidebarModule, registerModule } = require('../../core/sidebar-base');

class SourcesLayoutModule extends SidebarModule {
  static id = 'sources-layout';
  static title = 'Sources Layout';
  static order = 5; // Between toolbar and odds board
  
  constructor(options) {
    super(options);
    this.activeBrokers = [];
    this.currentPreset = '';
  }
  
  getTemplate() {
    return `
      <div class="sources-grid">
        <div class="preset-row">
          <span class="preset-label">Quick presets</span>
          <div class="preset-btns">
            <button class="preset-btn" data-preset="2x2">2×2</button>
            <button class="preset-btn" data-preset="2x3">2×3</button>
            <button class="preset-btn" data-preset="1x2x2">1-2-2</button>
            <button class="preset-btn" data-preset="1x1x1">1-1-1</button>
          </div>
        </div>
        
        <div class="active-sources">
          <div class="sources-label">Active sources</div>
          <div id="sources-list" class="sources-list">
            <div class="empty-state">No active sources</div>
          </div>
        </div>
        
        <div class="source-actions">
          <button id="add-source-btn" class="md-btn md-btn--tonal md-btn--small">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Add Source
          </button>
        </div>
      </div>
    `;
  }
  
  onMount(container) {
    super.onMount(container);
    this.bindEvents();
    this.loadSources();
  }
  
  bindEvents() {
    const api = window.desktopAPI;
    if (!api) return;
    
    // Preset buttons
    this.$$('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        api.applyLayoutPreset?.(preset);
        this.setActivePreset(preset);
      });
    });
    
    // Add source button
    this.$('#add-source-btn')?.addEventListener('click', () => {
      this.emit('openBrokerPicker');
    });
    
    // Listen for broker changes
    this.subscribeIpc('onBrokerOpened', () => this.loadSources());
    this.subscribeIpc('onBrokerClosed', () => this.loadSources());
    this.subscribeIpc('onLayoutChanged', (data) => {
      if (data?.preset) this.setActivePreset(data.preset);
    });
  }
  
  async loadSources() {
    const api = window.desktopAPI;
    if (!api) return;
    
    try {
      const data = await api.getBrokersForPicker?.() || { brokers: [], active: [] };
      this.activeBrokers = data.active || [];
      this.renderSources(data.brokers, data.active);
      
      // Load current preset
      const preset = await api.getLayoutPreset?.();
      if (preset) this.setActivePreset(preset);
    } catch (e) {
      console.error('[sources-layout] Failed to load sources:', e);
    }
  }
  
  renderSources(allBrokers, activeIds) {
    const list = this.$('#sources-list');
    if (!list) return;
    
    if (!activeIds.length) {
      list.innerHTML = '<div class="empty-state">No active sources</div>';
      return;
    }
    
    list.innerHTML = '';
    
    activeIds.forEach(id => {
      const broker = allBrokers.find(b => b.id === id) || { id, title: id };
      
      const item = document.createElement('div');
      item.className = 'source-item';
      item.dataset.id = id;
      item.innerHTML = `
        <span class="source-name">${broker.title || broker.name || id}</span>
        <button class="source-remove md-icon-btn md-icon-btn--small" data-tooltip="Remove">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      `;
      
      item.querySelector('.source-remove')?.addEventListener('click', () => {
        window.desktopAPI?.closeBroker?.(id);
      });
      
      list.appendChild(item);
    });
  }
  
  setActivePreset(preset) {
    this.currentPreset = preset;
    
    this.$$('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === preset);
    });
  }
}

// Register module
registerModule(SourcesLayoutModule);

module.exports = SourcesLayoutModule;
