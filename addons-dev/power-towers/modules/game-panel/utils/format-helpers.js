/**
 * Power Towers TD - Format Helpers
 * Unified formatting utilities for UI display
 */

/**
 * Format number as percentage with sign
 * @param {number} value - Multiplier value (1.0 = 100%)
 * @param {boolean} showSign - Whether to show +/- sign
 * @returns {string} Formatted percentage string
 */
function formatPercent(value, showSign = true) {
  const pct = Math.round((value - 1) * 100);
  if (showSign) {
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  }
  return `${pct}%`;
}

/**
 * Format percentage from raw value (0.05 -> "5%")
 * @param {number} value - Raw percentage (0.0-1.0)
 * @returns {string} Formatted percentage
 */
function formatRawPercent(value) {
  return `${Math.round(value * 100)}%`;
}

/**
 * Format number with decimals
 * @param {number} value - Number to format
 * @param {number} decimals - Decimal places (default 1)
 * @returns {string} Formatted number
 */
function formatNumber(value, decimals = 1) {
  return value.toFixed(decimals);
}

/**
 * Format integer (floor)
 * @param {number} value - Number to format
 * @returns {string} Formatted integer
 */
function formatInt(value) {
  return String(Math.floor(value));
}

/**
 * Format value based on stat type
 * @param {number} value - Value to format
 * @param {string} statType - Type of stat
 * @returns {string} Formatted value
 */
function formatStatValue(value, statType) {
  // Percent-based stats
  if (statType.includes('Percent') || statType.includes('Chance') || 
      statType.includes('Reduction') || statType.includes('Amplify') || 
      statType.includes('Falloff')) {
    return formatRawPercent(value);
  }
  
  // Duration stats
  if (statType.includes('Duration') || statType.includes('duration')) {
    return `${value.toFixed(1)}s`;
  }
  
  // Integer stats (stacks, targets, etc.)
  if (statType.includes('Stacks') || statType.includes('Targets') || 
      statType.includes('targets') || statType.includes('Count')) {
    return String(Math.round(value));
  }
  
  // Rate stats
  if (statType.includes('Rate') || statType.includes('rate') || 
      statType.includes('generation') || statType.includes('Generation')) {
    return `${value.toFixed(1)}/s`;
  }
  
  // Default numeric
  return value.toFixed(1);
}

/**
 * Format gold cost
 * @param {number} cost - Gold amount
 * @returns {string} Formatted cost
 */
function formatGold(cost) {
  return `${cost}g`;
}

/**
 * Format level display
 * @param {number} level - Level number
 * @returns {string} Formatted level
 */
function formatLevel(level) {
  return `Lvl ${level}`;
}

/**
 * Format level bonus as percentage
 * @param {number} level - Current level
 * @param {number} bonusPerLevel - Bonus per level (default 0.01 = 1%)
 * @returns {{ bonus: number, text: string }} Bonus multiplier and formatted text
 */
function formatLevelBonus(level, bonusPerLevel = 0.01) {
  const bonus = 1 + (level - 1) * bonusPerLevel;
  const percent = Math.round((bonus - 1) * 100);
  return {
    bonus,
    text: `+${percent}%`
  };
}

/**
 * Format upgrade level indicator
 * @param {number} current - Current level
 * @param {number} max - Max level (optional)
 * @returns {string} Formatted level
 */
function formatUpgradeLevel(current, max = null) {
  if (max !== null) {
    return `${current}/${max}`;
  }
  return `Lv.${current}`;
}

/**
 * Capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format energy amount
 * @param {number} current - Current energy
 * @param {number} max - Max energy
 * @returns {string} Formatted energy
 */
function formatEnergy(current, max) {
  return `${Math.floor(current)}/${Math.floor(max)}`;
}

module.exports = {
  formatPercent,
  formatRawPercent,
  formatNumber,
  formatInt,
  formatStatValue,
  formatGold,
  formatLevel,
  formatLevelBonus,
  formatUpgradeLevel,
  capitalize,
  formatEnergy
};
