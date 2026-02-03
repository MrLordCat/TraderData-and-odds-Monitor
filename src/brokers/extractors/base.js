// Base extractor utilities and class
// Shared across all broker-specific extractors

/**
 * Deep query selector that traverses shadow DOM
 * @param {string} selector - CSS selector
 * @param {Document|Element} root - Root element to search from
 * @returns {Element[]}
 */
function deepQuery(selector, root = document) {
  const res = [];
  function walk(r) {
    try { r.querySelectorAll(selector).forEach(e => res.push(e)); } catch (_) { }
    try { r.querySelectorAll('*').forEach(n => { if (n.shadowRoot) walk(n.shadowRoot); }); } catch (_) { }
  }
  walk(root);
  return res;
}

/**
 * Normalize game name to standard format
 * @param {string} v - Game name (lol, cs, cs2, dota, dota2)
 * @returns {string}
 */
function normalizeGame(v) {
  try {
    const s = String(v || 'lol').toLowerCase();
    if (['lol', 'cs', 'cs2', 'dota', 'dota2'].includes(s)) {
      return (s === 'cs' ? 'cs2' : s === 'dota' ? 'dota2' : s);
    }
  } catch (_) { }
  return 'lol';
}

/**
 * Get game-specific tokens for selectors
 * @param {string} game - Normalized game name
 * @returns {object} - Tokens for text matching
 */
function gameTokens(game) {
  const g = normalizeGame(game);
  const base = { mapWordEN: 'Map', matchWinnerEN: 'Match Winner' };
  // Can be extended per-game later
  if (g === 'lol') return base;
  if (g === 'cs2') return base;
  if (g === 'dota2') return base;
  return base;
}

/**
 * Standard extractor result
 * @typedef {Object} ExtractorResult
 * @property {[string, string]} odds - Odds for side 1 and side 2
 * @property {boolean} frozen - Whether the market is suspended
 */

/**
 * Create a standard empty/failed result
 * @returns {ExtractorResult}
 */
function emptyResult() {
  return { odds: ['-', '-'], frozen: false };
}

/**
 * Parse a price string to normalized format
 * @param {string} raw - Raw price text
 * @returns {string}
 */
function parsePrice(raw) {
  if (!raw || raw === '-') return '-';
  return String(raw).trim().replace(',', '.');
}

/**
 * Check if a value is a valid numeric odds
 * @param {string} v - Value to check
 * @returns {boolean}
 */
function isValidOdds(v) {
  return v && v !== '-' && /^\d+(?:[.,]\d+)?$/.test(String(v).trim());
}

/**
 * Post-process odds array - replace single '-' with '1' if other side valid
 * @param {[string, string]} odds
 * @returns {[string, string]}
 */
function postProcessOdds(odds) {
  if (!Array.isArray(odds) || odds.length !== 2) return ['-', '-'];
  const o0valid = isValidOdds(odds[0]);
  const o1valid = isValidOdds(odds[1]);
  if (o0valid && !o1valid) return [odds[0], '1'];
  if (!o0valid && o1valid) return ['1', odds[1]];
  return odds;
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 * @param {number} n
 * @returns {string}
 */
function ordinalSuffix(n) {
  const v = parseInt(n, 10) || 1;
  const j = v % 10, k = v % 100;
  if (j === 1 && k !== 11) return v + 'st';
  if (j === 2 && k !== 12) return v + 'nd';
  if (j === 3 && k !== 13) return v + 'rd';
  return v + 'th';
}

/**
 * Ordinal words array
 */
const ORDINAL_WORDS = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];

/**
 * Base extractor class (optional - extractors can also be plain functions)
 */
class BaseExtractor {
  constructor(brokerId) {
    this.brokerId = brokerId;
  }

  /**
   * Extract odds for a specific map
   * @param {number} mapNum - Map number (0 = match winner, 1-5 = specific map)
   * @param {string} game - Game type
   * @param {object} opts - Additional options (e.g. isLast for Bo1)
   * @returns {ExtractorResult}
   */
  extract(mapNum = 1, game = 'lol', opts = {}) {
    return emptyResult();
  }

  /**
   * Check if element appears active (not suspended/disabled)
   * @param {Element} el
   * @returns {boolean}
   */
  isElementActive(el) {
    if (!el) return false;
    try {
      if (el.matches('[disabled],[aria-disabled="true"],[data-disabled="true"]')) return false;
      const cs = getComputedStyle(el);
      if (cs.pointerEvents === 'none') return false;
      const op = parseFloat(cs.opacity || '1');
      if (!isNaN(op) && op < 0.35) return false;
      return true;
    } catch (_) { return false; }
  }

  /**
   * Check for suspension text cues
   * @param {Element} container
   * @returns {boolean}
   */
  hasSuspensionCues(container) {
    if (!container) return false;
    try {
      const txt = (container.textContent || '').toLowerCase();
      return /suspend|suspens|closed|settled|unavailable/.test(txt);
    } catch (_) { return false; }
  }
}

module.exports = {
  deepQuery,
  normalizeGame,
  gameTokens,
  emptyResult,
  parsePrice,
  isValidOdds,
  postProcessOdds,
  ordinalSuffix,
  ORDINAL_WORDS,
  BaseExtractor
};
