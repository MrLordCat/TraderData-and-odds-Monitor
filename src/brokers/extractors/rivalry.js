// Rivalry extractor
// Complex extraction with classless design (data-editor-id selectors)

const { deepQuery, emptyResult } = require('./base');

/**
 * Check if a plate element is active (not suspended)
 * @param {Element} plate
 * @returns {boolean}
 */
function isActivePlate(plate) {
  try {
    // Lock / disabled attributes
    if (plate.matches('[disabled],[aria-disabled="true"],[data-disabled="true"]')) return false;
    if (plate.querySelector('[data-editor-id="LockIcon"],svg[data-editor-id*="Lock" i]')) return false;
    
    const spans = [...plate.querySelectorAll('span')];
    const numeric = spans.map(s => s.textContent.trim()).filter(t => /^\d+(?:[.,]\d+)?$/.test(t));
    if (!numeric.length) return false; // no price visible
    
    const lastSpan = spans.find(s => s.textContent && s.textContent.trim() === numeric[numeric.length - 1]) || spans[spans.length - 1];
    const cs = lastSpan ? getComputedStyle(lastSpan) : null;
    if (!cs) return false;
    if (cs.pointerEvents === 'none') return false;
    
    const op = parseFloat(cs.opacity || '1');
    if (!isNaN(op) && op < 0.35) return false;
    
    const color = cs.color || '';
    // crude grey detection (#777-#aaa or rgb with similar channels) – indicates disabled style sometimes
    if (/#7[0-9a-f]{1}|#8[0-9a-f]{1}|#9[0-9a-f]{1}|#aaa/i.test(color)) {
      if (op < 0.9) return false;
    }
    if (/^rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/i.test(color)) {
      const m = color.match(/(\d+)/g) || [];
      if (m.length >= 3) {
        const [r, g, b] = m.slice(0, 3).map(Number);
        const delta = Math.max(r, g, b) - Math.min(r, g, b);
        if (delta < 8 && r < 150) {
          if (op < 0.9) return false;
        }
      }
    }
    return true;
  } catch (_) { return false; }
}

/**
 * Extract price from a plate element
 * @param {Element} plate
 * @returns {string}
 */
function extractPrice(plate) {
  const spans = [...plate.querySelectorAll('span')];
  const numeric = spans.map(s => s.textContent.trim()).filter(t => /^\d+(?:[.,]\d+)?$/.test(t));
  const raw = numeric[numeric.length - 1] || (spans.length ? spans[spans.length - 1].textContent.trim() : '-');
  return raw.replace(',', '.');
}

/**
 * Normalize text (trim, collapse whitespace, lowercase)
 * @param {string} s
 * @returns {string}
 */
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Extract odds from Rivalry
 * @param {number} mapNum - 0 for match winner, 1-5 for specific map
 * @param {string} game - Game type (ignored for now)
 * @param {object} opts - Additional options
 * @returns {{odds: [string, string], frozen: boolean}}
 */
function extractRivalry(mapNum = 0, game = 'lol', opts = {}) {
  try {
    const debug = !!window.__RIVALRY_DEBUG;
    const wrappers = deepQuery('[data-editor-id="tableMarketWrapper"]');
    if (!wrappers.length) return emptyResult();
    
    const ORD = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
    let target = null;
    
    if (mapNum === 0) {
      // Match overall market. Rivalry sometimes labels it just "Winner"; map markets include a preceding map ordinal.
      for (const w of wrappers) {
        try {
          const lines = (w.textContent || '').split('\n').map(l => norm(l)).filter(l => l.length).slice(0, 6);
          if (!lines.length) continue;
          const header = lines[0];
          if (/winner/.test(header) && !/map\s*\d/.test(header)) { target = w; break; }
          if (!target && lines.some(l => l === 'winner')) { target = w; break; }
        } catch (_) { }
      }
      // Last resort: pick first wrapper having exactly two outcome plates and a plain 'Winner' token
      if (!target) {
        for (const w of wrappers) {
          const hasWinner = /\bWinner\b/i.test(w.textContent || '');
          const plates = [...w.querySelectorAll('[data-editor-id="tableOutcomePlate"]')].slice(0, 3);
          if (hasWinner && plates.length >= 2 && !/Map\s*\d/i.test(w.textContent || '')) { target = w; break; }
        }
      }
    } else {
      const idx = mapNum - 1;
      if (idx < 0 || idx >= ORD.length) return emptyResult();
      
      const ordWord = ORD[idx].toLowerCase(); // 'first', 'second', etc.
      const num = idx + 1;
      // Regex to detect map indicator in header (e.g. "First map", "Map 1", "1st map")
      const mapHeaderRe = new RegExp('(' + ordWord + '\\s+map|map\\s*' + num + '(?:st|nd|rd|th)?|' + num + '(?:st|nd|rd|th)?\\s+map)', 'i');
      const badRe = /both\s+teams|first\s+(?:blood|tower|dragon)|to\s+slay|baron|dragon/i;
      
      // Strategy 1: Old format — single line has both map phrase + "winner"
      const mapPhraseRe = new RegExp('^(' +
        ordWord.replace(/([.*+?^${}()|\[\]\\])/g, '\\$1') + '\\s+map|map\\s+' + num + '(?:st|nd|rd|th)?' + ')');
      function looksWinnerOld(line) {
        if (!line) return false;
        const n = norm(line);
        if (!/winner/.test(n)) return false;
        if (badRe.test(n)) return false;
        if (!mapPhraseRe.test(n)) return false;
        return true;
      }
      outer: for (const w of wrappers) {
        const lines = (w.textContent || '').split('\n').map(l => l.trim()).filter(l => l.length).slice(0, 12);
        for (const line of lines) { if (looksWinnerOld(line)) { target = w; break outer; } }
      }
      
      // Strategy 2: New Rivalry format — wrapper header says "First map - main lines" (no "winner"),
      // but inside there's a separate "Winner" market row.
      if (!target) {
        for (const w of wrappers) {
          const txt = w.textContent || '';
          const txtLower = norm(txt);
          if (!mapHeaderRe.test(txt)) continue;
          if (!/\bwinner\b/i.test(txt)) continue;
          const hasPlainWinner = /\bwinner\b/i.test(txt) && !/kill\s*winner|winner\s*handicap/i.test(txtLower);
          if (!hasPlainWinner) continue;
          if (badRe.test(txtLower)) continue;
          const plates = w.querySelectorAll('[data-editor-id="tableOutcomePlate"]');
          if (plates.length >= 2) { target = w; break; }
        }
      }
    }
    
    if (!target) return emptyResult();
    
    // Find the "Winner" market label inside target and get the 2 plates immediately after it
    let plates = [];
    const allChildren = Array.from(target.querySelectorAll('*'));
    const winnerLabel = allChildren.find(el => {
      const t = (el.textContent || '').trim().toLowerCase();
      return t === 'winner' && el.children.length === 0; // leaf node with just "Winner"
    });
    
    if (winnerLabel) {
      let sibling = winnerLabel.nextElementSibling;
      while (sibling && plates.length < 2) {
        if (sibling.matches('[data-editor-id="tableOutcomePlate"]')) {
          plates.push(sibling);
        } else if (sibling.querySelector('[data-editor-id="tableOutcomePlate"]')) {
          plates.push(...Array.from(sibling.querySelectorAll('[data-editor-id="tableOutcomePlate"]')).slice(0, 2 - plates.length));
        } else {
          const sibText = (sibling.textContent || '').trim().toLowerCase();
          if (sibText && !/^\d/.test(sibText) && sibText !== 'winner' && sibling.children.length === 0) {
            break;
          }
        }
        sibling = sibling.nextElementSibling;
      }
    }
    
    // Fallback: if no winnerLabel found or not enough plates, use old method (first 2 plates)
    if (plates.length < 2) {
      plates = Array.from(target.querySelectorAll('[data-editor-id="tableOutcomePlate"]')).slice(0, 2);
    }
    if (plates.length < 2) return emptyResult();
    
    const odds = plates.map(extractPrice);
    
    // Enhanced suspension detection
    const plateStates = plates.map(p => ({ active: isActivePlate(p) }));
    let heuristicAllInactive = plateStates.every(s => !s.active);
    
    // Old extension heuristic
    let legacyFrozen = false;
    try {
      plates.forEach(plate => {
        if (legacyFrozen) return;
        const spans = plate.querySelectorAll('span');
        const last = spans[spans.length - 1];
        if (!last) return;
        const cs = getComputedStyle(last);
        const op = parseFloat(cs.opacity || '1');
        if (cs.pointerEvents === 'none' || cs.cursor === 'default' || cs.cursor === 'not-allowed' || (!isNaN(op) && op < 1)) {
          legacyFrozen = true;
        }
      });
    } catch (_) { }
    
    // Wrapper text cues
    let textCueFrozen = false;
    try {
      const txt = norm(target.textContent || '');
      if (/suspend|suspens|closed|settled|unavailable/.test(txt)) textCueFrozen = true;
    } catch (_) { }
    
    const frozen = heuristicAllInactive || legacyFrozen || textCueFrozen;
    
    if (debug) {
      try {
        console.log('[RIVALRY][debug]', { mapNum, odds, plateStates, heuristicAllInactive, legacyFrozen, textCueFrozen, frozen });
      } catch (_) { }
    }
    
    return { odds: odds.length === 2 ? odds : ['-', '-'], frozen };
  } catch (_) { return emptyResult(); }
}

module.exports = { extractRivalry };
