/**
 * Power Towers TD - Map Generator Configuration
 */

const GENERATOR_CONFIG = {
  // Path generation
  PATH_WIDTH: 3,                  // Path width in cells (3 = enemy walks in center)
  PATH_MARGIN: 8,                 // Minimum distance from map edges
  PATH_CLEARANCE: 2,              // Minimum cells between path segments (for tower placement)
  
  // Path complexity  
  PATH_SEGMENTS_MIN: 5,           // Minimum path segments
  PATH_SEGMENTS_MAX: 9,           // Maximum path segments
  PATH_SEGMENT_LENGTH_MIN: 12,    // Minimum segment length in cells
  PATH_SEGMENT_LENGTH_MAX: 35,    // Maximum segment length in cells
  
  // Spawn edge weights (which edge to spawn from)
  SPAWN_EDGE_WEIGHTS: {
    left: 30,
    right: 30,
    top: 20,
    bottom: 20
  },
  
  // Terrain distribution thresholds (based on noise value 0-1)
  TERRAIN_THRESHOLDS: {
    water: 0.25,      // 0.00 - 0.25 = water
    forest: 0.45,     // 0.25 - 0.45 = forest
    grass: 0.75,      // 0.45 - 0.75 = grass
    hill: 1.0         // 0.75 - 1.00 = hill
  },
  
  // Special elements
  ENERGY_NODES: {
    count: { min: 3, max: 6 },
    minDistFromPath: 2,
    maxDistFromPath: 8
  },
  RESOURCE_VEINS: {
    count: { min: 2, max: 5 },
    minDistFromPath: 1,
    maxDistFromPath: 6
  },
  
  // Spawn/Base margins (cells from edge)
  SPAWN_MARGIN: 2,
  BASE_MARGIN: 2
};

module.exports = { GENERATOR_CONFIG };
