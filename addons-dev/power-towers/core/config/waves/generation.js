/**
 * Power Towers TD - Wave Generation
 * 
 * Main wave generation logic that combines:
 * - Wave compositions
 * - Enemy scaling
 * - Aura selection
 * - Elite rolls
 */

const { applyScaling, getEnemyCount } = require('./scaling');
const { getWaveComposition, getSpawnPattern, getWaveBoss } = require('./compositions');
const { selectAurasForWave, applyAurasToEnemy, AURAS } = require('./auras');
const { rollForElite, applyEliteModifiers } = require('../enemies/elite');
const { BOSS_WAVES, getBossConfig } = require('../enemies/bosses');
const { BASE_ENEMIES } = require('../enemies/base');

/**
 * Generate spawn queue for a wave
 * @param {number} wave - Wave number
 * @returns {Object} Wave data with spawn queue
 */
function generateWave(wave) {
  const composition = getWaveComposition(wave);
  
  if (!composition) {
    // Fallback for waves beyond 40
    return generateEndlessWave(wave);
  }
  
  const pattern = getSpawnPattern(composition.pattern);
  const bossInfo = getWaveBoss(wave);
  
  // Select auras for this wave
  const auraChance = composition.auraChance ?? 0.5;
  const hasAuras = Math.random() < auraChance;
  const selectedAuras = hasAuras ? selectAurasForWave(wave) : [];
  
  // Generate enemy spawn queue
  const spawnQueue = [];
  let spawnTime = 0;
  
  // Process each enemy type in composition
  for (const entry of composition.enemies) {
    const baseEnemy = BASE_ENEMIES[entry.type];
    if (!baseEnemy) continue;
    
    for (let i = 0; i < entry.count; i++) {
      // Create enemy instance
      let enemy = createEnemyInstance(baseEnemy, wave, selectedAuras);
      
      // Roll for elite
      if (rollForElite(wave)) {
        enemy = applyEliteModifiers(enemy);
      }
      
      // Calculate spawn time with variation
      const variation = 1 + (Math.random() - 0.5) * 2 * pattern.variation;
      spawnTime += pattern.interval * variation;
      
      spawnQueue.push({
        enemy,
        spawnTime: Math.round(spawnTime),
      });
    }
  }
  
  // Add boss if present
  if (bossInfo) {
    const bossConfig = getBossConfig(wave);
    if (bossConfig) {
      const boss = createBossInstance(bossConfig, wave);
      spawnQueue.push({
        enemy: boss,
        spawnTime: spawnTime + pattern.bossDelay,
        isBoss: true,
      });
    }
  }
  
  // Sort by spawn time
  spawnQueue.sort((a, b) => a.spawnTime - b.spawnTime);
  
  return {
    wave,
    composition,
    pattern,
    auras: selectedAuras,
    aurasInfo: selectedAuras.map(id => ({
      id,
      name: AURAS[id]?.name,
      emoji: AURAS[id]?.emoji,
    })),
    boss: bossInfo,
    spawnQueue,
    totalEnemies: spawnQueue.length,
    estimatedDuration: spawnQueue.length > 0 
      ? spawnQueue[spawnQueue.length - 1].spawnTime 
      : 0,
  };
}

/**
 * Create enemy instance with scaling and auras
 * @param {Object} baseEnemy - Base enemy config
 * @param {number} wave - Wave number
 * @param {string[]} auras - Applied auras
 * @returns {Object} Enemy instance
 */
function createEnemyInstance(baseEnemy, wave, auras = []) {
  // Apply wave scaling
  let enemy = applyScaling(baseEnemy, wave);
  
  // Add instance-specific data
  enemy = {
    ...enemy,
    id: `${baseEnemy.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    wave,
    isElite: false,
    auras: [],
    statusEffects: [],
    currentHealth: enemy.health,
    maxHealth: enemy.health,
    pathProgress: 0,
  };
  
  // Apply auras if any
  if (auras.length > 0) {
    const allyCount = 10; // Approximate, will be updated at spawn
    enemy = applyAurasToEnemy(enemy, auras, { allyCount });
  }
  
  return enemy;
}

/**
 * Create boss instance
 * @param {Object} bossConfig - Boss configuration
 * @param {number} wave - Wave number
 * @returns {Object} Boss instance
 */
function createBossInstance(bossConfig, wave) {
  const boss = {
    ...bossConfig,
    id: `boss_${bossConfig.id}_${Date.now()}`,
    wave,
    isBoss: true,
    isElite: false,
    auras: [],
    statusEffects: [],
  };
  
  // Apply wave scaling to boss
  const scaled = applyScaling({ 
    baseHealth: bossConfig.baseHealth, 
    baseSpeed: bossConfig.baseSpeed,
    reward: bossConfig.reward,
  }, wave);
  
  // Boss has additional multipliers
  const bossType = BOSS_WAVES[wave]?.type || 'main';
  const healthMultiplier = bossType === 'mini' ? 3 : bossType === 'final' ? 20 : 10;
  
  boss.health = Math.round(scaled.health * healthMultiplier);
  boss.maxHealth = boss.health;
  boss.currentHealth = boss.health;
  boss.speed = scaled.speed * (bossConfig.speedMod || 1);
  boss.reward = scaled.reward * (bossType === 'mini' ? 5 : bossType === 'final' ? 50 : 20);
  boss.pathProgress = 0;
  
  return boss;
}

/**
 * Generate wave for endless mode (beyond wave 40)
 * @param {number} wave - Wave number
 * @returns {Object} Wave data
 */
function generateEndlessWave(wave) {
  // Endless mode - procedural generation
  const enemyTypes = ['minion', 'scout', 'brute', 'swarmling'];
  const baseCount = 15 + Math.floor((wave - 40) * 2);
  
  const enemies = [];
  let remaining = baseCount;
  
  // Random distribution
  while (remaining > 0) {
    const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    const count = Math.min(remaining, Math.ceil(Math.random() * 5));
    enemies.push({ type, count });
    remaining -= count;
  }
  
  const composition = {
    enemies,
    pattern: 'mixed',
    auraChance: 1.0,
    description: `Endless Wave ${wave}`,
  };
  
  const pattern = getSpawnPattern('mixed');
  const selectedAuras = selectAurasForWave(wave);
  
  // Generate spawn queue
  const spawnQueue = [];
  let spawnTime = 0;
  
  for (const entry of enemies) {
    const baseEnemy = BASE_ENEMIES[entry.type];
    if (!baseEnemy) continue;
    
    for (let i = 0; i < entry.count; i++) {
      let enemy = createEnemyInstance(baseEnemy, wave, selectedAuras);
      
      if (rollForElite(wave)) {
        enemy = applyEliteModifiers(enemy);
      }
      
      const variation = 1 + (Math.random() - 0.5) * 2 * pattern.variation;
      spawnTime += pattern.interval * variation;
      
      spawnQueue.push({
        enemy,
        spawnTime: Math.round(spawnTime),
      });
    }
  }
  
  // Mini-boss every 5 waves in endless
  if (wave % 5 === 0) {
    const miniBoss = {
      id: `endless_boss_${wave}`,
      name: `Endless Champion ${wave}`,
      emoji: '👹',
      baseHealth: 1000 + (wave - 40) * 200,
      baseSpeed: 30,
      reward: 200 + (wave - 40) * 50,
      xp: 50,
      isBoss: true,
    };
    
    const bossInstance = createBossInstance(miniBoss, wave);
    spawnQueue.push({
      enemy: bossInstance,
      spawnTime: spawnTime + 5000,
      isBoss: true,
    });
  }
  
  spawnQueue.sort((a, b) => a.spawnTime - b.spawnTime);
  
  return {
    wave,
    composition,
    pattern,
    auras: selectedAuras,
    aurasInfo: selectedAuras.map(id => ({
      id,
      name: AURAS[id]?.name,
      emoji: AURAS[id]?.emoji,
    })),
    boss: wave % 5 === 0 ? { type: 'endless', id: `endless_${wave}` } : null,
    spawnQueue,
    totalEnemies: spawnQueue.length,
    estimatedDuration: spawnQueue.length > 0 
      ? spawnQueue[spawnQueue.length - 1].spawnTime 
      : 0,
    isEndless: true,
  };
}

/**
 * Get wave preview for UI
 * @param {number} wave - Wave number
 * @returns {Object} Preview data
 */
function getWavePreview(wave) {
  const composition = getWaveComposition(wave);
  const boss = getWaveBoss(wave);
  
  if (!composition) {
    return {
      wave,
      description: `Endless Wave ${wave}`,
      enemies: 'Random',
      boss: wave % 5 === 0 ? 'Endless Champion' : null,
    };
  }
  
  return {
    wave,
    description: composition.description,
    enemies: composition.enemies.map(e => `${e.count}x ${e.type}`).join(', '),
    pattern: composition.pattern,
    auraChance: composition.auraChance,
    boss: boss ? getBossConfig(wave)?.name : null,
  };
}

module.exports = {
  generateWave,
  createEnemyInstance,
  createBossInstance,
  generateEndlessWave,
  getWavePreview,
};
