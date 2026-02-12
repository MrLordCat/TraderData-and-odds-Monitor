// Broker extractors registry and router
// Main entry point for odds extraction

const { normalizeGame, postProcessOdds } = require('./base');
const { extractRivalry } = require('./rivalry');
const { extractGg } = require('./gg');
const { extractThunder } = require('./thunderpick');
const { extractBetboom } = require('./betboom');
const { extractPari } = require('./pari');
const { extractMarathon } = require('./marathon');
const { extractBet365 } = require('./bet365');
const { extractSimulator } = require('./simulator');

/**
 * Get broker ID from hostname
 * @param {string} host - Full URL or hostname
 * @returns {string}
 */
function getBrokerId(host) {
  // File-based simulators: check before URL stripping (file:// has no host)
  if (/simulator\.html/i.test(host)) return 'simulator';
  try {
    host = (host || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  } catch (_) { }
  
  if (/rivalry/i.test(host)) return 'rivalry';
  if (/gg199|gg\.bet/i.test(host)) return 'gg';
  if (/thunderpick/i.test(host)) return 'thunder';
  if (/betboom/i.test(host)) return 'betboom';
  if (/pari\.ru/i.test(host)) return 'pari';
  if (/marathonbet\./i.test(host)) return 'marathon';
  if (/bet365\./i.test(host)) return 'bet365';
  
  return host.split('.')[0] || 'generic';
}

/**
 * Extractor registry
 * Each entry: { test: RegExp, fn: Function, passOpts?: boolean }
 * passOpts: true means extractor accepts (mapNum, game, opts) signature
 */
const EXTRACTOR_TABLE = [
  { test: /rivalry\.com$/i, fn: extractRivalry },
  { test: /gg199\.bet$/i, fn: extractGg },
  { test: /gg\.bet$/i, fn: extractGg },
  { test: /thunderpick\.io$/i, fn: extractThunder, passOpts: true },
  { test: /betboom\.ru$/i, fn: extractBetboom, passOpts: true },
  { test: /pari\.ru$/i, fn: extractPari, passOpts: true },
  { test: /marathonbet\./i, fn: extractMarathon },
  { test: /bet365\./i, fn: extractBet365 },
  { test: /simulator\.html/i, fn: extractSimulator }
];

/**
 * Collect odds from the current page
 * @param {string} host - URL or hostname of the broker
 * @param {number} desiredMap - Map number (0 = match, 1-5 = specific map)
 * @param {string} game - Game type (lol, cs2, dota2)
 * @param {object} opts - Additional options (e.g., isLast for Bo1)
 * @returns {{broker: string, odds: [string, string], frozen: boolean, ts: number, map: number}}
 */
function collectOdds(host, desiredMap, game, opts = {}) {
  const g = normalizeGame(game);
  let meta = { odds: ['-', '-'], frozen: false };
  
  for (const row of EXTRACTOR_TABLE) {
    if (row.test.test(host)) {
      if (row.passOpts) {
        meta = row.fn(desiredMap, g, opts) || meta;
      } else {
        meta = row.fn(desiredMap, g) || meta;
      }
      break;
    }
  }
  
  // Post-process odds
  const odds = postProcessOdds(meta.odds);
  
  return {
    broker: getBrokerId(host),
    odds,
    frozen: meta.frozen,
    ts: Date.now(),
    map: desiredMap
  };
}

// Re-export utilities for advanced usage
const { deepQuery } = require('./base');

module.exports = {
  getBrokerId,
  collectOdds,
  deepQuery,
  // Individual extractors (for testing/debugging)
  extractRivalry,
  extractGg,
  extractThunder,
  extractBetboom,
  extractPari,
  extractMarathon,
  extractBet365,
  extractSimulator,
  // Registry (for dynamic extension)
  EXTRACTOR_TABLE
};
