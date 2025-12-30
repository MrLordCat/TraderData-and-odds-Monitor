/**
 * PT Editor - File Manager
 * Handles reading/writing Power Towers game config files
 */

const path = require('path');
const fs = require('fs');

// Determine if we're in dev mode by checking for addons-dev folder
function isDevMode() {
  // Check if addons-dev exists relative to app path
  const possiblePaths = [
    // From electron app
    path.join(process.cwd(), 'addons-dev', 'power-towers'),
    // From package path
    path.join(__dirname, '..', '..', '..', '..', '..', 'addons-dev', 'power-towers'),
    // Direct workspace path
    'C:\\Users\\Chris\\Documents\\GitHub\\TraderData-and-odds-Monitor\\addons-dev\\power-towers'
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'core', 'config.js'))) {
      console.log('[pt-editor] Found dev mode path:', p);
      return p;
    }
  }
  return null;
}

// Find Power Towers addon path dynamically
function findPowerTowersPath() {
  // Priority 1: Dev mode (addons-dev folder)
  const devPath = isDevMode();
  if (devPath) {
    console.log('[pt-editor] Using DEV path:', devPath);
    return devPath;
  }
  
  // Priority 2: Sibling folder in AppData (addons/power-towers)
  const siblingPath = path.join(__dirname, '..', '..', '..', 'power-towers');
  console.log('[pt-editor] Checking sibling path:', siblingPath);
  if (fs.existsSync(path.join(siblingPath, 'core', 'config.js'))) {
    console.log('[pt-editor] Found at sibling path (AppData)');
    return siblingPath;
  }
  
  // Priority 3: AppData path explicit
  const appDataPath = process.env.APPDATA 
    ? path.join(process.env.APPDATA, 'oddsmoni', 'addons', 'power-towers')
    : null;
  console.log('[pt-editor] Checking AppData path:', appDataPath);
  if (appDataPath && fs.existsSync(path.join(appDataPath, 'core', 'config.js'))) {
    console.log('[pt-editor] Found at AppData path');
    return appDataPath;
  }
  
  console.warn('[pt-editor] Power Towers not found! Defaulting to sibling path');
  return siblingPath;
}

// Cached path - recalculate on each getPTPath call to handle detach/attach
let cachedPath = null;

class FileManager {
  static getPTPath() {
    if (!cachedPath) {
      cachedPath = findPowerTowersPath();
    }
    return cachedPath;
  }
  
  static resetPath() {
    cachedPath = null;
  }

  static readConfig() {
    const ptPath = this.getPTPath();
    const configPath = path.join(ptPath, 'core', 'config.js');
    console.log('[pt-editor] Reading config from:', configPath);
    try {
      delete require.cache[require.resolve(configPath)];
      return require(configPath);
    } catch (e) {
      console.error('[pt-editor] Failed to read config:', e);
      return null;
    }
  }

  static readTowerPaths() {
    const ptPath = this.getPTPath();
    const towerPath = path.join(ptPath, 'core', 'entities', 'tower-paths.js');
    try {
      delete require.cache[require.resolve(towerPath)];
      return require(towerPath);
    } catch (e) {
      console.error('[pt-editor] Failed to read tower paths:', e);
      // Try modules location
      try {
        const altPath = path.join(ptPath, 'modules', 'towers', 'tower-paths.js');
        delete require.cache[require.resolve(altPath)];
        return require(altPath);
      } catch (e2) {
        console.error('[pt-editor] Failed to read tower paths (alt):', e2);
        return null;
      }
    }
  }

  static readEnergyBuildings() {
    const ptPath = this.getPTPath();
    const defsPath = path.join(ptPath, 'modules', 'energy', 'building-defs.js');
    try {
      delete require.cache[require.resolve(defsPath)];
      return require(defsPath);
    } catch (e) {
      console.error('[pt-editor] Failed to read energy buildings:', e);
      return null;
    }
  }

  static writeConfig(configObj) {
    const ptPath = this.getPTPath();
    const configPath = path.join(ptPath, 'core', 'config.js');
    console.log('[pt-editor] Writing config to:', configPath);
    
    // Custom serializer for cleaner output
    const formatValue = (val, indent = '') => {
      if (val === null) return 'null';
      if (typeof val === 'string') return `'${val}'`;
      if (typeof val === 'number' || typeof val === 'boolean') return String(val);
      if (Array.isArray(val)) {
        if (val.length === 0) return '[]';
        const items = val.map(v => formatValue(v, indent + '  '));
        return `[${items.join(', ')}]`;
      }
      if (typeof val === 'object') {
        const lines = [];
        for (const [k, v] of Object.entries(val)) {
          lines.push(`${indent}  ${k}: ${formatValue(v, indent + '  ')}`);
        }
        return `{\n${lines.join(',\n')}\n${indent}}`;
      }
      return String(val);
    };
    
    let content = `/**
 * Power Towers TD - Game Configuration
 * All game constants and tunable values
 */

const CONFIG = {\n`;
    
    for (const [key, value] of Object.entries(configObj)) {
      content += `  ${key}: ${formatValue(value, '  ')},\n`;
    }
    
    content += `};

module.exports = CONFIG;
`;
    fs.writeFileSync(configPath, content, 'utf8');
  }

  static writeTowerPaths(towerPaths) {
    const ptPath = this.getPTPath();
    const towerPath = path.join(ptPath, 'core', 'entities', 'tower-paths.js');
    console.log('[pt-editor] Writing tower paths to:', towerPath);
    
    const serializeTiers = (tiers) => {
      if (!tiers || !Array.isArray(tiers)) return '[]';
      return tiers.map(t => {
        let s = '      {\n';
        for (const [k, v] of Object.entries(t)) {
          if (typeof v === 'string') {
            s += `        ${k}: '${v}',\n`;
          } else if (Array.isArray(v)) {
            s += `        ${k}: ${JSON.stringify(v)},\n`;
          } else {
            s += `        ${k}: ${v},\n`;
          }
        }
        s += '      }';
        return s;
      }).join(',\n');
    };
    
    let content = `/**
 * Tower Paths - Upgrade paths for towers
 * Each path has unique mechanics and progression
 */

const TOWER_PATHS = {\n`;
    
    for (const [key, val] of Object.entries(towerPaths)) {
      content += `  ${key}: {\n`;
      content += `    name: '${val.name}',\n`;
      content += `    icon: '${val.icon}',\n`;
      if (val.damageType) content += `    damageType: '${val.damageType}',\n`;
      if (val.strongVs) content += `    strongVs: ${JSON.stringify(val.strongVs)},\n`;
      if (val.weakVs) content += `    weakVs: ${JSON.stringify(val.weakVs)},\n`;
      if (val.tiers) content += `    tiers: [\n${serializeTiers(val.tiers)}\n    ]\n`;
      content += `  },\n`;
    }
    
    content += `};

module.exports = TOWER_PATHS;
`;
    fs.writeFileSync(towerPath, content, 'utf8');
  }

  static writeEnergyBuildings(buildings) {
    const ptPath = this.getPTPath();
    const defsPath = path.join(ptPath, 'modules', 'energy', 'building-defs.js');
    console.log('[pt-editor] Writing energy buildings to:', defsPath);
    
    let content = `/**
 * Energy Building Definitions
 * Cost, stats, and properties for each energy building type
 */

const ENERGY_BUILDINGS = {\n`;
    
    for (const [id, bld] of Object.entries(buildings)) {
      content += `  '${id}': {\n`;
      content += `    name: '${bld.name}',\n`;
      content += `    icon: '${bld.icon}',\n`;
      content += `    category: '${bld.category}',\n`;
      content += `    cost: ${bld.cost},\n`;
      if (bld.class) content += `    class: '${bld.class}',\n`;
      if (bld.description) content += `    description: '${bld.description}',\n`;
      if (bld.stats) {
        content += `    stats: {\n`;
        for (const [sk, sv] of Object.entries(bld.stats)) {
          content += `      ${sk}: ${sv},\n`;
        }
        content += `    },\n`;
      }
      content += `  },\n`;
    }
    
    content += `};

module.exports = ENERGY_BUILDINGS;
`;
    fs.writeFileSync(defsPath, content, 'utf8');
  }
}

module.exports = { FileManager };
