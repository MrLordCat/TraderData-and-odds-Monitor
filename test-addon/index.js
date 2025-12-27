/**
 * Power Towers TD - Test Addon Entry Point
 * 
 * This file is loaded when addon is enabled.
 * It can perform initialization, register IPC handlers, etc.
 */

console.log('[power-towers-test] Addon loaded');

module.exports = {
  name: 'Power Towers TD Test',
  version: '0.0.1',
  
  init() {
    console.log('[power-towers-test] Initialized');
  },
  
  destroy() {
    console.log('[power-towers-test] Destroyed');
  }
};
