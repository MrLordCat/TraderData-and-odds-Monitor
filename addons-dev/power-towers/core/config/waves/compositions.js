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
    description: 'Начало - только миньоны',
  },
  
  2: {
    enemies: [{ type: 'minion', count: 7 }],
    pattern: 'standard',
    description: 'Больше миньонов',
  },
  
  3: {
    enemies: [
      { type: 'minion', count: 5 },
      { type: 'scout', count: 2 },
    ],
    pattern: 'standard',
    description: 'Первые скауты',
  },
  
  4: {
    enemies: [
      { type: 'minion', count: 6 },
      { type: 'scout', count: 3 },
    ],
    pattern: 'rush',
    description: 'Быстрая волна',
  },
  
  5: {
    enemies: [
      { type: 'minion', count: 4 },
      { type: 'brute', count: 1 },
    ],
    pattern: 'boss',
    boss: { type: 'mini', id: 'iron_guardian' },
    description: 'Первый мини-босс: Железный Страж',
  },
  
  6: {
    enemies: [
      { type: 'minion', count: 5 },
      { type: 'swarmling', count: 8 },
    ],
    pattern: 'swarm',
    description: 'Первый рой',
  },
  
  7: {
    enemies: [
      { type: 'minion', count: 4 },
      { type: 'scout', count: 4 },
      { type: 'brute', count: 1 },
    ],
    pattern: 'mixed',
    description: 'Смешанная волна',
  },
  
  8: {
    enemies: [
      { type: 'scout', count: 8 },
    ],
    pattern: 'rush',
    description: 'Скоростной натиск',
  },
  
  9: {
    enemies: [
      { type: 'minion', count: 6 },
      { type: 'brute', count: 2 },
      { type: 'swarmling', count: 6 },
    ],
    pattern: 'siege',
    description: 'Подготовка к боссу',
  },
  
  10: {
    enemies: [
      { type: 'minion', count: 3 },
    ],
    pattern: 'boss',
    boss: { type: 'main', id: 'golem_king' },
    description: 'Босс Tier 1: Король Големов',
  },
  
  // === TIER 2: Expansion (Waves 11-20) ===
  11: {
    enemies: [
      { type: 'minion', count: 8 },
      { type: 'scout', count: 4 },
    ],
    pattern: 'standard',
    auraChance: 0.3,
    description: 'Начало второго уровня',
  },
  
  12: {
    enemies: [
      { type: 'brute', count: 4 },
      { type: 'minion', count: 6 },
    ],
    pattern: 'siege',
    description: 'Танковый напор',
  },
  
  13: {
    enemies: [
      { type: 'swarmling', count: 15 },
      { type: 'scout', count: 3 },
    ],
    pattern: 'swarm',
    description: 'Массовый рой',
  },
  
  14: {
    enemies: [
      { type: 'minion', count: 6 },
      { type: 'scout', count: 5 },
      { type: 'brute', count: 2 },
    ],
    pattern: 'mixed',
    auraChance: 0.5,
    description: 'Смешанный натиск',
  },
  
  15: {
    enemies: [
      { type: 'scout', count: 4 },
      { type: 'brute', count: 2 },
    ],
    pattern: 'boss',
    boss: { type: 'mini', id: 'storm_herald' },
    description: 'Мини-босс: Вестник Бури',
  },
  
  16: {
    enemies: [
      { type: 'minion', count: 10 },
      { type: 'swarmling', count: 10 },
    ],
    pattern: 'standard',
    description: 'Волна толпы',
  },
  
  17: {
    enemies: [
      { type: 'scout', count: 10 },
    ],
    pattern: 'rush',
    auraChance: 0.7,
    description: 'Скоростной блиц',
  },
  
  18: {
    enemies: [
      { type: 'brute', count: 5 },
      { type: 'minion', count: 5 },
    ],
    pattern: 'siege',
    description: 'Тяжёлая осада',
  },
  
  19: {
    enemies: [
      { type: 'minion', count: 8 },
      { type: 'scout', count: 6 },
      { type: 'brute', count: 3 },
      { type: 'swarmling', count: 8 },
    ],
    pattern: 'mixed',
    auraChance: 0.8,
    description: 'Полный хаос',
  },
  
  20: {
    enemies: [
      { type: 'brute', count: 2 },
      { type: 'minion', count: 4 },
    ],
    pattern: 'boss',
    boss: { type: 'main', id: 'shadow_lord' },
    description: 'Босс Tier 2: Повелитель Теней',
  },
  
  // === TIER 3: Challenge (Waves 21-30) ===
  21: {
    enemies: [
      { type: 'minion', count: 12 },
      { type: 'scout', count: 6 },
      { type: 'brute', count: 3 },
    ],
    pattern: 'standard',
    auraChance: 0.6,
    description: 'Усиленное начало',
  },
  
  22: {
    enemies: [
      { type: 'swarmling', count: 20 },
      { type: 'scout', count: 5 },
    ],
    pattern: 'swarm',
    description: 'Огромный рой',
  },
  
  23: {
    enemies: [
      { type: 'brute', count: 6 },
      { type: 'minion', count: 8 },
    ],
    pattern: 'siege',
    auraChance: 0.7,
    description: 'Бронированная волна',
  },
  
  24: {
    enemies: [
      { type: 'scout', count: 12 },
      { type: 'swarmling', count: 10 },
    ],
    pattern: 'rush',
    description: 'Скоростной рой',
  },
  
  25: {
    enemies: [
      { type: 'brute', count: 3 },
      { type: 'scout', count: 4 },
    ],
    pattern: 'boss',
    boss: { type: 'mini', id: 'crystal_wyrm' },
    description: 'Мини-босс: Кристальный Змей',
  },
  
  26: {
    enemies: [
      { type: 'minion', count: 10 },
      { type: 'brute', count: 4 },
      { type: 'swarmling', count: 12 },
    ],
    pattern: 'mixed',
    auraChance: 0.8,
    description: 'Хаотичная волна',
  },
  
  27: {
    enemies: [
      { type: 'scout', count: 15 },
    ],
    pattern: 'rush',
    auraChance: 0.9,
    description: 'Массовый блиц',
  },
  
  28: {
    enemies: [
      { type: 'brute', count: 8 },
      { type: 'minion', count: 6 },
    ],
    pattern: 'siege',
    description: 'Тяжёлая осада',
  },
  
  29: {
    enemies: [
      { type: 'minion', count: 10 },
      { type: 'scout', count: 8 },
      { type: 'brute', count: 5 },
      { type: 'swarmling', count: 15 },
    ],
    pattern: 'mixed',
    auraChance: 1.0,
    description: 'Преддверие босса',
  },
  
  30: {
    enemies: [
      { type: 'brute', count: 4 },
      { type: 'scout', count: 3 },
    ],
    pattern: 'boss',
    boss: { type: 'main', id: 'inferno_titan' },
    description: 'Босс Tier 3: Инферно Титан',
  },
  
  // === TIER 4: Final Challenge (Waves 31-40) ===
  31: {
    enemies: [
      { type: 'minion', count: 15 },
      { type: 'scout', count: 8 },
      { type: 'brute', count: 5 },
    ],
    pattern: 'standard',
    auraChance: 0.8,
    description: 'Финальный уровень',
  },
  
  32: {
    enemies: [
      { type: 'swarmling', count: 25 },
      { type: 'scout', count: 8 },
    ],
    pattern: 'swarm',
    auraChance: 0.9,
    description: 'Мега-рой',
  },
  
  33: {
    enemies: [
      { type: 'brute', count: 10 },
      { type: 'minion', count: 10 },
    ],
    pattern: 'siege',
    description: 'Непробиваемая стена',
  },
  
  34: {
    enemies: [
      { type: 'scout', count: 18 },
      { type: 'swarmling', count: 15 },
    ],
    pattern: 'rush',
    auraChance: 1.0,
    description: 'Скоростной шторм',
  },
  
  35: {
    enemies: [
      { type: 'brute', count: 5 },
      { type: 'scout', count: 6 },
      { type: 'minion', count: 5 },
    ],
    pattern: 'boss',
    boss: { type: 'mini', id: 'void_sentinel' },
    description: 'Мини-босс: Страж Пустоты',
  },
  
  36: {
    enemies: [
      { type: 'minion', count: 12 },
      { type: 'brute', count: 6 },
      { type: 'swarmling', count: 18 },
    ],
    pattern: 'mixed',
    auraChance: 1.0,
    description: 'Волна хаоса',
  },
  
  37: {
    enemies: [
      { type: 'scout', count: 20 },
    ],
    pattern: 'rush',
    auraChance: 1.0,
    description: 'Ультра-блиц',
  },
  
  38: {
    enemies: [
      { type: 'brute', count: 12 },
      { type: 'minion', count: 8 },
    ],
    pattern: 'siege',
    auraChance: 1.0,
    description: 'Осада крепости',
  },
  
  39: {
    enemies: [
      { type: 'minion', count: 15 },
      { type: 'scout', count: 12 },
      { type: 'brute', count: 8 },
      { type: 'swarmling', count: 20 },
    ],
    pattern: 'mixed',
    auraChance: 1.0,
    description: 'Последняя волна',
  },
  
  40: {
    enemies: [
      { type: 'brute', count: 6 },
      { type: 'scout', count: 4 },
      { type: 'minion', count: 4 },
    ],
    pattern: 'boss',
    boss: { type: 'final', id: 'ancient_destroyer' },
    description: 'ФИНАЛЬНЫЙ БОСС: Древний Разрушитель',
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
