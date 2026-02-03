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
  
  if (useMatchWinner) {
    // Match Winner
    const matchRe = /Match\s+Winner/i;
    t = markets.find(m => {
      const header = m.querySelector('.text-gray-light, .mr-auto');
      return header && matchRe.test(header.textContent);
    });
  } else {
    // Specific map
    const mapRe = new RegExp(`Map\\s*${mapNum}\\s+Winner`, 'i');
    t = markets.find(m => mapRe.test(m.textContent));
    // Fallback to match winner if map not found
    if (!t) {
      const matchRe = /Match\s+Winner/i;
      t = markets.find(m => {
        const header = m.querySelector('.text-gray-light, .mr-auto');
        return header && matchRe.test(header.textContent);
      });
    }
  }
  
  if (!t) return emptyResult();
  
  const odds = [...t.querySelectorAll('span.odds-button__odds')].map(e => e.textContent.trim()).slice(0, 2);
  return { odds: odds.length === 2 ? odds : ['-', '-'], frozen: false };
}

module.exports = { extractThunder };
