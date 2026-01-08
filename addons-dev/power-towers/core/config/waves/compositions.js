/**
 * Power Towers TD - Wave Compositions
 * 
 * Defines base enemy compositions for waves 1-40
 * Each wave has a template that gets processed by generation.js
 */

/**
 * Enemy type weights for random selection
 * Higher weight = more likely to spawn
 */
const TYPE_WEIGHTS = {
  minion: 40,    // Common cannon fodder
  scout: 25,     // Fast but fragile
  brute: 15,     // Tanky but slow
  swarmling: 20, // Groups of weak enemies
};

/**
 * Wave composition templates
 * 
 * Format:
 * - enemies: Array of { type, count, weight } - fixed enemies + weighted random
 * - pattern: 'standard' | 'rush' | 'siege' | 'mixed' | 'boss'
 * - auraChance: 0-1, override chance for auras
 * - special: Additional modifiers
 */
const WAVE_COMPOSITIONS = {
  // === TIER 1: Introduction (Waves 1-10) ===
  1: {
    enemies: [{ type: 'minion', count: 5 }],
    pattern: 'standard',
    auraChance: 0,  // No auras wave 1
    description: 'Beginning - minions only',
  },
  
  2: {
    enemies: [{ type: 'minion', count: 7 }],
    pattern: 'standard',
    description: 'More minions',
  },
  
  3: {
    enemies: [
      { type: 'minion', count: 5 },
      { type: 'scout', count: 2 },
    ],
    pattern: 'standard',
    description: 'First scouts',
  },
  
  4: {
    enemies: [
      { type: 'minion', count: 6 },
      { type: 'scout', count: 3 },
    ],
    pattern: 'rush',
    description: 'Fast wave',
  },
  
  5: {
    enemies: [
      { type: 'minion', count: 4 },
      { type: 'brute', count: 1 },
    ],
    pattern: 'boss',
    boss: { type: 'mini', id: 'iron_guardian' },
    description: 'First mini-boss: Iron Guardian',
  },
  
  6: {
    enemies: [
      { type: 'minion', count: 5 },
      { type: 'swarmling', count: 8 },
    ],
    pattern: 'swarm',
    description: 'First swarm',
  },
  
  7: {
    enemies: [
      { type: 'minion', count: 4 },
      { type: 'scout', count: 4 },
      { type: 'brute', count: 1 },
    ],
    pattern: 'mixed',
    description: 'Mixed wave',
  },
  
  8: {
    enemies: [
      { type: 'scout', count: 6 },
      { type: 'scout', count: 2, special: 'flying' },
    ],
    pattern: 'rush',
    description: 'Speed rush + first Flying enemies',
  },
  
  9: {
    enemies: [
      { type: 'minion', count: 6 },
      { type: 'brute', count: 2 },
      { type: 'swarmling', count: 6 },
    ],
    pattern: 'siege',
    description: 'Preparation for boss',
  },
  
  10: {
    enemies: [
      { type: 'minion', count: 3 },
    ],
    pattern: 'boss',
    boss: { type: 'main', id: 'golem_king' },
    description: 'Boss Tier 1: Golem King',
  },
  
  // === TIER 2: Expansion (Waves 11-20) ===
  11: {
    enemies: [
      { type: 'minion', count: 8 },
      { type: 'scout', count: 4 },
    ],
    pattern: 'standard',
    auraChance: 0.3,
    description: 'Tier 2 begins',
  },
  
  12: {
    enemies: [
      { type: 'brute', count: 2, special: 'armored' },
      { type: 'brute', count: 2 },
      { type: 'minion', count: 6 },
    ],
    pattern: 'siege',
    description: 'Tank push + first Armored enemies',
  },
  
  13: {
    enemies: [
      { type: 'swarmling', count: 15 },
      { type: 'scout', count: 3 },
    ],
    pattern: 'swarm',
    description: 'Mass swarm',
  },
  
  14: {
    enemies: [
      { type: 'minion', count: 6 },
      { type: 'scout', count: 3, special: 'flying' },
      { type: 'scout', count: 2 },
      { type: 'brute', count: 2 },
    ],
    pattern: 'mixed',
    auraChance: 0.5,
    description: 'Mixed assault with flying',
  },
  
  15: {
    enemies: [
      { type: 'scout', count: 4 },
      { type: 'brute', count: 2 },
      { type: 'minion', count: 2, special: 'regenerating' },
    ],
    pattern: 'boss',
    boss: { type: 'mini', id: 'storm_herald' },
    description: 'Mini-boss: Storm Herald + first Regenerating',
  },
  
  16: {
    enemies: [
      { type: 'minion', count: 10 },
      { type: 'swarmling', count: 10 },
      { type: 'minion', count: 2, special: 'magic_immune' },
    ],
    pattern: 'standard',
    description: 'Crowd wave + first Magic-Immune',
  },
  
  17: {
    enemies: [
      { type: 'scout', count: 6 },
      { type: 'scout', count: 4, special: 'flying' },
      { type: 'minion', count: 2, special: 'regenerating' },
    ],
    pattern: 'rush',
    auraChance: 0.7,
    description: 'Air blitz + Regenerating',
  },
  
  18: {
    enemies: [
      { type: 'brute', count: 3, special: 'armored' },
      { type: 'brute', count: 2 },
      { type: 'minion', count: 5 },
      { type: 'brute', count: 1, special: 'magic_immune' },
    ],
    pattern: 'siege',
    description: 'Armored siege + Magic-Immune brute',
  },
  
  19: {
    enemies: [
      { type: 'minion', count: 8 },
      { type: 'scout', count: 6 },
      { type: 'brute', count: 3 },
      { type: 'swarmling', count: 8 },
      { type: 'brute', count: 2, special: 'regenerating' },
    ],
    pattern: 'mixed',
    auraChance: 0.8,
    description: 'Total chaos + Regenerating brutes',
  },
  
  20: {
    enemies: [
      { type: 'brute', count: 2 },
      { type: 'minion', count: 4 },
      { type: 'brute', count: 1, special: 'magic_immune' },
    ],
    pattern: 'boss',
    boss: { type: 'main', id: 'shadow_lord' },
    description: 'Boss Tier 2: Shadow Lord',
  },
  
  // === TIER 3: Challenge (Waves 21-30) ===
  21: {
    enemies: [
      { type: 'minion', count: 12 },
      { type: 'scout', count: 6 },
      { type: 'brute', count: 3 },
      { type: 'minion', count: 2, special: 'shielded' },
    ],
    pattern: 'standard',
    auraChance: 0.6,
    description: 'Enhanced start + first Shielded',
  },
  
  22: {
    enemies: [
      { type: 'swarmling', count: 20 },
      { type: 'scout', count: 5 },
      { type: 'scout', count: 2, special: 'regenerating' },
    ],
    pattern: 'swarm',
    description: 'Huge swarm + Regenerating scouts',
  },
  
  23: {
    enemies: [
      { type: 'brute', count: 4, special: 'armored' },
      { type: 'brute', count: 2, special: 'magic_immune' },
      { type: 'minion', count: 8 },
    ],
    pattern: 'siege',
    auraChance: 0.7,
    description: 'Armored wave + Magic-Immune',
  },
  
  24: {
    enemies: [
      { type: 'scout', count: 12 },
      { type: 'swarmling', count: 10 },
      { type: 'scout', count: 3, special: 'shielded' },
    ],
    pattern: 'rush',
    description: 'Speed swarm + Shielded scouts',
  },
  
  25: {
    enemies: [
      { type: 'brute', count: 3, special: 'shielded' },
      { type: 'scout', count: 4 },
    ],
    pattern: 'boss',
    boss: { type: 'mini', id: 'crystal_wyrm' },
    description: 'Mini-boss: Crystal Wyrm + Shielded brutes',
  },
  
  26: {
    enemies: [
      { type: 'minion', count: 10 },
      { type: 'brute', count: 4 },
      { type: 'swarmling', count: 12 },
      { type: 'minion', count: 3, special: 'regenerating' },
      { type: 'brute', count: 2, special: 'magic_immune' },
    ],
    pattern: 'mixed',
    auraChance: 0.8,
    description: 'Chaotic wave with all specials',
  },
  
  27: {
    enemies: [
      { type: 'scout', count: 10 },
      { type: 'scout', count: 3, special: 'flying' },
      { type: 'scout', count: 2, special: 'shielded' },
    ],
    pattern: 'rush',
    auraChance: 0.9,
    description: 'Mass blitz with specials',
  },
  
  28: {
    enemies: [
      { type: 'brute', count: 4, special: 'armored' },
      { type: 'brute', count: 2, special: 'regenerating' },
      { type: 'brute', count: 2, special: 'shielded' },
      { type: 'minion', count: 6 },
    ],
    pattern: 'siege',
    description: 'Heavy siege - armored, regenerating, shielded',
  },
  
  29: {
    enemies: [
      { type: 'minion', count: 10 },
      { type: 'scout', count: 8 },
      { type: 'brute', count: 5 },
      { type: 'swarmling', count: 15 },
      { type: 'minion', count: 3, special: 'magic_immune' },
    ],
    pattern: 'mixed',
    auraChance: 1.0,
    description: 'Pre-boss chaos',
  },
  
  30: {
    enemies: [
      { type: 'brute', count: 2, special: 'shielded' },
      { type: 'brute', count: 2 },
      { type: 'minion', count: 4 },
    ],
    pattern: 'boss',
    boss: { type: 'main', id: 'inferno_titan' },
    description: 'Boss Tier 3: Inferno Titan',
  },
  
  // === TIER 4: Final Challenge (Waves 31-40) ===
  31: {
    enemies: [
      { type: 'minion', count: 15 },
      { type: 'scout', count: 8 },
      { type: 'brute', count: 5, special: 'armored' },
      { type: 'minion', count: 3, special: 'regenerating' },
    ],
    pattern: 'standard',
    auraChance: 0.8,
    description: 'Final tier begins',
  },
  
  32: {
    enemies: [
      { type: 'swarmling', count: 25 },
      { type: 'scout', count: 8, special: 'flying' },
      { type: 'scout', count: 4, special: 'shielded' },
    ],
    pattern: 'swarm',
    auraChance: 0.9,
    description: 'Mega-swarm with flying and shielded',
  },
  
  33: {
    enemies: [
      { type: 'brute', count: 6, special: 'armored' },
      { type: 'brute', count: 4, special: 'magic_immune' },
      { type: 'minion', count: 10 },
    ],
    pattern: 'siege',
    description: 'Impenetrable wall',
  },
  
  34: {
    enemies: [
      { type: 'scout', count: 12 },
      { type: 'scout', count: 6, special: 'flying' },
      { type: 'swarmling', count: 15 },
      { type: 'scout', count: 3, special: 'regenerating' },
    ],
    pattern: 'rush',
    auraChance: 1.0,
    description: 'Speed storm with specials',
  },
  
  35: {
    enemies: [
      { type: 'brute', count: 3, special: 'shielded' },
      { type: 'brute', count: 2, special: 'magic_immune' },
      { type: 'scout', count: 6, special: 'flying' },
      { type: 'minion', count: 5 },
    ],
    pattern: 'boss',
    boss: { type: 'mini', id: 'void_sentinel' },
    description: 'Mini-boss: Void Sentinel + elite specials',
  },
  
  36: {
    enemies: [
      { type: 'minion', count: 8 },
      { type: 'brute', count: 4, special: 'armored' },
      { type: 'brute', count: 3, special: 'regenerating' },
      { type: 'swarmling', count: 18 },
      { type: 'minion', count: 4, special: 'shielded' },
    ],
    pattern: 'mixed',
    auraChance: 1.0,
    description: 'Wave of chaos - all special types',
  },
  
  37: {
    enemies: [
      { type: 'scout', count: 15 },
      { type: 'scout', count: 5, special: 'flying' },
      { type: 'scout', count: 4, special: 'shielded' },
      { type: 'scout', count: 3, special: 'regenerating' },
    ],
    pattern: 'rush',
    auraChance: 1.0,
    description: 'Ultra-blitz with all scouts',
  },
  
  38: {
    enemies: [
      { type: 'brute', count: 6, special: 'armored' },
      { type: 'brute', count: 4, special: 'magic_immune' },
      { type: 'brute', count: 2, special: 'shielded' },
      { type: 'minion', count: 8 },
    ],
    pattern: 'siege',
    auraChance: 1.0,
    description: 'Fortress siege - elite brutes',
  },
  
  39: {
    enemies: [
      { type: 'minion', count: 10, special: 'magic_immune' },
      { type: 'scout', count: 8, special: 'flying' },
      { type: 'brute', count: 6, special: 'armored' },
      { type: 'swarmling', count: 20 },
      { type: 'brute', count: 4, special: 'regenerating' },
      { type: 'scout', count: 4, special: 'shielded' },
    ],
    pattern: 'mixed',
    auraChance: 1.0,
    description: 'The final wave - everything at once',
  },
  
  40: {
    enemies: [
      { type: 'brute', count: 4, special: 'shielded' },
      { type: 'brute', count: 3, special: 'magic_immune' },
      { type: 'scout', count: 4, special: 'flying' },
      { type: 'minion', count: 4 },
    ],
    pattern: 'boss',
    boss: { type: 'final', id: 'ancient_destroyer' },
    description: 'FINAL BOSS: Ancient Destroyer',
  },
};

/**
 * Spawn patterns - affects spawn timing
 */
const SPAWN_PATTERNS = {
  standard: {
    interval: 800,       // ms between spawns
    groupSize: 1,        // Enemies per spawn
    variation: 0.2,      // Random timing variation
  },
  rush: {
    interval: 400,
    groupSize: 1,
    variation: 0.3,
  },
  siege: {
    interval: 1200,
    groupSize: 1,
    variation: 0.1,
  },
  swarm: {
    interval: 300,
    groupSize: 2,
    variation: 0.4,
  },
  mixed: {
    interval: 600,
    groupSize: 1,
    variation: 0.3,
  },
  boss: {
    interval: 1500,      // Regular enemies spawn slowly
    groupSize: 1,
    variation: 0.1,
    bossDelay: 5000,     // Boss spawns after 5s delay
  },
};

/**
 * Get wave composition by number
 * @param {number} wave - Wave number
 * @returns {Object|null} Wave composition
 */
function getWaveComposition(wave) {
  return WAVE_COMPOSITIONS[wave] || null;
}

/**
 * Get spawn pattern config
 * @param {string} patternName - Pattern name
 * @returns {Object} Pattern config
 */
function getSpawnPattern(patternName) {
  return SPAWN_PATTERNS[patternName] || SPAWN_PATTERNS.standard;
}

/**
 * Check if wave has boss
 * @param {number} wave - Wave number
 * @returns {Object|null} Boss info or null
 */
function getWaveBoss(wave) {
  const composition = WAVE_COMPOSITIONS[wave];
  return composition?.boss || null;
}

/**
 * Get total enemy count for a wave
 * @param {number} wave - Wave number
 * @returns {number} Total enemies (excluding boss)
 */
function getWaveEnemyCount(wave) {
  const composition = WAVE_COMPOSITIONS[wave];
  if (!composition) return 0;
  
  return composition.enemies.reduce((sum, entry) => sum + entry.count, 0);
}

module.exports = {
  WAVE_COMPOSITIONS,
  SPAWN_PATTERNS,
  TYPE_WEIGHTS,
  getWaveComposition,
  getSpawnPattern,
  getWaveBoss,
  getWaveEnemyCount,
};
