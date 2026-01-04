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
 * Format float to fixed decimal places
 * @param {number} value - Value to format
 * @param {number} [decimals=1] - Decimal places
 * @returns {string} Formatted string
 */
function formatFloat(value, decimals = 1) {
  return value.toFixed(decimals);
}

/**
 * Format time duration
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  }
  return `${seconds.toFixed(1)}s`;
}

/**
 * Format gold amount with 'g' suffix
 * @param {number} amount - Gold amount
 * @returns {string} Formatted gold
 */
function formatGold(amount) {
  return `${formatInt(amount)}g`;
}

module.exports = { 
  formatPercent,
  formatRawPercent,
  formatNumber,
  formatInt, 
  formatFloat, 
  formatDuration, 
  formatGold 
};
