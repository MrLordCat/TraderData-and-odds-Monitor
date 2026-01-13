// upTime Extension - Content Script
// Extracts odds data from bookmaker sites and sends to background script

// Import shared extraction logic from main app (will be bundled/copied)
// For now, implement simplified extractors inline

// Detect broker from URL
function getBrokerId() {
  const host = window.location.hostname;
  if (/rivalry/i.test(host)) return 'rivalry';
  if (/gg\.bet/i.test(host)) return 'gg';
  if (/thunderpick/i.test(host)) return 'thunder';
  if (/betboom/i.test(host)) return 'betboom';
  if (/pari\.ru/i.test(host)) return 'pari';
  if (/marathonbet/i.test(host)) return 'marathon';
  if (/bet365/i.test(host)) return 'bet365';
  return 'unknown';
}

// Deep query helper (searches shadow DOM too)
function deepQuery(selector, root = document) {
  const res = [];
  function walk(r) {
    try {
      r.querySelectorAll(selector).forEach(e => res.push(e));
    } catch (_) {}
    try {
      r.querySelectorAll('*').forEach(n => {
        if (n.shadowRoot) walk(n.shadowRoot);
      });
    } catch (_) {}
  }
  walk(root);
  return res;
}

// Simplified extractors for each broker
const extractors = {
  rivalry: function() {
    try {
      // Look for Match Winner market
      const wrappers = deepQuery('[data-editor-id="tableMarketWrapper"]');
      for (const wrapper of wrappers) {
        const text = wrapper.textContent || '';
        if (/winner/i.test(text) && !/map\s*\d/i.test(text)) {
          const plates = wrapper.querySelectorAll('[data-editor-id="tableOutcomePlate"]');
          if (plates.length >= 2) {
            const odds = [];
            for (let i = 0; i < 2; i++) {
              const oddText = plates[i].textContent.match(/\d+\.?\d*/);
              odds.push(oddText ? oddText[0] : '-');
            }
            return { odds, frozen: false };
          }
        }
      }
    } catch (e) {
      console.error('[upTime] Rivalry extraction error:', e);
    }
    return { odds: ['-', '-'], frozen: false };
  },

  gg: function() {
    try {
      // GG.bet uses specific class structure
      const markets = document.querySelectorAll('[class*="market"]');
      for (const market of markets) {
        const text = market.textContent || '';
        if (/winner|match/i.test(text)) {
          const buttons = market.querySelectorAll('button, [class*="odd"]');
          if (buttons.length >= 2) {
            const odds = [];
            for (let i = 0; i < 2; i++) {
              const oddText = buttons[i].textContent.match(/\d+\.?\d*/);
              odds.push(oddText ? oddText[0] : '-');
            }
            return { odds, frozen: false };
          }
        }
      }
    } catch (e) {
      console.error('[upTime] GG.bet extraction error:', e);
    }
    return { odds: ['-', '-'], frozen: false };
  },

  thunder: function() {
    try {
      // Thunderpick structure
      const markets = document.querySelectorAll('[class*="market"], [class*="Market"]');
      for (const market of markets) {
        const text = market.textContent || '';
        if (/match winner|winner/i.test(text)) {
          const oddElements = market.querySelectorAll('[class*="odd"], button');
          if (oddElements.length >= 2) {
            const odds = [];
            for (let i = 0; i < 2; i++) {
              const oddText = oddElements[i].textContent.match(/\d+\.?\d*/);
              odds.push(oddText ? oddText[0] : '-');
            }
            return { odds, frozen: false };
          }
        }
      }
    } catch (e) {
      console.error('[upTime] Thunderpick extraction error:', e);
    }
    return { odds: ['-', '-'], frozen: false };
  },

  // Fallback extractor for other sites
  generic: function() {
    try {
      // Generic extraction - look for odds-like patterns
      const oddPattern = /\d+\.\d{2}/g;
      const text = document.body.textContent || '';
      const matches = text.match(oddPattern);
      if (matches && matches.length >= 2) {
        return { odds: [matches[0], matches[1]], frozen: false };
      }
    } catch (e) {
      console.error('[upTime] Generic extraction error:', e);
    }
    return { odds: ['-', '-'], frozen: false };
  }
};

// Extract odds based on broker
function extractOdds() {
  const brokerId = getBrokerId();
  console.log('[upTime] Extracting odds for', brokerId);
  
  const extractor = extractors[brokerId] || extractors.generic;
  const result = extractor();
  
  console.log('[upTime] Extracted:', result);
  
  // Send to background script
  chrome.runtime.sendMessage({
    type: 'oddsExtracted',
    brokerId: brokerId,
    odds: result.odds,
    frozen: result.frozen
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[upTime] Failed to send odds:', chrome.runtime.lastError);
    } else {
      console.log('[upTime] Odds sent, success:', response?.success);
    }
  });
  
  return result;
}

// Auto-extract on page load and periodically
let autoExtractInterval = null;

function startAutoExtract() {
  if (autoExtractInterval) return;
  
  // Initial extraction after short delay
  setTimeout(extractOdds, 2000);
  
  // Periodic extraction every 5 seconds
  autoExtractInterval = setInterval(extractOdds, 5000);
  
  console.log('[upTime] Auto-extraction started');
}

function stopAutoExtract() {
  if (autoExtractInterval) {
    clearInterval(autoExtractInterval);
    autoExtractInterval = null;
    console.log('[upTime] Auto-extraction stopped');
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'extractOdds') {
    const result = extractOdds();
    sendResponse(result);
  } else if (message.type === 'startAutoExtract') {
    startAutoExtract();
    sendResponse({ success: true });
  } else if (message.type === 'stopAutoExtract') {
    stopAutoExtract();
    sendResponse({ success: true });
  }
  
  return true;
});

// Start auto-extraction on supported sites
const brokerId = getBrokerId();
if (brokerId !== 'unknown') {
  console.log('[upTime] Content script loaded for', brokerId);
  startAutoExtract();
} else {
  console.log('[upTime] Unknown broker site, auto-extraction disabled');
}
