/**
 * Addon Loader for Stats Panel
 * 
 * Loads enabled addon sidebar modules into the stats panel.
 * Supports universal detach mechanism for any module.
 * Uses ipcRenderer directly since stats panel has nodeIntegration.
 */

(function initAddonLoader() {
  'use strict';
  
  const fs = require('fs');
  const path = require('path');
  const { ipcRenderer } = require('electron');
  
  const container = document.getElementById('addonModulesContainer');
  if (!container) {
    console.warn('[addon-loader] Container not found');
    return;
  }
  
  console.log('[addon-loader] Starting...');
  
  // Track loaded modules for detach/reattach
  const loadedModules = new Map();
  
  /**
   * Simple base class for addon modules
   */
  class SidebarModule {
    static id = 'base';
    static title = 'Module';
    static order = 100;
    static detachable = true;  // Enable detach by default
    static detachWidth = 500;
    static detachHeight = 600;
    
    constructor(options = {}) {
      this.options = options;
      this.container = null;
      this.isDetached = options.isDetached || false;
    }
    
    getTemplate() { return '<div>Module content</div>'; }
    getStyles() { return ''; }
    
    onMount(container) {
      this.container = container;
    }
    
    onUnmount() {
      this.container = null;
    }
  }
  
  /**
   * Load addon module from file path
   */
  async function loadAddonModule(modulePath, addonId) {
    try {
      if (!fs.existsSync(modulePath)) {
        console.warn(`[addon-loader] Module file not found: ${modulePath}`);
        return null;
      }
      
      // Clear require cache for hot-reload
      delete require.cache[require.resolve(modulePath)];
      
      const exported = require(modulePath);
      
      let ModuleClass;
      
      // Check if it's a factory function
      if (typeof exported === 'function' && !exported.id) {
        // Call factory with base class
        ModuleClass = exported({ SidebarModule, registerModule: () => {} });
        console.log(`[addon-loader] Loaded via factory: ${ModuleClass?.id || 'unknown'}`);
      } else {
        ModuleClass = exported;
      }
      
      if (!ModuleClass || !ModuleClass.id) {
        console.warn(`[addon-loader] Invalid module: no id`);
        return null;
      }
      
      // Create instance
      const instance = new ModuleClass({});
      
      // Create wrapper section (matching stats panel style)
      const section = document.createElement('div');
      section.className = 'sectionCard collapsible addon-section';
      section.dataset.sec = `addon-${ModuleClass.id}`;
      section.dataset.collapseOnHeader = '1';
      section.id = `addon-section-${ModuleClass.id}`;
      
      // Header with detach button
      const header = document.createElement('div');
      header.className = 'sectionHeader';
      
      // Escape path for HTML attribute (Windows paths have backslashes)
      const escapedPath = modulePath.replace(/\\/g, '\\\\').replace(/"/g, '&quot;');
      
      const detachBtn = (ModuleClass.detachable !== false) 
        ? `<button class="addon-detach-btn" data-module-id="${ModuleClass.id}" data-module-path="${escapedPath}" data-module-title="${ModuleClass.title || ModuleClass.id}" title="Open in separate window">⬈</button>`
        : '';
      
      header.innerHTML = `
        <button class="dragHandleSec" title="Drag to reorder" tabindex="-1">≡</button>
        <span class="accent">${ModuleClass.title || ModuleClass.id}</span>
        ${detachBtn}
      `;
      section.appendChild(header);
      
      // Body
      const body = document.createElement('div');
      body.className = 'sectionBody addon-body';
      body.innerHTML = instance.getTemplate();
      section.appendChild(body);
      
      // Add styles if provided
      const styles = instance.getStyles();
      if (styles) {
        const styleEl = document.createElement('style');
        styleEl.textContent = styles;
        section.appendChild(styleEl);
      }
      
      // Add to container
      container.appendChild(section);
      
      // Mount
      instance.onMount(body);
      
      // Store module reference
      loadedModules.set(ModuleClass.id, {
        instance,
        section,
        modulePath,
        ModuleClass
      });
      
      console.log(`[addon-loader] Mounted addon: ${ModuleClass.id}`);
      
      // Initialize collapse behavior
      initCollapseForSection(section);
      
      return instance;
      
    } catch (e) {
      console.error(`[addon-loader] Error loading ${modulePath}:`, e);
      return null;
    }
  }
  
  /**
   * Initialize collapse behavior for a section
   */
  function initCollapseForSection(section) {
    const header = section.querySelector('.sectionHeader');
    const body = section.querySelector('.sectionBody');
    if (!header || !body) return;
    
    header.addEventListener('click', (e) => {
      if (e.target.closest('.dragHandleSec')) return;
      if (e.target.closest('.addon-detach-btn')) return;  // Don't collapse on detach click
      section.classList.toggle('collapsed');
    });
  }
  
  /**
   * Handle detach button clicks
   */
  function initDetachHandlers() {
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('.addon-detach-btn');
      if (!btn) return;
      
      const moduleId = btn.dataset.moduleId;
      const modulePath = btn.dataset.modulePath;
      const title = btn.dataset.moduleTitle;
      
      const moduleData = loadedModules.get(moduleId);
      if (!moduleData) return;
      
      const width = moduleData.ModuleClass.detachWidth || 500;
      const height = moduleData.ModuleClass.detachHeight || 600;
      
      console.log(`[addon-loader] Detaching: ${moduleId}`);
      
      try {
        // Save module state before detach (if module supports it)
        if (moduleData.instance && typeof moduleData.instance.getSerializedState === 'function') {
          const state = moduleData.instance.getSerializedState();
          if (state) {
            await ipcRenderer.invoke('module-store-state', { moduleId, state });
            console.log(`[addon-loader] Saved state for module: ${moduleId}`);
          }
        }
        
        const result = await ipcRenderer.invoke('module-detach', {
          moduleId,
          modulePath,
          title,
          width,
          height
        });
        
        if (result.success && !result.reused) {
          // Hide section in sidebar
          moduleData.section.classList.add('detached');
          moduleData.section.style.display = 'none';
        }
      } catch (err) {
        console.error(`[addon-loader] Detach failed:`, err);
      }
    });
    
    // Handle reattach notification
    ipcRenderer.on('module-reattached', async (event, { moduleId }) => {
      const moduleData = loadedModules.get(moduleId);
      if (moduleData) {
        // Try to get saved state and restore it
        try {
          const stateResult = await ipcRenderer.invoke('module-get-state', { moduleId });
          if (stateResult.success && stateResult.state && moduleData.instance) {
            // Unmount current instance
            if (typeof moduleData.instance.onUnmount === 'function') {
              moduleData.instance.onUnmount();
            }
            
            // Create new instance with saved state
            const NewInstance = new moduleData.ModuleClass({ savedState: stateResult.state });
            
            // Find body and re-render
            const body = moduleData.section.querySelector('.sectionBody');
            if (body) {
              body.innerHTML = NewInstance.getTemplate();
              NewInstance.onMount(body);
              moduleData.instance = NewInstance;
              console.log(`[addon-loader] Restored state for reattached module: ${moduleId}`);
            }
            
            // Clear stored state
            await ipcRenderer.invoke('module-clear-state', { moduleId });
          }
        } catch (e) {
          console.warn(`[addon-loader] Failed to restore state for ${moduleId}:`, e);
        }
        
        moduleData.section.classList.remove('detached');
        moduleData.section.style.display = '';
        console.log(`[addon-loader] Reattached: ${moduleId}`);
      }
    });
  }
  
  /**
   * Add detach button styles
   */
  function addDetachStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .addon-detach-btn {
        margin-left: auto;
        padding: 2px 6px;
        background: transparent;
        border: 1px solid var(--md-sys-color-outline-variant);
        border-radius: 4px;
        color: var(--md-sys-color-on-surface-variant);
        cursor: pointer;
        font-size: 12px;
        line-height: 1;
        opacity: 0.6;
        transition: opacity 0.15s, background 0.15s;
      }
      
      .addon-detach-btn:hover {
        opacity: 1;
        background: var(--md-sys-color-surface-container-high);
      }
      
      .addon-section.detached {
        opacity: 0.5;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * Load all enabled addons
   */
  async function loadAllAddons() {
    try {
      const addonPaths = await ipcRenderer.invoke('addons-get-enabled-paths');
      console.log('[addon-loader] Got addon paths:', addonPaths);
      
      if (!addonPaths || addonPaths.length === 0) {
        console.log('[addon-loader] No enabled addons');
        return;
      }
      
      for (const addon of addonPaths) {
        try {
          await loadAddonModule(addon.path, addon.addonId);
        } catch (e) {
          console.error(`[addon-loader] Failed to load ${addon.id}:`, e);
        }
      }
      
      console.log('[addon-loader] All addons loaded');
      
    } catch (e) {
      console.error('[addon-loader] Failed to get addon paths:', e);
    }
  }
  
  // Initialize
  addDetachStyles();
  initDetachHandlers();
  
  // Load addons after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllAddons);
  } else {
    // Small delay to ensure other scripts are initialized
    setTimeout(loadAllAddons, 100);
  }
  
})();
