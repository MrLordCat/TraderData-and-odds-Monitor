/**
 * Power Towers TD - Energy Building Definitions
 * 
 * Configuration for all energy buildings - costs, stats, upgrades
 */

const ENERGY_BUILDINGS = {
  // ============================================
  // GENERATORS
  // ============================================
  'base-generator': {
    id: 'base-generator',
    name: 'Basic Generator',
    description: 'Stable power generation. Good starting point.',
    icon: '⚡',
    category: 'generator',
    
    cost: 50,
    buildTime: 0,
    
    stats: {
      generation: 5,
      outputRate: 15,
      capacity: 50,
      range: 4,
      inputChannels: 0,
      outputChannels: 1
    },
    
    upgrades: [
      { type: 'generation', cost: 30, description: '+20% generation' },
      { type: 'outputRate', cost: 25, description: '+20% output rate' },
      { type: 'capacity', cost: 35, description: '+25% storage' },
      { type: 'range', cost: 40, description: '+2 range' }
    ]
  },

  'bio-generator': {
    id: 'bio-generator',
    name: 'Bio Generator',
    description: 'Uses surrounding trees. Trees slowly regrow.',
    icon: '🌳',
    category: 'generator',
    gridWidth: 2,
    gridHeight: 2,
    shape: 'L',  // L-shaped building (3 cells in corner)
    
    cost: 80,
    buildTime: 0,
    
    stats: {
      baseGeneration: 8,
      outputRate: 20,
      capacity: 80,
      range: 4,
      treeRadius: 3,
      maxTrees: 12,
      inputChannels: 0,
      outputChannels: 1
    },
    
    upgrades: [
      { type: 'generation', cost: 50, description: '+20% base generation' },
      { type: 'treeRadius', cost: 60, description: '+1 tree detection radius' },
      { type: 'capacity', cost: 45, description: '+25% storage' },
      { type: 'range', cost: 40, description: '+2 range' }
    ]
  },

  'wind-generator': {
    id: 'wind-generator',
    name: 'Wind Turbine',
    description: 'Unstable output. Needs mountains (9 for 100%).',
    icon: '💨',
    category: 'generator',
    
    cost: 100,
    buildTime: 0,
    
    stats: {
      baseGeneration: 12,
      outputRate: 25,
      capacity: 60,
      range: 5,
      mountainRadius: 2,
      maxMountains: 9,
      instability: 0.3,
      inputChannels: 0,
      outputChannels: 1
    },
    
    upgrades: [
      { type: 'generation', cost: 60, description: '+20% base generation' },
      { type: 'stability', cost: 80, description: '-10% instability' },
      { type: 'capacity', cost: 50, description: '+25% storage' },
      { type: 'range', cost: 45, description: '+2 range' }
    ]
  },

  'solar-generator': {
    id: 'solar-generator',
    name: 'Solar Panel',
    description: 'Efficiency varies by biome. Best in desert.',
    icon: '☀️',
    category: 'generator',
    
    cost: 90,
    buildTime: 0,
    
    stats: {
      baseGeneration: 10,
      outputRate: 18,
      capacity: 70,
      range: 4,
      inputChannels: 0,
      outputChannels: 1
    },
    
    biomeEfficiency: {
      'desert': 1.5,
      'plains': 1.2,
      'grass': 1.0,
      'forest': 0.6,
      'swamp': 0.4,
      'snow': 0.8
    },
    
    upgrades: [
      { type: 'generation', cost: 55, description: '+20% base generation' },
      { type: 'efficiency', cost: 70, description: '+10% all biome efficiency' },
      { type: 'capacity', cost: 45, description: '+25% storage' },
      { type: 'range', cost: 40, description: '+2 range' }
    ]
  },

  'water-generator': {
    id: 'water-generator',
    name: 'Hydro Generator',
    description: 'Needs water tiles (9 for 100%). Stable output.',
    icon: '💧',
    category: 'generator',
    
    cost: 95,
    buildTime: 0,
    
    stats: {
      baseGeneration: 10,
      outputRate: 22,
      capacity: 65,
      range: 4,
      waterRadius: 2,
      maxWaterTiles: 9,
      inputChannels: 0,
      outputChannels: 1
    },
    
    upgrades: [
      { type: 'generation', cost: 55, description: '+20% base generation' },
      { type: 'waterRadius', cost: 65, description: '+1 water detection radius' },
      { type: 'capacity', cost: 45, description: '+25% storage' },
      { type: 'range', cost: 40, description: '+2 range' }
    ]
  },

  // ============================================
  // STORAGE
  // ============================================
  'battery': {
    id: 'battery',
    name: 'Battery',
    description: 'Stores energy. Stacking increases capacity.',
    icon: '🔋',
    category: 'storage',
    gridWidth: 2,
    gridHeight: 2,
    
    cost: 60,
    buildTime: 0,
    
    stats: {
      capacity: 200,
      inputRate: 20,
      outputRate: 20,
      range: 3,
      decayRate: 0.5, // % per minute
      stackBonus: 0.15, // 15% per adjacent battery
      inputChannels: 1,
      outputChannels: 1
    },
    
    upgrades: [
      { type: 'capacity', cost: 40, description: '+25% capacity' },
      { type: 'inputRate', cost: 35, description: '+20% input rate' },
      { type: 'outputRate', cost: 35, description: '+20% output rate' },
      { type: 'decay', cost: 50, description: '-20% decay rate' },
      { type: 'range', cost: 30, description: '+2 range' }
    ]
  },

  // ============================================
  // TRANSFER
  // ============================================
  'power-transfer': {
    id: 'power-transfer',
    name: 'Power Relay',
    description: 'Multiple channels (2/2). Long range relay.',
    icon: '🔌',
    category: 'transfer',
    
    cost: 75,
    buildTime: 0,
    
    stats: {
      capacity: 50,
      inputRate: 30,
      outputRate: 30,
      range: 6,
      efficiency: 0.95, // 5% loss
      inputChannels: 2,
      outputChannels: 2
    },
    
    upgrades: [
      { type: 'channels', cost: 60, description: '+1 input/output channel' },
      { type: 'efficiency', cost: 70, description: '+2% efficiency' },
      { type: 'inputRate', cost: 40, description: '+20% input rate' },
      { type: 'outputRate', cost: 40, description: '+20% output rate' },
      { type: 'range', cost: 50, description: '+2 range' }
    ]
  }
};

// Build costs by level (multiplier)
const UPGRADE_COST_MULTIPLIER = [1, 1.5, 2.2, 3, 4];

// Category colors for UI
const CATEGORY_COLORS = {
  generator: '#4CAF50',  // Green
  storage: '#2196F3',    // Blue
  transfer: '#FF9800'    // Orange
};

// Icons by building type
const BUILDING_ICONS = {
  'base-generator': '⚡',
  'bio-generator': '🌳',
  'wind-generator': '💨',
  'solar-generator': '☀️',
  'water-generator': '💧',
  'battery': '🔋',
  'power-transfer': '🔌'
};

module.exports = {
  ENERGY_BUILDINGS,
  UPGRADE_COST_MULTIPLIER,
  CATEGORY_COLORS,
  BUILDING_ICONS
};
