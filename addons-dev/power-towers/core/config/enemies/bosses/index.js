/**
 * Power Towers TD - Bosses Aggregator
 * 
 * Mini-bosses (waves 5, 15, 25, 35) and Main bosses (waves 10, 20, 30, 40)
 * Each boss is in its own file for complex mechanics
 */

// Mini-bosses
const IRON_GUARDIAN = require('./iron-guardian');
const STORM_HERALD = require('./storm-herald');
const CRYSTAL_WYRM = require('./crystal-wyrm');
const VOID_SENTINEL = require('./void-sentinel');

// Main bosses
const GOLEM_KING = require('./golem-king');
const SHADOW_LORD = require('./shadow-lord');
const INFERNO_TITAN = require('./inferno-titan');
const ANCIENT_DESTROYER = require('./ancient-destroyer');

/**
 * All bosses by id
 */
const BOSSES = {
  // Mini-bosses
  iron_guardian: IRON_GUARDIAN,
  storm_herald: STORM_HERALD,
  crystal_wyrm: CRYSTAL_WYRM,
  void_sentinel: VOID_SENTINEL,
  
  // Main bosses
  golem_king: GOLEM_KING,
  shadow_lord: SHADOW_LORD,
  inferno_titan: INFERNO_TITAN,
  ancient_destroyer: ANCIENT_DESTROYER,
};

/**
 * Boss wave schedule
 */
const BOSS_WAVES = {
  // Mini-bosses
  5: { type: 'mini', id: 'iron_guardian', name: 'Железный Страж' },
  15: { type: 'mini', id: 'storm_herald', name: 'Вестник Бури' },
  25: { type: 'mini', id: 'crystal_wyrm', name: 'Кристальный Змей' },
  35: { type: 'mini', id: 'void_sentinel', name: 'Страж Пустоты' },
  
  // Main bosses
  10: { type: 'main', id: 'golem_king', name: 'Король Големов' },
  20: { type: 'main', id: 'shadow_lord', name: 'Повелитель Теней' },
  30: { type: 'main', id: 'inferno_titan', name: 'Инферно Титан' },
  40: { type: 'final', id: 'ancient_destroyer', name: 'Древний Разрушитель' },
};

/**
 * Check if wave has a boss
 * @param {number} wave - Wave number
 * @returns {boolean}
 */
function isBossWave(wave) {
  return wave in BOSS_WAVES;
}

/**
 * Check if wave has a mini-boss
 * @param {number} wave - Wave number
 * @returns {boolean}
 */
function isMiniBossWave(wave) {
  return BOSS_WAVES[wave]?.type === 'mini';
}

/**
 * Check if wave has a main boss
 * @param {number} wave - Wave number
 * @returns {boolean}
 */
function isMainBossWave(wave) {
  const type = BOSS_WAVES[wave]?.type;
  return type === 'main' || type === 'final';
}

/**
 * Check if wave has final boss
 * @param {number} wave - Wave number
 * @returns {boolean}
 */
function isFinalBossWave(wave) {
  return BOSS_WAVES[wave]?.type === 'final';
}

/**
 * Get boss info for a wave
 * @param {number} wave - Wave number
 * @returns {Object|null} Boss info or null
 */
function getBossForWave(wave) {
  return BOSS_WAVES[wave] || null;
}

/**
 * Get boss config with abilities applied
 * @param {number} wave - Wave number
 * @returns {Object|null} Boss config or null
 */
function getBossConfig(wave) {
  const bossInfo = BOSS_WAVES[wave];
  if (!bossInfo) return null;
  
  const boss = BOSSES[bossInfo.id];
  if (!boss) return null;
  
  // Return boss with abilities applied
  if (boss.applyAbilities) {
    return boss.applyAbilities({ ...boss });
  }
  
  return { ...boss };
}

/**
 * Get boss by id
 * @param {string} bossId - Boss id
 * @returns {Object|null} Boss config or null
 */
function getBossById(bossId) {
  return BOSSES[bossId] || null;
}

/**
 * Get all boss waves in order
 * @returns {number[]} Array of wave numbers with bosses
 */
function getAllBossWaves() {
  return Object.keys(BOSS_WAVES).map(Number).sort((a, b) => a - b);
}

/**
 * Get mini-boss waves
 */
function getMiniBossWaves() {
  return Object.entries(BOSS_WAVES)
    .filter(([_, info]) => info.type === 'mini')
    .map(([wave]) => Number(wave))
    .sort((a, b) => a - b);
}

/**
 * Get main boss waves
 */
function getMainBossWaves() {
  return Object.entries(BOSS_WAVES)
    .filter(([_, info]) => info.type === 'main' || info.type === 'final')
    .map(([wave]) => Number(wave))
    .sort((a, b) => a - b);
}

module.exports = {
  // Bosses
  BOSSES,
  BOSS_WAVES,
  
  // Individual bosses
  IRON_GUARDIAN,
  STORM_HERALD,
  CRYSTAL_WYRM,
  VOID_SENTINEL,
  GOLEM_KING,
  SHADOW_LORD,
  INFERNO_TITAN,
  ANCIENT_DESTROYER,
  
  // Functions
  isBossWave,
  isMiniBossWave,
  isMainBossWave,
  isFinalBossWave,
  getBossForWave,
  getBossConfig,
  getBossById,
  getAllBossWaves,
  getMiniBossWaves,
  getMainBossWaves,
};
