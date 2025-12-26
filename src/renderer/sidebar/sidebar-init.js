/**
 * Sidebar Initialization
 * 
 * Entry point that loads all registered modules into the sidebar container.
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
    
    await loader.loadAll();
    
    // Expose for debugging
    window.__sidebarLoader = loader;
    
    console.log('[sidebar] Initialized with modules:', 
      Array.from(loader.instances.keys()).join(', '));
    
  } catch (e) {
    console.error('[sidebar] Initialization failed:', e);
  }
})();
