/**
 * Power Towers TD - Tower Paths
 * 
 * Element upgrade paths for towers.
 */

const TOWER_PATHS = {
  fire: {
    name: 'Fire Path',
    icon: '🔥',
    damageType: 'magical',
    strongVs: ['heavy', 'undead'],
    weakVs: ['fire_immune'],
    tiers: [
      {
        tier: 1,
        name: 'Flame Tower',
        damage: 15,
        range: 65,
        fireRate: 1.0,
        energyCost: 3,
        burnDamage: 2,
        burnDuration: 60
      },
      {
        tier: 2,
        name: 'Inferno Tower',
        damage: 25,
        range: 70,
        fireRate: 0.8,
        energyCost: 5,
        splashRadius: 25,
        burnDamage: 3,
        burnDuration: 90
      },
      {
        tier: 3,
        name: 'Phoenix Spire',
        damage: 40,
        range: 80,
        fireRate: 0.7,
        energyCost: 8,
        splashRadius: 35,
        burnDamage: 5,
        burnDuration: 120
      }
    ]
  },
  
  ice: {
    name: 'Ice Path',
    icon: '❄️',
    damageType: 'magical',
    strongVs: ['light', 'flying'],
    weakVs: ['ice_immune'],
    tiers: [
      {
        tier: 1,
        name: 'Frost Tower',
        damage: 10,
        range: 60,
        fireRate: 1.2,
        energyCost: 3,
        slowPercent: 0.3,
        slowDuration: 60
      },
      {
        tier: 2,
        name: 'Blizzard Tower',
        damage: 18,
        range: 70,
        fireRate: 1.0,
        energyCost: 5,
        splashRadius: 30,
        slowPercent: 0.5,
        slowDuration: 90
      },
      {
        tier: 3,
        name: 'Absolute Zero',
        damage: 30,
        range: 80,
        fireRate: 0.8,
        energyCost: 8,
        splashRadius: 40,
        slowPercent: 0.8,
        slowDuration: 120
      }
    ]
  },
  
  lightning: {
    name: 'Lightning Path',
    icon: '⚡',
    damageType: 'physical',
    strongVs: ['medium', 'mech'],
    weakVs: ['grounded'],
    tiers: [
      {
        tier: 1,
        name: 'Spark Tower',
        damage: 12,
        range: 70,
        fireRate: 1.5,
        energyCost: 4
      },
      {
        tier: 2,
        name: 'Tesla Coil',
        damage: 20,
        range: 75,
        fireRate: 1.3,
        energyCost: 6,
        chainCount: 2
      },
      {
        tier: 3,
        name: 'Storm Nexus',
        damage: 35,
        range: 85,
        fireRate: 1.2,
        energyCost: 10,
        chainCount: 4
      }
    ]
  },
  
  nature: {
    name: 'Nature Path',
    icon: '🌿',
    damageType: 'poison',
    strongVs: ['organic', 'light'],
    weakVs: ['undead', 'mech'],
    tiers: [
      {
        tier: 1,
        name: 'Thorn Tower',
        damage: 8,
        range: 55,
        fireRate: 1.0,
        energyCost: 2,
        burnDamage: 3,   // poison as burn
        burnDuration: 90
      },
      {
        tier: 2,
        name: 'Treant Tower',
        damage: 15,
        range: 60,
        fireRate: 0.8,
        energyCost: 4,
        burnDamage: 5,
        burnDuration: 120
      },
      {
        tier: 3,
        name: 'World Tree',
        damage: 25,
        range: 70,
        fireRate: 0.6,
        energyCost: 7,
        splashRadius: 30,
        burnDamage: 8,
        burnDuration: 150
      }
    ]
  },
  
  dark: {
    name: 'Dark Path',
    icon: '💀',
    damageType: 'true',  // ignores armor
    strongVs: ['all'],
    weakVs: ['holy'],
    tiers: [
      {
        tier: 1,
        name: 'Shadow Tower',
        damage: 12,
        range: 60,
        fireRate: 0.9,
        energyCost: 4
      },
      {
        tier: 2,
        name: 'Vampire Spire',
        damage: 22,
        range: 65,
        fireRate: 0.8,
        energyCost: 6
      },
      {
        tier: 3,
        name: 'Void Obelisk',
        damage: 40,
        range: 75,
        fireRate: 0.6,
        energyCost: 10
      }
    ]
  }
};

module.exports = { TOWER_PATHS };
