// Animation/Transition warm-up module
// Prevents "cold start" lag on first user interaction by pre-triggering animations
// This forces browser to compile CSS, create GPU layers, and JIT-compile JS

(function() {
  'use strict';
  
  const WARMUP_DELAY = 100; // Wait for initial render
  
  function warmup() {
    console.log('[warmup] Starting animation warm-up...');
    const startTime = performance.now();
    
    const root = document.documentElement;
    
    // 1. Force GPU layer creation for animated elements FIRST
    warmupGpuLayers();
    
    // 2. Tab switching warm-up - force render all tab panels (no animation)
    root.classList.add('warmup-no-transition');
    warmupTabs();
    root.classList.remove('warmup-no-transition');
    
    // 3. Theme transition warm-up is handled centrally by splash manager
    //    (toggles theme across ALL views simultaneously for full CSS compilation)
    
    console.log(`[warmup] Complete in ${(performance.now() - startTime).toFixed(1)}ms`);
  }
  
  function warmupTabs() {
    // Find all tab buttons and panels
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (!tabBtns.length) return;
    
    // Remember current active tab
    const activeBtn = document.querySelector('.tab-btn.active');
    const activeTab = activeBtn?.dataset.tab;
    
    // Briefly show each tab to force render
    tabBtns.forEach(btn => {
      const tabId = btn.dataset.tab;
      const panel = document.getElementById(tabId);
      if (panel) {
        panel.style.display = 'block';
        void panel.offsetHeight; // Force layout
        panel.style.display = '';
      }
    });
    
    // Restore active tab state
    tabContents.forEach(tc => {
      tc.classList.toggle('active', tc.id === activeTab);
    });
  }
  
  function warmupGpuLayers() {
    // Force GPU layer creation for elements that will animate
    const animatedSelectors = [
      'body',
      '.panel',
      '.seg',
      '.lolTableWrap',
      '.teamActivity',
      '.statsEmbedWrap',
      '.sectionHeader',
      '.sectionCard',
      '.spTopbar',
      '.statsControls',
      '.cell-glow',
      '#settingsOverlayBackdrop'
    ];
    
    animatedSelectors.forEach(sel => {
      const els = document.querySelectorAll(sel);
      els.forEach(el => {
        // Trigger GPU layer creation
        const transform = el.style.transform;
        el.style.transform = 'translateZ(0)';
        void el.offsetHeight;
        el.style.transform = transform || '';
      });
    });
  }
  
  // Run warm-up after initial page render
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(warmup, WARMUP_DELAY);
    });
  } else {
    setTimeout(warmup, WARMUP_DELAY);
  }
  
  // Export for manual triggering if needed
  window.__warmup = warmup;
})();
