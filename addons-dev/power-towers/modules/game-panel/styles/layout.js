/**
 * Power Towers TD - Layout & Menu Styles
 * Container, screens, menu buttons
 */

function getLayoutStyles() {
  return `
    .game-panel-container {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-family: 'Segoe UI', sans-serif;
      height: 100%;
      min-height: 0;
      box-sizing: border-box;
      overflow: hidden;
    }
    
    .game-screen { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; overflow: hidden; }
    .game-screen.menu-screen { align-items: center; justify-content: center; padding: 20px; }
    .gameplay-screen { flex: 1; min-height: 0; position: relative; padding-bottom: 0; }
    
    .menu-title { text-align: center; margin-bottom: 24px; }
    .menu-icon { font-size: 64px; display: block; margin-bottom: 12px; }
    .menu-title h2 { margin: 0; font-size: 28px; color: #fff; }
    .menu-subtitle { margin: 6px 0 0; font-size: 15px; color: #a0aec0; }
    
    .menu-buttons { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 260px; }
    .menu-btn {
      padding: 14px 20px; border: none; border-radius: 10px;
      background: rgba(255,255,255,0.1); color: #e2e8f0;
      font-size: 16px; cursor: pointer; transition: all 0.2s;
    }
    .menu-btn:hover { background: rgba(255,255,255,0.15); transform: translateX(4px); }
    .menu-btn.primary { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; font-weight: 600; }
    .menu-btn.primary:hover { box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3); }
    
    .menu-footer { margin-top: 32px; }
    .menu-footer .version { font-size: 11px; color: #718096; }
    
    .screen-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-shrink: 0; }
    .screen-header h3 { margin: 0; font-size: 18px; color: #fff; }
    .back-btn {
      padding: 8px 14px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;
      background: transparent; color: #a0aec0; font-size: 13px; cursor: pointer;
    }
    .back-btn:hover { background: rgba(255,255,255,0.1); }
    .back-btn.small { padding: 6px 10px; font-size: 12px; }
    
    .upgrades-list, .tips-list, .settings-list { display: flex; flex-direction: column; gap: 10px; }
    .upgrade-item, .setting-item {
      display: flex; align-items: center; gap: 12px;
      padding: 14px; background: rgba(0,0,0,0.3); border-radius: 10px;
    }
    .upgrade-icon { font-size: 28px; }
    .upgrade-info { flex: 1; }
    .upgrade-name { display: block; font-weight: 500; color: #fff; font-size: 15px; }
    .upgrade-desc { font-size: 12px; color: #a0aec0; }
    .upgrade-btn { padding: 8px 14px; border: none; border-radius: 6px; background: rgba(255,255,255,0.1); color: #a0aec0; }
    .tip-item { padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; font-size: 14px; color: #e2e8f0; }
    .setting-item { justify-content: space-between; font-size: 14px; color: #e2e8f0; }
    .toggle-btn { padding: 6px 14px; border: none; border-radius: 6px; background: rgba(255,255,255,0.1); color: #a0aec0; }
    .coming-soon { text-align: center; color: #718096; font-size: 13px; margin-top: 16px; }
  `;
}

module.exports = { getLayoutStyles };
