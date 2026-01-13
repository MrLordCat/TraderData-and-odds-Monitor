/**
 * Extension Installer - Dialogs for Edge extension installation/update
 */

const { dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Create extension installer manager
 * @param {Object} opts - Options
 * @param {Object} opts.store - electron-store instance
 * @param {Object} opts.app - Electron app instance
 */
function createExtensionInstaller(opts = {}) {
  const { store, app } = opts;

  // Get path to bundled extension
  function getExtensionPath() {
    // In dev: resources/extensions/uptime
    // In packaged: resources/extensions/uptime
    const devPath = path.join(__dirname, '..', '..', '..', '..', 'resources', 'extensions', 'uptime');
    const prodPath = path.join(process.resourcesPath, 'extensions', 'uptime');
    
    if (fs.existsSync(devPath)) return devPath;
    if (fs.existsSync(prodPath)) return prodPath;
    
    // Fallback to user data
    const userDataPath = path.join(app?.getPath('userData') || '', 'extensions', 'uptime');
    return userDataPath;
  }

  // Show installation dialog
  async function showInstallDialog(parentWindow) {
    const extensionPath = getExtensionPath();
    
    const result = await dialog.showMessageBox(parentWindow, {
      type: 'info',
      title: 'Установить расширение upTime',
      message: 'Для интеграции с DS установите расширение upTime в Edge.',
      detail: `Инструкция:\n\n1. Откройте Edge → edge://extensions/\n2. Включите "Режим разработчика" (справа вверху)\n3. Нажмите "Загрузить распакованное расширение"\n4. Выберите папку (откроется после нажатия кнопки)\n5. Перезагрузите страницу DS`,
      buttons: ['Показать папку расширения', 'Позже'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });

    if (result.response === 0) {
      shell.openPath(extensionPath);
    }

    return result.response;
  }

  // Show update dialog
  async function showUpdateDialog(parentWindow, currentVersion, latestVersion) {
    const extensionPath = getExtensionPath();
    
    const result = await dialog.showMessageBox(parentWindow, {
      type: 'info',
      title: 'Обновление расширения upTime',
      message: `Доступна новая версия расширения upTime`,
      detail: `Текущая версия: ${currentVersion}\nНовая версия: ${latestVersion}\n\nИнструкция:\n\n1. Откройте edge://extensions/\n2. Найдите "Uptime Tracker"\n3. Нажмите кнопку обновления (🔄)\n\nПапка расширения:\n${extensionPath}`,
      buttons: ['Показать папку расширения', 'Позже'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });

    if (result.response === 0) {
      shell.openPath(extensionPath);
    }

    return result.response;
  }

  // Check if first launch (extension not installed)
  function shouldShowInstallPrompt() {
    // Check if user dismissed prompt before
    const dismissed = store?.get('extensionInstallDismissed');
    if (dismissed) return false;
    
    // Check if extension was ever connected
    const wasConnected = store?.get('extensionWasConnected');
    return !wasConnected;
  }

  // Mark prompt as dismissed
  function dismissInstallPrompt() {
    store?.set('extensionInstallDismissed', true);
  }

  // Mark extension as connected (don't show install prompt again)
  function markExtensionConnected() {
    store?.set('extensionWasConnected', true);
  }

  // Copy extension to user data folder (for easier access)
  async function copyExtensionToUserData() {
    const sourcePath = getExtensionPath();
    const targetPath = path.join(app?.getPath('userData') || '', 'extensions', 'uptime');
    
    if (!fs.existsSync(sourcePath)) {
      console.warn('[extensionInstaller] Source extension not found:', sourcePath);
      return null;
    }
    
    try {
      // Create target directory
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      
      // Copy files
      copyFolderSync(sourcePath, targetPath);
      console.log('[extensionInstaller] Extension copied to:', targetPath);
      return targetPath;
    } catch (err) {
      console.error('[extensionInstaller] Copy failed:', err.message);
      return null;
    }
  }

  // Helper: recursive folder copy
  function copyFolderSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        copyFolderSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  return {
    getExtensionPath,
    showInstallDialog,
    showUpdateDialog,
    shouldShowInstallPrompt,
    dismissInstallPrompt,
    markExtensionConnected,
    copyExtensionToUserData
  };
}

module.exports = { createExtensionInstaller };
