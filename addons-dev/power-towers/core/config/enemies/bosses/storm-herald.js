/**
 * Power Towers TD - Storm Herald Boss
 * 
 * Mini-boss for Wave 15
 * Fast mage with lightning abilities
 */

const STORM_HERALD = {
  id: 'storm_herald',
  name: 'Storm Herald',
  emoji: '⛈️',
  
  // Base stats
  baseHealth: 60,
  baseSpeed: 45,
  reward: 150,
  xp: 20,
  
  // Boss type
  type: 'mini',
  wave: 15,
  
  // Visual
  color: '#4169E1',  // Royal blue
  size: 28,
  
  // Special abilities
  abilities: [
    {
      id: 'lightning_shield',
      name: 'Lightning Shield',
      description: 'Blocks first 3 hits every 8 sec',
      type: 'passive',
      effect: {
        chargesMax: 3,
        rechargeCooldown: 8000,
      },
    },
    {
      id: 'storm_dash',
      name: 'Storm Dash',
      description: 'Teleports forward 150px every 6 sec',
      type: 'active',
      cooldown: 6000,
      effect: {
        distance: 150,
        invulnerableDuring: true,
      },
    },
  ],
  
  // Loot
  loot: {
    guaranteed: [
      { type: 'gold', amount: 150 },
    ],
    chance: [
      { type: 'gem', amount: 1, chance: 0.4 },
    ],
  },
  
  // Death effect
  onDeath: {
    effect: 'lightning_burst',
    radius: 80,
    sound: 'thunder_crack',
  },
  
  description: 'Fast mini-boss with protective shield and teleportation.',
};

/**
 * Apply abilities to boss instance
 */
function applyAbilities(boss) {
  const modified = { ...boss };
  
  // Lightning Shield
  const shield = STORM_HERALD.abilities[0].effect;
  modified.shieldCharges = shield.chargesMax;
  modified.shieldMaxCharges = shield.chargesMax;
  modified.shieldRechargeTimer = 0;
  modified.shieldRechargeCooldown = shield.rechargeCooldown;
  
  // Storm Dash
  modified.dashCooldown = 0;
  modified.dashConfig = STORM_HERALD.abilities[1];
  
  return modified;
}

/**
 * Process shield hit
 * @param {Object} boss - Boss instance
 * @returns {boolean} True if damage was blocked
 */
function processShieldHit(boss) {
  if (boss.shieldCharges > 0) {
    boss.shieldCharges--;
    return true; // Damage blocked
  }
  return false;
}

/**
 * Update shield recharge
 * @param {Object} boss - Boss instance
 * @param {number} deltaTime - Time since last update
 */
function updateShield(boss, deltaTime) {
  if (boss.shieldCharges < boss.shieldMaxCharges) {
    boss.shieldRechargeTimer += deltaTime;
    if (boss.shieldRechargeTimer >= boss.shieldRechargeCooldown) {
      boss.shieldCharges = boss.shieldMaxCharges;
      boss.shieldRechargeTimer = 0;
    }
  }
}

module.exports = {
  ...STORM_HERALD,
  applyAbilities,
  processShieldHit,
  updateShield,
};
