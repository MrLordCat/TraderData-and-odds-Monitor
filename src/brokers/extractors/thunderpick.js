// Thunderpick extractor
// Uses data-testid attributes

const { emptyResult } = require('./base');

/**
 * Extract odds from Thunderpick
 * @param {number} mapNum - 0 for match winner, 1-5 for specific map
 * @param {string} game - Game type (ignored for now)
 * @param {object} opts - Additional options (isLast for Bo1)
 * @returns {{odds: [string, string], frozen: boolean}}
 */
function extractThunder(mapNum = 1, game = 'lol', opts = {}) {
  const markets = [...document.querySelectorAll("div[data-testid^='market-']")];
  let t = null;
  
  // Bo1 handling: if mapNum === 1 && isLast, use match winner
  const useMatchWinner = mapNum <= 0 || (mapNum === 1 && opts.isLast);
  
  // Helper: find header element inside market block
  const getHeader = (m) => m.querySelector('.text-gray-light, .mr-auto');
  
  if (useMatchWinner) {
    // Match Winner
    const matchRe = /Match\s+Winner/i;
    t = markets.find(m => {
      const h = getHeader(m);
      return h && matchRe.test(h.textContent);
    });
  } else {
    // Specific map/game — handle: "Map 1 Winner", "Map 1 - Winner", "Game 1 - Winner", "Round 1 - Winner"
    const mapRe = new RegExp(`(?:Map|Game|Round)\\s*${mapNum}\\s*[-–—]?\\s*Winner`, 'i');
    t = markets.find(m => {
      const h = getHeader(m);
      return h && mapRe.test(h.textContent);
    });
    // Fallback to match winner if map-specific not found
    if (!t) {
      const matchRe = /Match\s+Winner/i;
      t = markets.find(m => {
        const h = getHeader(m);
        return h && matchRe.test(h.textContent);
      });
    }
  }
  
  if (!t) return emptyResult();
  
  const odds = [...t.querySelectorAll('span.odds-button__odds')].map(e => e.textContent.trim()).slice(0, 2);
  return { odds: odds.length === 2 ? odds : ['-', '-'], frozen: false };
}

module.exports = { extractThunder };
