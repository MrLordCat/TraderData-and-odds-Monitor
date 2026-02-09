// Shared HTTP fetch utilities (https-based, no external deps)
const https = require('https');
const http = require('http');

/**
 * Fetch raw text from a URL. Follows redirects.
 * @param {string} url
 * @returns {Promise<string>}
 */
function fetchText(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    mod.get(url, { headers: { 'User-Agent': 'OddsMoni' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Fetch JSON from a URL. Follows redirects.
 * @param {string} url
 * @returns {Promise<*>}
 */
async function fetchJSON(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

module.exports = { fetchText, fetchJSON };
