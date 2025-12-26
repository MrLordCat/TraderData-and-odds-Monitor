// GitHub API helpers for auto-update
// Fetches releases and commit info from public repository

const https = require('https');

const USER_AGENT = 'OddsMoni-Updater/1.0';

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

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
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

    return {
      version: release.tag_name.replace(/^v/, ''),
      tagName: release.tag_name,
      downloadUrl: asset.browser_download_url,
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
      body: release.body || ''
    };
  } catch (err) {
    console.error('[githubApi] getLatestRelease error:', err.message);
    throw err;
  }
}

// Get dev-latest release (prerelease with dev builds)
async function getDevRelease(owner, repo) {
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

    return {
      version: release.tag_name,
      commit: commit,
      commitShort: commitShort,
      downloadUrl: asset.browser_download_url,
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
      body: release.body || ''
    };
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

module.exports = {
  getLatestRelease,
  getDevRelease,
  getLatestCommit,
  getAllReleases,
  httpsGet
};
