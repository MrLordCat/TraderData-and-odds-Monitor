/**
 * Power Towers Editor - Editor Panel Sidebar Module
 * 
 * ATTACHED MODE: Shows launcher button to open editor in separate window
 * DETACHED MODE: Full editor with tabs for Waves/Enemies/Towers/Economy
 * 
 * Split into modules:
 * - templates.js - HTML templates
 * - styles.js - CSS styles
 * - file-manager.js - File read/write operations
 * - editor-controller.js - Editor UI logic
 */

module.exports = function({ SidebarModule, registerModule }) {
  const path = require('path');
  
  // Import local modules
  const { getLauncherTemplate, getEditorTemplate } = require(path.join(__dirname, 'templates.js'));
  const { getLauncherStyles, getEditorStyles } = require(path.join(__dirname, 'styles.js'));
  const { EditorController } = require(path.join(__dirname, 'editor-controller.js'));

  class EditorPanelModule extends SidebarModule {
    static id = 'editor-panel';
    static title = 'PT Editor';
    static icon = null;
    static order = 101;
    static detachable = true;
    static detachWidth = 450;
    static detachHeight = 700;

    constructor(options = {}) {
      super(options);
      this.isDetached = this.isDetached || options.isDetached || false;
      this.editorController = null;
    }

    getTemplate() {
      return this.isDetached ? getEditorTemplate() : getLauncherTemplate();
    }

    getStyles() {
      return this.isDetached ? getEditorStyles() : getLauncherStyles();
    }

    onMount(container) {
      super.onMount(container);
      
      // ═══════════════════════════════════════════════════════════════
      // ATTACHED MODE: Setup launch button
      // ═══════════════════════════════════════════════════════════════
      if (!this.isDetached) {
        const launchBtn = container.querySelector('#btn-launch');
        if (launchBtn) {
          launchBtn.addEventListener('click', () => {
            const { ipcRenderer } = require('electron');
            const modulePath = path.join(__dirname, 'index.js');
            ipcRenderer.invoke('module-detach', { 
              moduleId: 'editor-panel',
              modulePath: modulePath,
              title: 'PT Editor',
              width: EditorPanelModule.detachWidth,
              height: EditorPanelModule.detachHeight
            });
          });
        }
        return;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // DETACHED MODE: Initialize editor controller
      // ═══════════════════════════════════════════════════════════════
      this.editorController = new EditorController();
      this.editorController.init(container);
    }

    onUnmount() {
      // Could prompt to save if hasChanges
    }
  }

  // Register the module
  if (registerModule) registerModule(EditorPanelModule);
  return EditorPanelModule;
};