/**
 * Addon Loader for Stats Panel
 * 
 * Loads enabled addon sidebar modules into the stats panel.
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
  
  // Track loaded modules
  const loadedModules = new Map();
  
  /**
   * Simple base class for addon modules
   */
  class SidebarModule {
    static id = 'base';
    static title = 'Module';
    static order = 100;
    
    constructor(options = {}) {
      this.options = options;
      this.container = null;
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
      
      // Header
      const header = document.createElement('div');
      header.className = 'sectionHeader';
      header.innerHTML = `
        <button class="dragHandleSec" title="Drag to reorder" tabindex="-1">≡</button>
        <span class="accent">${ModuleClass.title || ModuleClass.id}</span>
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
      section.classList.toggle('collapsed');
    });
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

  // Load addons after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllAddons);
  } else {
    // Small delay to ensure other scripts are initialized
    setTimeout(loadAllAddons, 100);
  }
  
})();
