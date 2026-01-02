/**
 * Power Towers TD - Launcher Styles
 * Styles for attached mode (sidebar)
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

module.exports = { getLauncherStyles };
