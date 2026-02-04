/**
 * Generate a human-readable explanation of scoring
 */
function explainScore(candidate) {
  const lines = [
    `Score: ${candidate.score}`,
    'Breakdown:'
  ];

  for (const reason of candidate.reasons) {
    lines.push(`  - ${reason}`);
  }

  if (candidate.reasons.length === 0) {
    lines.push('  (no scoring factors applied)');
  }

  return lines.join('\n');
}

/**
 * Format candidate for display
 */
function formatCandidate(candidate, index) {
  const rankLabel = (index === 0) ? ' ★ BEST GUESS' : '';
  const lines = [
    `\n--- Result ${index + 1} (Rank #${candidate.rank || '?'})${rankLabel} ---`,
    `Name: ${candidate.fullName}`,
    `Final Score: ${candidate.finalScore || 0}/${candidate.maxPossible || 500}`,
    `Fingerprint: ${candidate.fingerprint}`
  ];

  if (candidate.ageYears) {
    lines.push(`Age: ${candidate.ageYears}`);
  }

  if (candidate.city || candidate.state) {
    lines.push(`Location: ${candidate.city || '?'}, ${candidate.state || '?'}`);
  }

  if (candidate.dod) {
    lines.push(`Date of Death: ${candidate.dod}`);
  }

  lines.push(`Source: ${candidate.source}`);
  lines.push(`URL: ${candidate.url}`);

  if (candidate.snippet) {
    const truncated = candidate.snippet.length > 150
      ? candidate.snippet.slice(0, 147) + '...'
      : candidate.snippet;
    lines.push(`Snippet: ${truncated}`);
  }

  // Show criteria scores if available
  if (candidate.criteriaScores) {
    lines.push('Criteria Scores:');
    const cs = candidate.criteriaScores;
    if (cs.lastName !== null) lines.push(`  Last Name:  ${cs.lastName}/100`);
    if (cs.firstName !== null) lines.push(`  First Name: ${cs.firstName}/100`);
    if (cs.state !== null) lines.push(`  State:      ${cs.state}/100`);
    if (cs.city !== null) lines.push(`  City:       ${cs.city}/100`);
    if (cs.age !== null) lines.push(`  Age:        ${cs.age}/100`);
  } else if (candidate.reasons && candidate.reasons.length > 0) {
    // Fallback to old scoring format
    lines.push('Scoring:');
    for (const reason of candidate.reasons) {
      lines.push(`  ${reason}`);
    }
  }

  if (candidate.alsoFoundAt && candidate.alsoFoundAt.length > 0) {
    lines.push('Also found at:');
    for (const url of candidate.alsoFoundAt) {
      lines.push(`  - ${url}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  explainScore,
  formatCandidate
};
