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
          <button id="tb-add-broker" class="sb-icon-btn" title="Add broker" aria-label="Add broker">
            <svg viewBox="0 0 24 24"><path d="M11 5h2v14h-2zM5 11h14v2H5z"/></svg>
          </button>
          <select id="tb-layout-preset" class="sb-select" title="Layout preset">
            <option value="">Layout</option>
            <optgroup label="Horizontal">
              <option value="2x2">2x2</option>
              <option value="2x3">2x3</option>
              <option value="3x3">3x3</option>
              <option value="1x2">1x2</option>
              <option value="1x2x2">1x2x2</option>
              <option value="2">2</option>
            </optgroup>
            <optgroup label="Vertical">
              <option value="1x1">1x1</option>
              <option value="1x1x1">1x1x1</option>
              <option value="1x1x2">1x1x2</option>
              <option value="2x2x2">2x2x2</option>
            </optgroup>
          </select>
        </div>
        
        <div class="tb-group" data-group="refresh">
          <button id="tb-refresh-all" class="sb-icon-btn" title="Refresh all brokers">
            <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 6h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L14 10h6V4l-2.35 2.35z"/></svg>
          </button>
          <label class="sb-checkbox" title="Auto refresh">
            <input type="checkbox" id="tb-auto-reload" />
            <span class="tb-check-label">Auto</span>
          </label>
        </div>
        
        <div class="tb-group" data-group="ui">
          <button id="tb-board-side" class="sb-icon-btn" title="Move board left/right" data-side="right">
            <svg class="arrow" viewBox="0 0 24 24"><path d="M10 6l6 6-6 6-1.4-1.4L13.2 12 8.6 7.4 10 6z"/></svg>
          </button>
          <button id="tb-stats" class="sb-icon-btn" title="Stats">
            <svg viewBox="0 0 24 24"><path d="M5 9h3v10H5V9zm5-4h3v14h-3V5zm5 7h3v7h-3v-7z"/></svg>
          </button>
          <button id="tb-settings" class="sb-icon-btn" title="Settings">
            <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 12.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L1.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.39.32.6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.21.1.47.01.6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58z"/></svg>
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
    
    // Auto refresh
    const autoReload = this.$('#tb-auto-reload');
    if (autoReload) {
      api.getAutoRefreshEnabled?.().then(v => {
        autoReload.checked = !!v;
      }).catch(() => {});
      
      autoReload.addEventListener('change', () => {
        api.setAutoRefreshEnabled?.(autoReload.checked);
      });
      
      this.subscribeIpc('onAutoRefreshUpdated', (p) => {
        autoReload.checked = !!(p && p.enabled);
      });
    }
    
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
    this.$('#tb-settings')?.addEventListener('click', () => {
      api.openSettings?.();
    });
    
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
      this.pickerEl.className = 'broker-picker sb-hidden';
      this.pickerEl.innerHTML = `
        <div class="picker-title">Add broker</div>
        <div class="picker-list"></div>
      `;
      document.body.appendChild(this.pickerEl);
    }
    
    const list = this.pickerEl.querySelector('.picker-list');
    list.innerHTML = '<div class="sb-text-muted">Loading...</div>';
    
    // Position
    const rect = anchor.getBoundingClientRect();
    this.pickerEl.style.left = `${rect.left}px`;
    this.pickerEl.style.top = `${rect.bottom + 4}px`;
    this.pickerEl.classList.remove('sb-hidden');
    this.pickerOpen = true;
    
    // Load brokers
    try {
      const data = await window.desktopAPI?.getBrokersForPicker?.() || { brokers: [], active: [] };
      const inactive = data.brokers.filter(b => !data.active.includes(b.id));
      
      if (!inactive.length) {
        list.innerHTML = '<div class="sb-text-muted">No available brokers</div>';
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
      list.innerHTML = '<div class="sb-text-danger">Error loading</div>';
    }
  }
  
  closePicker() {
    this.pickerOpen = false;
    this.pickerEl?.classList.add('sb-hidden');
  }
}

// Register module
registerModule(ToolbarModule);

module.exports = ToolbarModule;
