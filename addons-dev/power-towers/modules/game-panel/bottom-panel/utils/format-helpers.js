/**
 * Power Towers TD - Format Helpers
 * Utility functions for formatting values
 */

/**
 * Format integer with optional suffix
 * @param {number} value - Value to format
 * @returns {string} Formatted string
 */
function formatInt(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return Math.floor(value).toString();
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
 * Format percentage
 * @param {number} value - Value (0-1 or 0-100)
 * @param {boolean} [isDecimal=true] - Whether value is decimal (0-1)
 * @returns {string} Formatted percentage
 */
function formatPercent(value, isDecimal = true) {
  const pct = isDecimal ? value * 100 : value;
  return `${Math.round(pct)}%`;
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
  formatInt, 
  formatFloat, 
  formatPercent, 
  formatDuration, 
  formatGold 
};
