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
  
  // Helper: extract clean section title — prefer .bb-ym (most specific), fallback to full trigger text
  const sectionTitle = s => {
    // .bb-ym is the dedicated title element inside the trigger (avoids SVG whitespace noise)
    const ym = s.querySelector('.bb-ym');
    if (ym) return ym.textContent.replace(/\s+/g, ' ').trim();
    const el = s.querySelector('[data-id="trigger"]');
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  };
  
  // Bo1 handling: if mapNum === 1 && isLast, use match-level market
  const useMatchLevel = mapNum <= 0 || (mapNum === 1 && opts.isLast);
  // Check if real map tabs exist (e.g. "Матч", "Карта 1") vs filter radios ("Все", "Исход", "Тотал")
  const radios = [...document.querySelectorAll('button[role="radio"]')];
  const hasTabs = radios.some(b => /^(Матч|Карта\s*\d+)$/i.test(b.textContent.trim()));
  
  if (useMatchLevel) {
    // Try 1: "Исход матча" (tabbed mode with explicit header)
    target = sections.find(s => /Исход\s+матча/i.test(s.textContent));
    // Try 2: section with .bb-zm "Матч" sibling to .bb-ym "Исход" (no-tabs / Bo2 mode)
    if (!target) {
      target = sections.find(s => {
        const zm = s.querySelector('.bb-zm');
        return zm && /Матч/i.test(zm.textContent) && /^Исход$/i.test(sectionTitle(s));
      });
    }
    // Try 3: section titled exactly "Исход" (pure 3-way, no "Матч" badge — last resort)
    if (!target) {
      target = sections.find(s => /^Исход$/i.test(sectionTitle(s)));
    }
  } else {
    const num = parseInt(mapNum, 10) || 1;
    
    if (hasTabs) {
      // Normal tabbed mode: verify the correct map tab is actually selected
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
    } else {
      // No-tabs mode (Bo2 / compact): find by section title "N-я карта: Исход"
      const titleRe = new RegExp(`^${num}-я\\s+карта\\s*:\\s*Исход$`, 'i');
      target = sections.find(s => titleRe.test(sectionTitle(s)));
    }
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
