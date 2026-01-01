/**
 * Power Towers TD - Panel Toggle Mixin
 * Reusable panel toggle functionality
 */

/**
 * Create panel toggle mixin for GameController
 * Reduces duplication of toggle/show/hide panel logic
 * 
 * @param {Class} Base - Base class to extend
 * @returns {Class} Extended class with panel toggle methods
 */
function PanelToggleMixin(Base) {
  return class extends Base {
    /**
     * Toggle a panel's visibility
     * @param {Object} config - Panel configuration
     * @param {HTMLElement} config.panel - Panel element
     * @param {HTMLElement} config.button - Toggle button element
     * @param {Function} config.onShow - Callback when showing panel
     * @param {Function} config.onHide - Callback when hiding panel
     * @param {HTMLElement[]} config.otherPanels - Other panels to hide when showing this one
     * @param {HTMLElement[]} config.otherButtons - Other buttons to deactivate
     * @returns {boolean} True if panel is now visible
     */
    togglePanel(config) {
      const { panel, button, onShow, onHide, otherPanels = [], otherButtons = [] } = config;
      
      if (!panel) return false;
      
      const isVisible = panel.style.display !== 'none';
      
      if (isVisible) {
        // Hide panel
        panel.style.display = 'none';
        if (button) button.classList.remove('active');
        if (onHide) onHide();
        return false;
      } else {
        // Hide other panels first
        otherPanels.forEach(p => {
          if (p) p.style.display = 'none';
        });
        otherButtons.forEach(b => {
          if (b) b.classList.remove('active');
        });
        
        // Show this panel
        panel.style.display = 'block';
        if (button) button.classList.add('active');
        if (onShow) onShow();
        return true;
      }
    }
    
    /**
     * Show a panel
     * @param {Object} config - Same as togglePanel
     */
    showPanel(config) {
      const { panel, button, onShow, otherPanels = [], otherButtons = [] } = config;
      
      if (!panel) return;
      
      // Hide other panels
      otherPanels.forEach(p => {
        if (p) p.style.display = 'none';
      });
      otherButtons.forEach(b => {
        if (b) b.classList.remove('active');
      });
      
      // Show this panel
      panel.style.display = 'block';
      if (button) button.classList.add('active');
      if (onShow) onShow();
    }
    
    /**
     * Hide a panel
     * @param {Object} config - Panel configuration
     */
    hidePanel(config) {
      const { panel, button, onHide } = config;
      
      if (panel) {
        panel.style.display = 'none';
      }
      if (button) {
        button.classList.remove('active');
      }
      if (onHide) {
        onHide();
      }
    }
  };
}

module.exports = { PanelToggleMixin };
