/**
 * Sidebar Loader - Dynamic module loading and rendering
 * 
 * Manages the lifecycle of sidebar modules:
 * - Loading module files
 * - Rendering modules to container
 * - Managing IPC routing to modules
 */

const { getModules, createModuleInstance, eventBus } = require('./sidebar-base');

class SidebarLoader {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.options = options;
    this.instances = new Map(); // id -> module instance
    this.ipcRouter = null;
  }
  
  /**
   * Load and render all registered modules
   */
  async loadAll() {
    const modules = getModules();
    
    for (const ModuleClass of modules) {
      await this.loadModule(ModuleClass.id);
    }
    
    this.setupIpcRouter();
  }
  
  /**
   * Load a specific module by ID
   */
  async loadModule(moduleId, options = {}) {
    if (this.instances.has(moduleId)) {
      console.warn(`[sidebar] Module ${moduleId} already loaded`);
      return this.instances.get(moduleId);
    }
    
    const instance = createModuleInstance(moduleId, { ...this.options, ...options });
    if (!instance) {
      console.error(`[sidebar] Module ${moduleId} not found in registry`);
      return null;
    }
    
    // Create wrapper element
    const wrapper = document.createElement('div');
    wrapper.className = 'sidebar-module';
    wrapper.dataset.module = moduleId;
    wrapper.id = `module-${moduleId}`;
    
    // Add header if module has title
    if (instance.title) {
      const header = document.createElement('div');
      header.className = 'module-header';
      header.innerHTML = `
        <span class="module-title">${instance.title}</span>
        <div class="module-actions"></div>
      `;
      wrapper.appendChild(header);
    }
    
    // Add content container
    const content = document.createElement('div');
    content.className = 'module-content';
    content.innerHTML = instance.getTemplate();
    wrapper.appendChild(content);
    
    // Insert in correct order
    this.insertInOrder(wrapper, instance.order);
    
    // Mount
    instance.onMount(wrapper);
    this.instances.set(moduleId, instance);
    
    return instance;
  }
  
  /**
   * Unload a module
   */
  unloadModule(moduleId) {
    const instance = this.instances.get(moduleId);
    if (!instance) return;
    
    instance.onUnmount();
    
    const wrapper = this.container.querySelector(`[data-module="${moduleId}"]`);
    if (wrapper) {
      wrapper.remove();
    }
    
    this.instances.delete(moduleId);
  }
  
  /**
   * Insert module wrapper in correct order
   */
  insertInOrder(wrapper, order) {
    const existing = Array.from(this.container.querySelectorAll('.sidebar-module'));
    let insertBefore = null;
    
    for (const el of existing) {
      const id = el.dataset.module;
      const instance = this.instances.get(id);
      if (instance && instance.order > order) {
        insertBefore = el;
        break;
      }
    }
    
    if (insertBefore) {
      this.container.insertBefore(wrapper, insertBefore);
    } else {
      this.container.appendChild(wrapper);
    }
  }
  
  /**
   * Setup IPC routing to modules
   */
  setupIpcRouter() {
    if (!window.desktopAPI) return;
    
    // Common IPC channels that modules might listen to
    const channels = [
      'onOddsUpdate',
      'onBoardUpdated',
      'onAutoRefreshUpdated',
      'onBrokerOpened',
      'onBrokerClosed',
      'onLayoutChanged',
      'onMapUpdated',
      'onExcelTeamNames',
      'onAutoStateUpdated'
    ];
    
    channels.forEach(channel => {
      if (typeof window.desktopAPI[channel] === 'function') {
        window.desktopAPI[channel]((payload) => {
          this.routeIpc(channel, payload);
        });
      }
    });
  }
  
  /**
   * Route IPC message to all modules
   */
  routeIpc(channel, payload) {
    this.instances.forEach((instance, id) => {
      try {
        instance.onIpc(channel, payload);
      } catch (e) {
        console.error(`[sidebar] Module ${id} IPC error on ${channel}:`, e);
      }
    });
    
    // Also emit on event bus
    eventBus.emit(`ipc:${channel}`, payload);
  }
  
  /**
   * Get module instance by ID
   */
  getModule(id) {
    return this.instances.get(id);
  }
  
  /**
   * Destroy all modules
   */
  destroy() {
    this.instances.forEach((instance, id) => {
      this.unloadModule(id);
    });
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SidebarLoader };
}

if (typeof window !== 'undefined') {
  window.SidebarLoader = SidebarLoader;
}
