/**
 * Power Towers TD - Actions Menu Styles
 * Upgrade cards, ability cards, action buttons
 */

function getActionsStyles() {
  return `
    /* ========================================
       Actions Menu (when object selected)
       ======================================== */
    .actions-menu {
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: 100%;
    }
    
    /* Tower upgrades two-column layout */
    .tower-upgrades-container {
      display: flex;
      gap: 8px;
      height: 100%;
    }
    .upgrades-column,
    .abilities-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .column-header {
      font-size: 10px;
      font-weight: 600;
      color: #a0aec0;
      padding: 4px 6px;
      background: rgba(255,255,255,0.05);
      border-radius: 4px;
      margin-bottom: 4px;
      text-align: center;
    }
    
    .actions-row {
      display: flex;
      gap: 6px;
    }
    
    .action-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      color: #a0aec0;
      cursor: pointer;
      transition: all 0.2s;
    }
    .action-btn:hover {
      background: rgba(72, 187, 120, 0.15);
      border-color: rgba(72, 187, 120, 0.4);
      color: #68d391;
    }
    .action-btn.active {
      background: rgba(72, 187, 120, 0.2);
      border-color: #68d391;
      color: #68d391;
    }
    .action-icon { font-size: 16px; }
    .action-label { font-size: 9px; }
    
    .upgrades-panel,
    .abilities-panel {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }
    
    .energy-actions-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .energy-action {
      flex: none !important;
      width: 100%;
    }
    
    .upgrades-grid,
    .abilities-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px;
      padding: 2px;
    }
  `;
}

module.exports = { getActionsStyles };
