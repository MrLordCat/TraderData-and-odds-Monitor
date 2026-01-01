/**
 * Power Towers TD - Biome Helpers
 * Centralized biome data and display utilities
 */

/**
 * Biome configuration data
 */
const BIOME_DATA = {
  forest:    { icon: '🌲', name: 'Forest' },
  mountains: { icon: '⛰️', name: 'Mountains' },
  desert:    { icon: '🏜️', name: 'Desert' },
  water:     { icon: '🌊', name: 'Water' },
  swamp:     { icon: '🌿', name: 'Swamp' },
  tundra:    { icon: '❄️', name: 'Tundra' },
  plains:    { icon: '🌾', name: 'Plains' },
  elevated:  { icon: '🏔️', name: 'Elevated' },
  burned:    { icon: '🔥', name: 'Burned' },
  default:   { icon: '🗺️', name: 'Unknown' }
};

/**
 * Get biome icon
 * @param {string} biomeType - Biome type key
 * @returns {string} Emoji icon
 */
function getBiomeIcon(biomeType) {
  return BIOME_DATA[biomeType]?.icon || BIOME_DATA.default.icon;
}

/**
 * Get biome name
 * @param {string} biomeType - Biome type key
 * @returns {string} Display name
 */
function getBiomeName(biomeType) {
  return BIOME_DATA[biomeType]?.name || BIOME_DATA.default.name;
}

/**
 * Get biome data
 * @param {string} biomeType - Biome type key
 * @returns {{ icon: string, name: string }} Biome data
 */
function getBiomeData(biomeType) {
  return BIOME_DATA[biomeType] || BIOME_DATA.default;
}

/**
 * Format biome icons string (main + borders)
 * @param {string} mainBiome - Main biome type
 * @param {string[]} nearbyBiomes - Array of nearby biome types
 * @returns {string} Combined icons string
 */
function formatBiomeIcons(mainBiome, nearbyBiomes = []) {
  let icons = getBiomeIcon(mainBiome);
  
  for (const biome of nearbyBiomes) {
    if (biome !== mainBiome) {
      icons += getBiomeIcon(biome);
    }
  }
  
  return icons;
}

/**
 * Format biome name with borders
 * @param {string} mainBiome - Main biome type
 * @param {Object[]} borders - Array of border objects with biome/name properties
 * @returns {string} Combined name string
 */
function formatBiomeTitle(mainBiome, borders = []) {
  let title = getBiomeName(mainBiome);
  
  for (const border of borders) {
    const borderName = border.name || getBiomeName(border.biome);
    title += ` + ${borderName}`;
  }
  
  return title;
}

/**
 * Format biome bonuses for display
 * @param {Object} modifiers - Biome modifiers object { towerDamage, towerRange, generation, efficiency, capacity }
 * @returns {string[]} Array of formatted bonus strings
 */
function formatBiomeBonuses(modifiers) {
  const bonuses = [];
  
  // Tower bonuses
  if (modifiers.towerDamage && modifiers.towerDamage !== 1) {
    const pct = Math.round((modifiers.towerDamage - 1) * 100);
    bonuses.push(`${pct >= 0 ? '+' : ''}${pct}% DMG`);
  }
  if (modifiers.towerRange && modifiers.towerRange !== 1) {
    const pct = Math.round((modifiers.towerRange - 1) * 100);
    bonuses.push(`${pct >= 0 ? '+' : ''}${pct}% RNG`);
  }
  
  // Energy building bonuses
  if (modifiers.generation && modifiers.generation !== 1) {
    const pct = Math.round((modifiers.generation - 1) * 100);
    bonuses.push(`${pct >= 0 ? '+' : ''}${pct}% Gen`);
  }
  if (modifiers.efficiency && modifiers.efficiency !== 1) {
    const pct = Math.round((modifiers.efficiency - 1) * 100);
    bonuses.push(`${pct >= 0 ? '+' : ''}${pct}% Eff`);
  }
  if (modifiers.capacity && modifiers.capacity !== 1) {
    const pct = Math.round((modifiers.capacity - 1) * 100);
    bonuses.push(`${pct >= 0 ? '+' : ''}${pct}% Cap`);
  }
  
  return bonuses;
}

/**
 * Check if any bonus is negative (penalty)
 * @param {string[]} bonusStrings - Array of formatted bonus strings
 * @returns {boolean} True if any penalty exists
 */
function hasPenalty(bonusStrings) {
  return bonusStrings.some(s => s.startsWith('-'));
}

/**
 * Update biome section DOM elements
 * @param {Object} elements - DOM elements { icon, name, bonus }
 * @param {string} biomeType - Main biome type
 * @param {Object} options - Options { nearbyBiomes, modifiers, borders }
 */
function updateBiomeSection(elements, biomeType, options = {}) {
  const { nearbyBiomes = [], modifiers = {}, borders = [] } = options;
  
  // Update icon
  if (elements.icon) {
    elements.icon.textContent = getBiomeIcon(biomeType);
  }
  
  // Update name with borders
  if (elements.name) {
    let nameText = getBiomeName(biomeType);
    
    // Show border biomes as icons if nearbyBiomes provided
    if (nearbyBiomes.length > 0) {
      const borderIcons = nearbyBiomes
        .filter(b => b !== biomeType)
        .map(b => getBiomeIcon(b))
        .join('');
      if (borderIcons) {
        nameText += ` (${borderIcons})`;
      }
    }
    
    elements.name.textContent = nameText;
  }
  
  // Update bonus display
  if (elements.bonus) {
    const bonuses = formatBiomeBonuses(modifiers);
    elements.bonus.textContent = bonuses.length > 0 ? bonuses.join(', ') : '—';
    elements.bonus.classList.toggle('penalty', hasPenalty(bonuses));
  }
}

module.exports = {
  BIOME_DATA,
  getBiomeIcon,
  getBiomeName,
  getBiomeData,
  formatBiomeIcons,
  formatBiomeTitle,
  formatBiomeBonuses,
  hasPenalty,
  updateBiomeSection
};
