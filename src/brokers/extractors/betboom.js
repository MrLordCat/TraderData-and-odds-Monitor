// Betboom extractor
// Russian-language bookmaker (Cyrillic text markers)

const { emptyResult } = require('./base');

/**
 * Extract odds from Betboom
 * NOTE: Russian words ("Карта", "Исход", "Исход матча", "П") intentionally retained.
 * They match the bookmaker's live DOM and must NOT be translated.
 * 
 * @param {number} mapNum - 0 for match winner, 1-5 for specific map
 * @param {string} game - Game type (ignored for now)
 * @param {object} opts - Additional options (isLast for Bo1)
 * @returns {{odds: [string, string], frozen: boolean}}
 */
function extractBetboom(mapNum = 1, game = 'lol', opts = {}) {
  const sections = [...document.querySelectorAll('section')];
  let target = null;
  
  // Bo1 handling: if mapNum === 1 && isLast, use match-level market
  const useMatchLevel = mapNum <= 0 || (mapNum === 1 && opts.isLast);
  
  if (useMatchLevel) {
    // Explicit match-level (do NOT coerce to map1)
    target = sections.find(s => /Исход\s+матча/i.test(s.textContent));
  } else {
    const num = parseInt(mapNum, 10) || 1;
    
    // Verify the correct map tab is actually selected before extracting
    const tabs = [...document.querySelectorAll('button[role="radio"]')];
    const expectedTab = tabs.find(b => b.textContent.trim() === 'Карта ' + num);
    if (expectedTab) {
      // Check if this tab is active (aria-checked or data-state attribute)
      const isActive = expectedTab.getAttribute('aria-checked') === 'true'
        || expectedTab.getAttribute('data-state') === 'checked'
        || expectedTab.classList.contains('active')
        || expectedTab.hasAttribute('data-checked');
      if (!isActive) {
        // Correct tab exists but is not selected yet — don't extract stale odds
        return emptyResult();
      }
    }
    
    const mapRe = new RegExp(`Карта\\s*${num}`, 'i');
    target = sections.find(s => /Исход/i.test(s.textContent) && mapRe.test(s.textContent));
    // No fallback to match-level: if specific map not found, return empty
    // This prevents leaking match-level odds after page reload
  }
  
  if (!target) return emptyResult();
  
  const buttons = [...target.querySelectorAll('button')]
    .filter(btn => /^П\d+$/.test(btn.querySelector('div:first-child')?.textContent.trim()))
    .slice(0, 2);
  
  const odds = buttons.map(btn => {
    if (btn.disabled || btn.querySelector('use[xlink\\:href="#lock-outline"]')) return '-';
    const val = btn.querySelector('div:nth-child(2)');
    return val ? val.textContent.trim().replace(',', '.') : '-';
  });
  
  return { odds: odds.length === 2 ? odds : ['-', '-'], frozen: false };
}

module.exports = { extractBetboom };
