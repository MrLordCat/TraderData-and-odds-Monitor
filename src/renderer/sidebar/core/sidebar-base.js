/**
 * Sidebar Module System - Base class and registry
 * 
 * Provides the foundation for creating modular sidebar components.
 * Each module extends SidebarModule and registers itself.
 */

// Module registry
const moduleRegistry = new Map();

// Event bus for inter-module communication
const eventBus = {
  _listeners: new Map(),
  
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  },
  
  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  },
  
  emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.forEach(cb => {
        try { cb(data); } catch (e) { console.error(`[sidebar] Event ${event} handler error:`, e); }
      });
    }
  }
};

/**
 * Base class for sidebar modules
 */
class SidebarModule {
  // Override in subclass
  static id = 'base-module';
  static title = 'Module';
  static icon = null; // SVG string or null
  static order = 100; // Lower = higher in sidebar
  
  constructor(options = {}) {
    this.options = options;
    this.container = null;
    this.mounted = false;
    this._ipcCleanup = [];
  }
  
  /** Module ID */
  get id() { return this.constructor.id; }
  
  /** Module title */
  get title() { return this.constructor.title; }
  
  /** Module icon */
  get icon() { return this.constructor.icon; }
  
  /** Sort order */
  get order() { return this.constructor.order; }
  
  /**
   * Get the HTML template for this module
   * Override in subclass
   */
  getTemplate() {
    return `<div class="module-content">Module content</div>`;
  }
  
  /**
   * Called when module is mounted to DOM
   * @param {HTMLElement} container - The module's container element
   */
  onMount(container) {
    this.container = container;
    this.mounted = true;
  }
  
  /**
   * Called when module is unmounted from DOM
   */
  onUnmount() {
    this.mounted = false;
    this.container = null;
    // Cleanup IPC listeners
    this._ipcCleanup.forEach(fn => { try { fn(); } catch(_){} });
    this._ipcCleanup = [];
  }
  
  /**
   * Called when module receives IPC data
   * @param {string} channel - IPC channel name
   * @param {*} payload - Data payload
   */
  onIpc(channel, payload) {
    // Override in subclass
  }
  
  /**
   * Subscribe to IPC channel (auto-cleanup on unmount)
   */
  subscribeIpc(channel, handler) {
    if (window.desktopAPI && window.desktopAPI[channel]) {
      const cleanup = window.desktopAPI[channel](handler);
      if (typeof cleanup === 'function') {
        this._ipcCleanup.push(cleanup);
      }
    }
  }
  
  /**
   * Emit event to other modules
   */
  emit(event, data) {
    eventBus.emit(event, data);
  }
  
  /**
   * Listen to events from other modules
   */
  on(event, callback) {
    return eventBus.on(event, callback);
  }
  
  /**
   * Query DOM within module container
   */
  $(selector) {
    return this.container ? this.container.querySelector(selector) : null;
  }
  
  /**
   * Query all DOM within module container
   */
  $$(selector) {
    return this.container ? Array.from(this.container.querySelectorAll(selector)) : [];
  }
}

/**
 * Register a module class
 * @param {typeof SidebarModule} ModuleClass 
 */
function registerModule(ModuleClass) {
  if (!ModuleClass || !ModuleClass.id) {
    console.error('[sidebar] Invalid module class');
    return;
  }
  moduleRegistry.set(ModuleClass.id, ModuleClass);
}

/**
 * Get all registered modules sorted by order
 * @returns {Array<typeof SidebarModule>}
 */
function getModules() {
  return Array.from(moduleRegistry.values()).sort((a, b) => a.order - b.order);
}

/**
 * Get a specific module class by ID
 * @param {string} id 
 * @returns {typeof SidebarModule | undefined}
 */
function getModule(id) {
  return moduleRegistry.get(id);
}

/**
 * Create module instance
 * @param {string} id 
 * @param {object} options 
 * @returns {SidebarModule | null}
 */
function createModuleInstance(id, options = {}) {
  const ModuleClass = moduleRegistry.get(id);
  if (!ModuleClass) return null;
  return new ModuleClass(options);
}

// Export for CommonJS (Electron renderer)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SidebarModule,
    registerModule,
    getModules,
    getModule,
    createModuleInstance,
    eventBus
  };
}

// Also expose globally for script tags
if (typeof window !== 'undefined') {
  window.SidebarModule = SidebarModule;
  window.SidebarRegistry = { registerModule, getModules, getModule, createModuleInstance, eventBus };
}
