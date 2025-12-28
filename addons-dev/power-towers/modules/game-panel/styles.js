/**
 * Power Towers TD - CSS Styles
 */

/**
 * Launcher styles for attached mode (sidebar)
 */
function getLauncherStyles() {
  return `
    .game-launcher {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 20px;
      box-sizing: border-box;
    }
    .launcher-content { text-align: center; max-width: 280px; }
    .launcher-icon { font-size: 64px; margin-bottom: 12px; }
    .launcher-title { margin: 0 0 4px 0; font-size: 20px; color: #fff; }
    .launcher-subtitle { margin: 0 0 24px 0; font-size: 13px; color: #a0aec0; }
    .launcher-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 14px 24px;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
    }
    .launcher-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(72, 187, 120, 0.4);
    }
    .launcher-btn:active { transform: translateY(0); }
    .launcher-btn .btn-icon { font-size: 20px; }
    .launcher-hint { margin: 16px 0 0 0; font-size: 11px; color: #718096; }
  `;
}

/**
 * Full game styles for detached mode
 */
function getGameStyles() {
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
    .gameplay-screen { flex: 1; min-height: 0; }
    
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
    
    .game-stats-bar {
      display: flex; justify-content: space-between;
      padding: 10px 14px; background: rgba(0,0,0,0.4); border-radius: 8px;
      font-size: 15px; flex-shrink: 0;
    }
    .stat-item { display: flex; align-items: center; gap: 6px; }
    .stat-icon { font-size: 18px; }
    .stat-value { font-weight: bold; min-width: 28px; }
    .stat-value.danger { color: #fc8181; }
    .stat-value.warning { color: #f6ad55; }
    
    .canvas-container { 
      position: relative; border-radius: 10px; overflow: hidden; 
      flex: 1; min-height: 0;
      display: flex; align-items: center; justify-content: center;
      background: #0a0a12;
    }
    #game-canvas {
      display: block;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      cursor: crosshair;
    }
    
    .game-overlay {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center;
    }
    .overlay-content { text-align: center; }
    .overlay-content h3 { margin: 0 0 10px; font-size: 28px; color: #fff; }
    .overlay-content p { margin: 0 0 20px; color: #a0aec0; font-size: 16px; }
    
    .tower-select {
      display: flex; justify-content: center; gap: 10px;
      padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; flex-shrink: 0;
    }
    .tower-btn {
      width: 52px; height: 52px;
      border: 2px solid transparent; border-radius: 10px;
      background: rgba(255,255,255,0.1);
      font-size: 24px; cursor: pointer; transition: all 0.2s;
    }
    .tower-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.1); }
    .tower-btn.selected { border-color: #48bb78; background: rgba(72,187,120,0.2); }
    
    .game-controls { display: flex; gap: 10px; flex-shrink: 0; }
    .game-btn {
      flex: 1; padding: 14px; border: none; border-radius: 8px;
      font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s;
    }
    .game-btn.primary { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; }
    .game-btn.primary:hover { box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3); }
    .game-btn:not(.primary) { background: rgba(255,255,255,0.1); color: #e2e8f0; }
    .game-btn:not(.primary):hover { background: rgba(255,255,255,0.15); }
    .game-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .game-btn.small { flex: none; padding: 10px 16px; font-size: 13px; }
    .game-btn.danger { background: rgba(252,129,129,0.2); color: #fc8181; }
    .game-btn.active { background: #ecc94b; color: #1a202c; }
    
    .tower-info {
      padding: 12px; background: rgba(0,0,0,0.4); border-radius: 8px; flex-shrink: 0;
    }
    .tower-info-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .tower-info-header span:first-child { font-weight: 600; color: #fff; font-size: 15px; }
    .tower-info-header span:last-child { color: #a0aec0; font-size: 13px; }
    .tower-info-stats { display: flex; gap: 16px; margin-bottom: 10px; font-size: 14px; color: #e2e8f0; }
    .tower-info-actions { display: flex; gap: 10px; }
    
    .game-footer { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .game-footer .hint { margin: 0; font-size: 12px; color: #718096; flex: 1; text-align: right; }
  `;
}

module.exports = {
  getLauncherStyles,
  getGameStyles
};
