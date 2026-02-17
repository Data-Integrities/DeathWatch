/**
 * Deduplicate candidates by fingerprint
 * - Groups candidates by fingerprint
 * - Keeps the highest scoring record
 * - Merges URLs into alsoFoundAt array
 */
function deduplicateCandidates(candidates) {
  // Group by fingerprint
  const groups = new Map();

  for (const candidate of candidates) {
    const existing = groups.get(candidate.fingerprint);
    if (existing) {
      existing.push(candidate);
    } else {
      groups.set(candidate.fingerprint, [candidate]);
    }
  }

  // Merge each group
  const deduplicated = [];

  for (const [fingerprint, group] of groups) {
    if (group.length === 1) {
      deduplicated.push(group[0]);
    } else {
      deduplicated.push(mergeGroup(group));
    }
  }

  return deduplicated;
}

/**
 * Merge a group of candidates with the same fingerprint
 * Keep the highest scoring one, merge URLs
 */
function mergeGroup(group) {
  // Sort by score descending
  const sorted = [...group].sort((a, b) => b.score - a.score);
  const best = sorted[0];

  // Collect all unique URLs from other candidates
  const alsoFoundAt = [];
  const seenUrls = new Set([best.url]);

  for (const candidate of sorted.slice(1)) {
    if (!seenUrls.has(candidate.url)) {
      alsoFoundAt.push(candidate.url);
      seenUrls.add(candidate.url);
    }
  }

  // Merge any existing alsoFoundAt arrays
  for (const candidate of group) {
    if (candidate.alsoFoundAt) {
      for (const url of candidate.alsoFoundAt) {
        if (!seenUrls.has(url)) {
          alsoFoundAt.push(url);
          seenUrls.add(url);
        }
      }
    }
  }

  // Prefer native provider data when available (usually more complete)
  let merged = best;
  const nativeRecord = group.find(c => c.typeProvider === 'native');
  if (nativeRecord && nativeRecord !== best) {
    // Use native data but keep best score
    merged = {
      ...nativeRecord,
      score: best.score,
      reasons: best.reasons
    };
  }

  return {
    ...merged,
    alsoFoundAt: alsoFoundAt.length > 0 ? alsoFoundAt : undefined
  };
}

module.exports = {
  deduplicateCandidates
};
