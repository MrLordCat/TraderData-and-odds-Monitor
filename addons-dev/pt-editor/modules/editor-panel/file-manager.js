/**
 * PT Editor - File Manager
 * Handles reading/writing Power Towers game config files
 */

const path = require('path');
const fs = require('fs');

// Find Power Towers addon path
function findPowerTowersPath() {
  // Try sibling folder (same addons directory)
  const siblingPath = path.join(__dirname, '..', '..', '..', 'power-towers');
  if (fs.existsSync(path.join(siblingPath, 'core', 'config.js'))) {
    return siblingPath;
  }
  
  // Try AppData path
  const appDataPath = process.env.APPDATA 
    ? path.join(process.env.APPDATA, 'odds-desktop', 'addons', 'power-towers')
    : null;
  if (appDataPath && fs.existsSync(path.join(appDataPath, 'core', 'config.js'))) {
    return appDataPath;
  }
  
  return siblingPath;
}

const PT_PATH = findPowerTowersPath();

class FileManager {
  static getPTPath() {
    return PT_PATH;
  }

  static readConfig() {
    const configPath = path.join(PT_PATH, 'core', 'config.js');
    try {
      delete require.cache[require.resolve(configPath)];
      return require(configPath);
    } catch (e) {
      console.error('[pt-editor] Failed to read config:', e);
      return null;
    }
  }

  static readTowerTypes() {
    const towerPath = path.join(PT_PATH, 'core', 'entities', 'tower.js');
    try {
      delete require.cache[require.resolve(towerPath)];
      const module = require(towerPath);
      return module.TOWER_TYPES || module.TOWER_PATHS;
    } catch (e) {
      console.error('[pt-editor] Failed to read tower types:', e);
      return null;
    }
  }

  static readEnemyTypes() {
    const enemiesPath = path.join(PT_PATH, 'modules', 'enemies', 'index.js');
    try {
      const content = fs.readFileSync(enemiesPath, 'utf8');
      const match = content.match(/const ENEMY_TYPES\s*=\s*(\{[\s\S]*?\n\});/);
      if (match) {
        return new Function('return ' + match[1])();
      }
      return null;
    } catch (e) {
      console.error('[pt-editor] Failed to read enemy types:', e);
      return null;
    }
  }

  static writeConfig(configObj) {
    const configPath = path.join(PT_PATH, 'core', 'config.js');
    const content = `/**
 * Power Towers TD - Game Configuration
 * All game constants and tunable values
 */

const CONFIG = ${JSON.stringify(configObj, null, 2)};

module.exports = CONFIG;
`;
    fs.writeFileSync(configPath, content, 'utf8');
  }

  static writeEnemyTypes(enemyTypes) {
    const enemiesPath = path.join(PT_PATH, 'modules', 'enemies', 'index.js');
    let content = fs.readFileSync(enemiesPath, 'utf8');
    
    let typesStr = 'const ENEMY_TYPES = {\n';
    for (const [key, val] of Object.entries(enemyTypes)) {
      typesStr += `  ${key}: {\n`;
      typesStr += `    name: '${val.name}',\n`;
      typesStr += `    emoji: '${val.emoji}',\n`;
      typesStr += `    baseHealth: ${val.baseHealth},\n`;
      typesStr += `    baseSpeed: ${val.baseSpeed},\n`;
      typesStr += `    reward: ${val.reward},\n`;
      typesStr += `    color: '${val.color}'\n`;
      typesStr += `  },\n`;
    }
    typesStr += '};';
    
    content = content.replace(/const ENEMY_TYPES\s*=\s*\{[\s\S]*?\n\};/, typesStr);
    fs.writeFileSync(enemiesPath, content, 'utf8');
  }

  static writeTowerPaths(towerPaths) {
    const towerPath = path.join(PT_PATH, 'core', 'entities', 'tower.js');
    let content = fs.readFileSync(towerPath, 'utf8');
    
    const serializeTiers = (tiers) => {
      return tiers.map(t => {
        let s = '      {\n';
        for (const [k, v] of Object.entries(t)) {
          if (typeof v === 'string') {
            s += `        ${k}: '${v}',\n`;
          } else {
            s += `        ${k}: ${v},\n`;
          }
        }
        s += '      }';
        return s;
      }).join(',\n');
    };
    
    let pathsStr = 'const TOWER_PATHS = {\n';
    for (const [key, val] of Object.entries(towerPaths)) {
      pathsStr += `  ${key}: {\n`;
      pathsStr += `    name: '${val.name}',\n`;
      pathsStr += `    icon: '${val.icon}',\n`;
      pathsStr += `    damageType: '${val.damageType}',\n`;
      pathsStr += `    strongVs: ${JSON.stringify(val.strongVs)},\n`;
      pathsStr += `    weakVs: ${JSON.stringify(val.weakVs)},\n`;
      pathsStr += `    tiers: [\n${serializeTiers(val.tiers)}\n    ]\n`;
      pathsStr += `  },\n`;
    }
    pathsStr += '};';
    
    content = content.replace(/const TOWER_PATHS\s*=\s*\{[\s\S]*?\n\};/, pathsStr);
    fs.writeFileSync(towerPath, content, 'utf8');
  }
}

module.exports = { FileManager };
