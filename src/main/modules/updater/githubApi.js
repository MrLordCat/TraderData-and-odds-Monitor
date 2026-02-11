// GitHub API helpers for auto-update
// Fetches releases and commit info from public repository

const https = require('https');

const USER_AGENT = 'OddsMoni-Updater/1.0';

// Simple in-memory cache to avoid rate limits (60 req/hour unauthenticated)
const cache = {
  data: {},
  ttl: 30 * 1000, // 30 seconds cache TTL (allows manual re-checks)
  get(key) {
    const entry = this.data[key];
    if (entry && Date.now() - entry.time < this.ttl) {
      console.log(`[githubApi] Cache hit for ${key}`);
      return entry.value;
    }
    return null;
  },
  set(key, value) {
    this.data[key] = { value, time: Date.now() };
  },
  clear() {
    this.data = {};
    console.log('[githubApi] Cache cleared');
  },
  clearKey(key) {
    delete this.data[key];
  }
};

// Generic HTTPS GET request
function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/vnd.github.v3+json',
        ...options.headers
      }
    };

    const req = https.request(opts, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location, options).then(resolve).catch(reject);
        return;
      }

      // Log rate limit info
      const remaining = res.headers['x-ratelimit-remaining'];
      const reset = res.headers['x-ratelimit-reset'];
      if (remaining !== undefined) {
        const resetTime = reset ? new Date(reset * 1000).toLocaleTimeString() : 'unknown';
        console.log(`[githubApi] Rate limit remaining: ${remaining}, resets at: ${resetTime}`);
      }

      if (res.statusCode !== 200) {
        let errorMsg = `HTTP ${res.statusCode}: ${res.statusMessage}`;
        // Enhanced rate limit error with reset time
        if (res.statusCode === 403 && remaining === '0' && reset) {
          const resetTime = new Date(reset * 1000);
          const minutesUntil = Math.ceil((resetTime - Date.now()) / 60000);
          errorMsg = `Rate limit exceeded. Resets in ${minutesUntil} minute(s) at ${resetTime.toLocaleTimeString()}`;
        }
        reject(new Error(errorMsg));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// Get latest stable release (non-prerelease)
async function getLatestRelease(owner, repo) {
  const cacheKey = `latest-${owner}-${repo}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const release = await httpsGet(url);

    if (!release || !release.tag_name) {
      return null;
    }

    // Find portable zip asset
    const asset = release.assets?.find(a => 
      a.name.includes('portable') && a.name.endsWith('.zip')
    ) || release.assets?.find(a => a.name.endsWith('.zip'));

    if (!asset) {
      console.warn('[githubApi] No zip asset found in release');
      return null;
    }

    const result = {
      version: release.tag_name.replace(/^v/, ''),
      tagName: release.tag_name,
      downloadUrl: asset.browser_download_url,
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
      body: release.body || ''
    };
    
    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error('[githubApi] getLatestRelease error:', err.message);
    throw err;
  }
}

// Get dev-latest release (prerelease with dev builds)
async function getDevRelease(owner, repo) {
  const cacheKey = `dev-${owner}-${repo}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    // Fetch release by tag "dev-latest"
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/tags/dev-latest`;
    const release = await httpsGet(url);

    if (!release || !release.tag_name) {
      return null;
    }

    // Find dev zip asset
    const asset = release.assets?.find(a => 
      a.name.includes('dev') && a.name.endsWith('.zip')
    ) || release.assets?.find(a => a.name.endsWith('.zip'));

    if (!asset) {
      console.warn('[githubApi] No zip asset found in dev release');
      return null;
    }

    // Extract commit SHA from asset name (OddsMoni-dev-abc1234-win64.zip)
    const commitMatch = asset.name.match(/dev-([a-f0-9]+)-/i);
    const commitShort = commitMatch ? commitMatch[1] : null;

    // Also try to get full commit from release body
    const fullCommitMatch = release.body?.match(/Commit:\s*([a-f0-9]{40})/i);
    const commit = fullCommitMatch ? fullCommitMatch[1] : commitShort;

    const result = {
      version: release.tag_name,
      commit: commit,
      commitShort: commitShort,
      downloadUrl: asset.browser_download_url,
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
      body: release.body || ''
    };
    
    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    // dev-latest might not exist yet
    if (err.message.includes('404')) {
      console.log('[githubApi] dev-latest release not found');
      return null;
    }
    console.error('[githubApi] getDevRelease error:', err.message);
    throw err;
  }
}

// Get latest commit on main branch (alternative for dev channel)
async function getLatestCommit(owner, repo, branch = 'main') {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`;
    const commit = await httpsGet(url);

    if (!commit || !commit.sha) {
      return null;
    }

    return {
      sha: commit.sha,
      shortSha: commit.sha.substring(0, 7),
      message: commit.commit?.message || '',
      author: commit.commit?.author?.name || '',
      date: commit.commit?.author?.date || ''
    };
  } catch (err) {
    console.error('[githubApi] getLatestCommit error:', err.message);
    throw err;
  }
}

// Check all releases for any newer version
async function getAllReleases(owner, repo, limit = 10) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${limit}`;
    const releases = await httpsGet(url);
    return releases || [];
  } catch (err) {
    console.error('[githubApi] getAllReleases error:', err.message);
    return [];
  }
}

// Clear API cache (for force refresh)
function clearCache() {
  cache.clear();
}

module.exports = {
  getLatestRelease,
  getDevRelease,
  getLatestCommit,
  getAllReleases,
  httpsGet,
  clearCache
};
