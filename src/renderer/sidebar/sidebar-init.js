/**
 * Sidebar Initialization
 * 
 * Entry point that loads all registered modules into the sidebar container.
 * Also loads external addons from userData/addons/ directory.
 */

(async function initSidebar() {
  'use strict';
  
  const container = document.getElementById('sidebar-root');
  if (!container) {
    console.error('[sidebar] Root container not found');
    return;
  }
  
  // Wait for desktopAPI to be available
  let retries = 0;
  while (!window.desktopAPI && retries < 50) {
    await new Promise(r => setTimeout(r, 100));
    retries++;
  }
  
  if (!window.desktopAPI) {
    console.warn('[sidebar] desktopAPI not available, some features may not work');
  }
  
  // Create loader and load all modules
  try {
    const loader = new window.SidebarLoader(container, {
      // Pass any global options here
    });
    
    // Load built-in modules first
    await loader.loadAll();
    
    // Load external addons (from userData/addons/)
    try {
      await loader.loadExternalAddons();
      console.log('[sidebar] External addons loaded');
    } catch (e) {
      console.warn('[sidebar] Failed to load external addons:', e);
    }
    
    // Expose for debugging
    window.__sidebarLoader = loader;
    
    console.log('[sidebar] Initialized with modules:', 
      Array.from(loader.instances.keys()).join(', '));
    
  } catch (e) {
    console.error('[sidebar] Initialization failed:', e);
  }
})();
