// Shared semver version comparison utility
// Used by updater, addonManager, extensionBridge

/**
 * Compare semver versions (basic).
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 * Handles dev versions like 'dev.abc1234' or '0.1.0-dev.abc1234'.
 */
function compareVersions(v1, v2) {
  if (!v1 || !v2) return 0;
  if (v1 === v2) return 0;

  // Extract dev hash if present
  const extractDevHash = (v) => {
    const match = v.match(/(?:^dev\.|.*-dev\.)([a-f0-9]+)$/i);
    return match ? match[1] : null;
  };

  // Extract base version (strip -dev.xxx suffix)
  const extractBase = (v) => {
    return v.replace(/^v/, '').replace(/-dev\..+$/i, '').replace(/^dev\..*$/, '0.0.0');
  };

  // Standard semver comparison helper
  const parseSemver = (v) => {
    const parts = v.split('.').map(p => parseInt(p, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return parts;
  };
  const cmpSemver = (a, b) => {
    const pa = parseSemver(a), pb = parseSemver(b);
    for (let i = 0; i < 3; i++) {
      if (pa[i] > pb[i]) return 1;
      if (pa[i] < pb[i]) return -1;
    }
    return 0;
  };

  const hash1 = extractDevHash(v1);
  const hash2 = extractDevHash(v2);
  const isDev1 = hash1 !== null || v1.startsWith('dev');
  const isDev2 = hash2 !== null || v2.startsWith('dev');

  // If both are dev versions — compare base versions first, then hashes
  if (isDev1 && isDev2) {
    const baseCmp = cmpSemver(extractBase(v1), extractBase(v2));
    if (baseCmp !== 0) return baseCmp;
    // Same base — different commit = newer (can't know order, treat as newer)
    if (hash1 && hash2 && hash1 !== hash2) return 1;
    return 0;
  }

  // Mixed dev vs stable: compare base versions first
  // e.g. 0.4.1 (stable) vs 0.4.0-dev.xxx → 0.4.1 > 0.4.0 → stable wins
  // e.g. 0.4.0 (stable) vs 0.4.0-dev.xxx → same base → dev wins (dev is ahead of same base)
  if (isDev1 !== isDev2) {
    const base1 = extractBase(v1);
    const base2 = extractBase(v2);
    const baseCmp = cmpSemver(base1, base2);
    if (baseCmp !== 0) return baseCmp;
    // Same base version: dev is considered newer than release of same version
    return isDev1 ? 1 : -1;
  }

  // Both stable — standard semver comparison
  return cmpSemver(extractBase(v1), extractBase(v2));
}

/**
 * Check if remote version is newer than local (convenience wrapper).
 * @returns {boolean}
 */
function isNewer(remote, local) {
  return compareVersions(remote, local) > 0;
}

module.exports = { compareVersions, isNewer };
