/**
 * Power Towers TD - Canvas & Overlay Styles
 * Game canvas, overlays, pause menu
 */

function getCanvasStyles() {
  return `
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
    
    /* ========================================
       PAUSE MENU (ESC)
       ======================================== */
    .pause-menu-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      backdrop-filter: blur(4px);
    }
    .pause-menu {
      background: rgba(20, 20, 35, 0.95);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 16px;
      padding: 24px 32px;
      min-width: 200px;
      text-align: center;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
    }
    .pause-title {
      margin: 0 0 20px;
      font-size: 20px;
      color: #fff;
    }
    .pause-buttons {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pause-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      background: rgba(255,255,255,0.1);
      color: #e2e8f0;
    }
    .pause-btn:hover {
      background: rgba(255,255,255,0.15);
      transform: translateY(-1px);
    }
    .pause-btn.primary {
      background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
      color: white;
    }
    .pause-btn.primary:hover {
      box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
    }
    .pause-btn.danger {
      background: rgba(252,129,129,0.2);
      color: #fc8181;
    }
    .pause-btn.danger:hover {
      background: rgba(252,129,129,0.3);
    }
  `;
}

module.exports = { getCanvasStyles };
