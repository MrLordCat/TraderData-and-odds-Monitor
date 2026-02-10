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

  const hash1 = extractDevHash(v1);
  const hash2 = extractDevHash(v2);
  const isDev1 = hash1 !== null || v1.startsWith('dev');
  const isDev2 = hash2 !== null || v2.startsWith('dev');

  // If both are dev versions
  if (isDev1 && isDev2) {
    if (hash1 && hash2 && hash1 !== hash2) return 1;
    return 0;
  }

  // Dev is always considered newer than release
  if (isDev1 && !isDev2) return 1;
  if (!isDev1 && isDev2) return -1;

  // Standard semver comparison
  const parse = (v) => {
    const parts = v.replace(/^v/, '').split('.').map(p => parseInt(p, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return parts;
  };

  const p1 = parse(v1);
  const p2 = parse(v2);

  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

/**
 * Check if remote version is newer than local (convenience wrapper).
 * @returns {boolean}
 */
function isNewer(remote, local) {
  return compareVersions(remote, local) > 0;
}

module.exports = { compareVersions, isNewer };
