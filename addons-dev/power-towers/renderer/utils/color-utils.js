/**
 * Power Towers TD - Color Utilities
 * 
 * Color constants and parsing functions for the renderer.
 */

// Biome colors (RGB 0-1)
const BIOME_COLORS = {
  plains: { r: 0.35, g: 0.55, b: 0.35 },
  forest: { r: 0.18, g: 0.38, b: 0.18 },
  desert: { r: 0.85, g: 0.75, b: 0.5 },
  water: { r: 0.22, g: 0.42, b: 0.62 },
  mountains: { r: 0.45, g: 0.42, b: 0.42 },
  burned: { r: 0.18, g: 0.12, b: 0.12 },
};

// Biome color variants for visual variety
const BIOME_VARIANTS = {
  plains: [
    { r: 0.38, g: 0.58, b: 0.38 },
    { r: 0.32, g: 0.52, b: 0.32 },
    { r: 0.36, g: 0.54, b: 0.34 },
    { r: 0.34, g: 0.56, b: 0.36 },
  ],
  forest: [
    { r: 0.16, g: 0.35, b: 0.16 },
    { r: 0.2, g: 0.4, b: 0.2 },
    { r: 0.17, g: 0.36, b: 0.17 },
    { r: 0.19, g: 0.39, b: 0.19 },
  ],
  desert: [
    { r: 0.88, g: 0.78, b: 0.53 },
    { r: 0.82, g: 0.72, b: 0.47 },
    { r: 0.85, g: 0.74, b: 0.48 },
    { r: 0.87, g: 0.76, b: 0.52 },
  ],
  water: [
    { r: 0.2, g: 0.4, b: 0.6 },
    { r: 0.24, g: 0.44, b: 0.64 },
    { r: 0.21, g: 0.41, b: 0.61 },
  ],
  mountains: [
    { r: 0.43, g: 0.4, b: 0.4 },
    { r: 0.47, g: 0.44, b: 0.44 },
    { r: 0.44, g: 0.41, b: 0.41 },
  ],
  burned: [
    { r: 0.16, g: 0.1, b: 0.1 },
    { r: 0.2, g: 0.14, b: 0.14 },
    { r: 0.17, g: 0.11, b: 0.11 },
  ],
};

/**
 * Parse color string to RGB object (0-1 range)
 * Supports: #hex, #hhh, rgba(), rgb()
 */
function parseColor(color) {
  if (!color) return { r: 1, g: 1, b: 1, a: 1 };
  
  // Handle hex
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16) / 255,
        g: parseInt(hex[1] + hex[1], 16) / 255,
        b: parseInt(hex[2] + hex[2], 16) / 255,
        a: 1,
      };
    }
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }
  
  // Handle rgba()
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1]) / 255,
      g: parseInt(match[2]) / 255,
      b: parseInt(match[3]) / 255,
      a: match[4] ? parseFloat(match[4]) : 1,
    };
  }
  
  return { r: 1, g: 1, b: 1, a: 1 };
}

module.exports = {
  BIOME_COLORS,
  BIOME_VARIANTS,
  parseColor,
};
