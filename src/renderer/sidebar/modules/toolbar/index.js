/**
 * Toolbar Module - Top toolbar with broker controls, layout, settings
 */

const { SidebarModule, registerModule } = require('../../core/sidebar-base');

class ToolbarModule extends SidebarModule {
  static id = 'toolbar';
  static title = null; // No title header for toolbar
  static order = 0; // Always first
  
  constructor(options) {
    super(options);
    this.pickerOpen = false;
    this.pickerEl = null;
  }
  
  getTemplate() {
    return `
      <div class="toolbar">
        <div class="tb-group" data-group="brokers">
          <button id="tb-add-broker" class="md-icon-btn" data-tooltip="Add broker" aria-label="Add broker">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
          <select id="tb-layout-preset" class="md-select" title="Layout preset">
            <option value="">Layout</option>
            <optgroup label="Horizontal">
              <option value="2x2">2×2</option>
              <option value="2x3">2×3</option>
              <option value="3x3">3×3</option>
              <option value="1x2">1×2</option>
              <option value="1x2x2">1×2×2</option>
              <option value="2">2</option>
            </optgroup>
            <optgroup label="Vertical">
              <option value="1x1">1×1</option>
              <option value="1x1x1">1×1×1</option>
              <option value="1x1x2">1×1×2</option>
              <option value="2x2x2">2×2×2</option>
            </optgroup>
          </select>
        </div>
        
        <div class="tb-group" data-group="refresh">
          <button id="tb-refresh-all" class="md-icon-btn" data-tooltip="Refresh all">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
          </button>
        </div>
        
        <div class="tb-group" data-group="ui">
          <button id="tb-board-side" class="md-icon-btn" data-tooltip="Move panel" data-side="right">
            <svg class="arrow" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
          <button id="tb-stats" class="md-icon-btn" data-tooltip="Statistics">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>
          </button>
          <button id="tb-settings" class="md-icon-btn has-badge" data-tooltip="Settings">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
            <span class="update-badge" hidden>1</span>
          </button>
        </div>
      </div>
    `;
  }
  
  onMount(container) {
    super.onMount(container);
    
    // Remove module-header (toolbar doesn't need it)
    const header = container.querySelector('.module-header');
    if (header) header.remove();
    
    // Remove padding from content
    const content = container.querySelector('.module-content');
    if (content) content.classList.add('no-padding');
    
    this.bindEvents();
  }
  
  bindEvents() {
    const api = window.desktopAPI;
    if (!api) return;
    
    // Add broker button
    this.$('#tb-add-broker')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleBrokerPicker(e.currentTarget);
    });
    
    // Layout preset
    const layoutSelect = this.$('#tb-layout-preset');
    if (layoutSelect) {
      api.getLayoutPreset?.().then(p => {
        if (p) layoutSelect.value = p;
      }).catch(() => {});
      
      layoutSelect.addEventListener('change', () => {
        if (layoutSelect.value) {
          api.applyLayoutPreset?.(layoutSelect.value);
        }
      });
    }
    
    // Refresh all
    this.$('#tb-refresh-all')?.addEventListener('click', () => {
      api.refreshAll?.();
    });
    
    // Board side
    const sideBtn = this.$('#tb-board-side');
    if (sideBtn) {
      api.getBoardState?.().then(st => {
        if (st) sideBtn.dataset.side = st.side || 'right';
      }).catch(() => {});
      
      sideBtn.addEventListener('click', () => {
        const cur = sideBtn.dataset.side || 'right';
        const next = cur === 'left' ? 'right' : 'left';
        api.boardSetSide?.(next);
      });
      
      this.subscribeIpc('onBoardUpdated', (st) => {
        if (st) sideBtn.dataset.side = st.side || 'right';
      });
    }
    
    // Stats toggle
    this.$('#tb-stats')?.addEventListener('click', () => {
      api.statsToggle?.();
    });
    
    // Settings
    const settingsBtn = this.$('#tb-settings');
    const updateBadge = settingsBtn?.querySelector('.update-badge');
    
    settingsBtn?.addEventListener('click', () => {
      api.openSettings?.();
    });
    
    // Update notification badge - show when update available
    const showUpdateBadge = () => {
      if (updateBadge) updateBadge.hidden = false;
    };
    const hideUpdateBadge = () => {
      if (updateBadge) updateBadge.hidden = true;
    };
    
    // Check initial state
    api.updaterGetStatus?.().then(status => {
      if (status?.availableUpdate) showUpdateBadge();
    }).catch(() => {});
    
    // Listen for update events
    this.subscribeIpc('onUpdaterAvailable', showUpdateBadge);
    this.subscribeIpc('onUpdaterNotAvailable', hideUpdateBadge);
    
    // Close picker on outside click
    document.addEventListener('click', (e) => {
      if (!this.pickerOpen) return;
      if (this.pickerEl?.contains(e.target)) return;
      this.closePicker();
    });
  }
  
  async toggleBrokerPicker(anchor) {
    if (this.pickerOpen) {
      this.closePicker();
      return;
    }
    
    if (!this.pickerEl) {
      this.pickerEl = document.createElement('div');
      this.pickerEl.className = 'broker-picker md-hidden';
      this.pickerEl.innerHTML = `
        <div class="picker-title">Add broker</div>
        <div class="picker-list"></div>
      `;
      document.body.appendChild(this.pickerEl);
    }
    
    const list = this.pickerEl.querySelector('.picker-list');
    list.innerHTML = '<div class="picker-empty">Loading...</div>';
    
    // Position
    const rect = anchor.getBoundingClientRect();
    this.pickerEl.style.left = `${rect.left}px`;
    this.pickerEl.style.top = `${rect.bottom + 8}px`;
    this.pickerEl.classList.remove('md-hidden');
    this.pickerOpen = true;
    
    // Load brokers
    try {
      const data = await window.desktopAPI?.getBrokersForPicker?.() || { brokers: [], active: [] };
      const inactive = data.brokers.filter(b => !data.active.includes(b.id));
      
      if (!inactive.length) {
        list.innerHTML = '<div class="picker-empty">No available brokers</div>';
        return;
      }
      
      list.innerHTML = '';
      inactive.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'picker-item';
        btn.textContent = b.title || b.name || b.id;
        btn.addEventListener('click', () => {
          window.desktopAPI?.addBroker?.(b.id);
          this.closePicker();
        });
        list.appendChild(btn);
      });
    } catch (e) {
      list.innerHTML = '<div class="picker-empty md-text-error">Error loading</div>';
    }
  }
  
  closePicker() {
    this.pickerOpen = false;
    this.pickerEl?.classList.add('md-hidden');
  }
}

// Register module
registerModule(ToolbarModule);

module.exports = ToolbarModule;
