// GG.bet extractor
// Uses data-test attributes for market identification

const { emptyResult } = require('./base');

/**
 * Extract odds from GG.bet
 * @param {number} mapNum - 0 for match winner, 1-5 for specific map
 * @param {string} game - Game type (ignored for now)
 * @param {object} opts - Additional options
 * @returns {{odds: [string, string], frozen: boolean}}
 */
function extractGg(mapNum = 1, game = 'lol', opts = {}) {
  // STRICT policy for map markets (>=1): if specific "Map N - Winner" is missing, DO NOT fallback
  let blocks = [...document.querySelectorAll('div.bg-surface-middle.mb-2')];
  if (!blocks.length) blocks = [...document.querySelectorAll('div.mb-2.w-full.bg-surface-middle')];
  if (!blocks.length) blocks = [...document.querySelectorAll("div[class*='bg-surface-middle']")].filter(d => d.querySelector('[data-test="market-name"]'));
  if (!blocks.length) return emptyResult();
  
  let target = null;
  
  if (mapNum <= 0) {
    // Match-level winner (permissive)
    target = blocks.find(b => /\bWinner\b/i.test(b.querySelector('[data-test="market-name"]')?.textContent || ''));
  } else {
    const nameOf = (b) => (b.querySelector('[data-test="market-name"]')?.textContent || '').trim();
    const reStrict = new RegExp('^' + 'Map\\s*' + mapNum + '\\s*-?\\s*Winner' + '(?:\\s*\\(incl\\.?\\s*overtime\\))?' + '$', 'i');
    target = blocks.find(b => reStrict.test(nameOf(b)));
    // No fallback to generic "Winner" if strict market not present
  }
  
  if (!target) return emptyResult();
  
  const resultEls = Array.from(target.querySelectorAll('div[data-test="odd-button__result"]')).slice(0, 2);
  const odds = resultEls.map(el => (el.textContent || '').trim().replace(',', '.'));
  
  // Basic frozen detection
  const frozen = (resultEls.length === 2) && resultEls.every(el => {
    const btn = el.closest('[data-test*="odd-button"]') || el.closest('div');
    if (!btn) return false;
    const cls = (btn.className || '');
    if (/cursor-not-allowed/.test(cls)) return true;
    try {
      const cs = getComputedStyle(btn);
      if (cs.pointerEvents === 'none' || parseFloat(cs.opacity || '1') < 0.5) return true;
    } catch (_) { }
    return false;
  });
  
  return { odds: odds.length === 2 ? odds : ['-', '-'], frozen };
}

module.exports = { extractGg };
