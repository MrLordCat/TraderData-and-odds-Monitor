/**
 * Power Towers TD - Bottom Panel Module
 * Main entry point that assembles all sections
 */

const { getBottomPanelTemplate } = require('./templates');
const { getBottomPanelStyles } = require('./styles');
const { StatsSection } = require('./stats-section');
const { AvatarSection } = require('./avatar-section');
const { BuildSection } = require('./build-section');

/**
 * Bottom Panel Controller
 * Manages the 3-section bottom panel layout
 */
class BottomPanelController {
  constructor(container, gameController) {
    this.container = container;
    this.gameController = gameController;
    this.sections = {};
    this.selectedObject = null; // tower or energy building
  }

  /**
   * Initialize bottom panel
   */
  init() {
    // Find or create bottom panel element
    this.element = this.container.querySelector('#bottom-panel');
    if (!this.element) {
      console.warn('[BottomPanel] Element not found');
      return;
    }

    // Initialize sections
    this.sections.stats = new StatsSection(
      this.element.querySelector('#panel-stats'),
      this
    );
    this.sections.avatar = new AvatarSection(
      this.element.querySelector('#panel-avatar'),
      this
    );
    this.sections.build = new BuildSection(
      this.element.querySelector('#panel-build'),
      this
    );

    // Initialize each section
    Object.values(this.sections).forEach(section => section.init());
  }

  /**
   * Show object info (tower or energy building)
   */
  showObjectInfo(object, type) {
    this.selectedObject = { data: object, type };
    
    this.sections.stats.showStats(object, type);
    this.sections.avatar.showAvatar(object, type);
    this.sections.build.showActions(object, type);
  }

  /**
   * Clear selection, show build menu
   */
  clearSelection() {
    this.selectedObject = null;
    
    this.sections.stats.showEmpty();
    this.sections.avatar.showEmpty();
    this.sections.build.showBuildMenu();
  }

  /**
   * Update stats display
   */
  updateStats(object, type) {
    if (this.selectedObject?.data === object) {
      this.sections.stats.updateStats(object, type);
    }
  }

  /**
   * Get game state
   */
  getGameState() {
    return this.gameController.game?.getState() || {};
  }

  /**
   * Get gold amount
   */
  getGold() {
    return this.getGameState().gold || 0;
  }
}

module.exports = {
  BottomPanelController,
  getBottomPanelTemplate,
  getBottomPanelStyles
};
