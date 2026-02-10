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
  const s = String(v || 'lol').toLowerCase();
  if (['lol', 'cs', 'cs2', 'dota', 'dota2'].includes(s)) {
    return (s === 'cs' ? 'cs2' : s === 'dota' ? 'dota2' : s);
  }
  return 'lol';
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


module.exports = {
  deepQuery,
  normalizeGame,
  emptyResult,
  parsePrice,
  isValidOdds,
  postProcessOdds,
  ordinalSuffix,
  ORDINAL_WORDS
};
