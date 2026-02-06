/**
 * Criteria-based scoring system
 * Each criteria scores 0-100, final score is sum of all criteria
 */

const { stringSimilarity, similarityToScore } = require('./levenshtein');
const { normalizeName } = require('../normalize/name');
const { isNicknameMatch, getNicknameVariants } = require('../normalize/nicknames');
const { normalizeCity, normalizeState } = require('../normalize/location');

/**
 * Calculate age score based on difference and input date
 * Exact match = 100, decreases as difference increases
 * Outside ±6 years = 0
 */
function calculateAgeScore(candidateAge, queryAge, inputDate) {
  if (candidateAge === undefined || candidateAge === null) return null;
  if (queryAge === undefined || queryAge === null) return null;

  // Adjust query age based on time elapsed since input date
  let adjustedQueryAge = queryAge;
  if (inputDate) {
    const input = new Date(inputDate);
    const now = new Date();
    const yearsElapsed = (now - input) / (365.25 * 24 * 60 * 60 * 1000);
    adjustedQueryAge = queryAge + yearsElapsed;
  }

  const diff = Math.abs(candidateAge - adjustedQueryAge);

  if (diff <= 0.5) return 100;      // Exact match (accounting for rounding)
  if (diff <= 1) return 90;
  if (diff <= 2) return 80;
  if (diff <= 3) return 70;
  if (diff <= 4) return 60;
  if (diff <= 5) return 50;
  if (diff <= 6) return 40;
  return 0;  // Outside acceptable range
}

/**
 * Calculate state score
 * Match = 100, Mismatch = 0
 */
function calculateStateScore(candidateState, queryState) {
  if (!candidateState || !queryState) return null;

  const candNorm = normalizeState(candidateState);
  const queryNorm = normalizeState(queryState);

  return candNorm === queryNorm ? 100 : 0;
}

/**
 * Calculate city score
 * Same city = 100, Different city same state = 50, Different state = 0
 */
function calculateCityScore(candidateCity, candidateState, queryCity, queryState) {
  if (!candidateCity || !queryCity) return null;

  const candCityNorm = normalizeCity(candidateCity);
  const queryCityNorm = normalizeCity(queryCity);

  // Exact city match
  if (candCityNorm === queryCityNorm) return 100;

  // Different city but same state
  if (candidateState && queryState) {
    const candStateNorm = normalizeState(candidateState);
    const queryStateNorm = normalizeState(queryState);
    if (candStateNorm === queryStateNorm) return 50;
  }

  return 0;
}

/**
 * Calculate last name score using Levenshtein similarity
 */
function calculateLastNameScore(candidateLastName, queryLastName) {
  if (!candidateLastName || !queryLastName) return null;

  const candNorm = normalizeName(candidateLastName);
  const queryNorm = normalizeName(queryLastName);

  const similarity = stringSimilarity(candNorm, queryNorm);
  return similarityToScore(similarity);
}

/**
 * Calculate first name score using Levenshtein similarity
 * Also considers nicknames, but exact matches have priority
 * Exact match = 100, Nickname/variant match = 85, Close spelling = up to 90, Different = 0
 */
function calculateFirstNameScore(candidateFirstName, queryFirstName) {
  if (!candidateFirstName || !queryFirstName) return null;

  const candNorm = normalizeName(candidateFirstName);
  const queryNorm = normalizeName(queryFirstName);

  // Exact match gets 100
  if (candNorm === queryNorm) {
    return 100;
  }

  // Check if it's a nickname/variant match
  const isNickname = isNicknameMatch(queryNorm, candNorm) || isNicknameMatch(candNorm, queryNorm);

  if (isNickname) {
    // Nickname match caps at 85 to ensure exact matches rank higher
    return 85;
  }

  // Direct similarity (for close spellings like "Jon" vs "John")
  const directSimilarity = stringSimilarity(candNorm, queryNorm);

  // Only give points for very close spellings (>= 70% similar)
  // Otherwise it's a different name and gets 0
  if (directSimilarity < 0.7) {
    return 0;
  }

  // Close spelling gets score based on similarity, capped at 90
  const score = similarityToScore(directSimilarity);
  return Math.min(score, 90);
}

/**
 * Calculate all criteria scores for a candidate
 */
function calculateCriteriaScores(candidate, query) {
  const scores = {
    lastName: calculateLastNameScore(candidate.lastName, query.lastName),
    firstName: calculateFirstNameScore(candidate.firstName, query.firstName),
    state: calculateStateScore(candidate.state, query.state),
    city: calculateCityScore(candidate.city, candidate.state, query.city, query.state),
    age: calculateAgeScore(candidate.ageYears, query.age, query.inputDate)
  };

  return scores;
}

/**
 * Calculate final score (sum of all non-null criteria)
 */
function calculateFinalScore(criteriaScores) {
  let total = 0;
  let count = 0;

  for (const [key, value] of Object.entries(criteriaScores)) {
    if (value !== null) {
      total += value;
      count++;
    }
  }

  return {
    finalScore: total,
    maxPossible: count * 100,
    criteriaCount: count
  };
}

/**
 * Score a single candidate with criteria scores, final score
 */
function scoreCandidateWithCriteria(candidate, query) {
  const criteriaScores = calculateCriteriaScores(candidate, query);
  const { finalScore, maxPossible, criteriaCount } = calculateFinalScore(criteriaScores);

  return {
    ...candidate,
    criteriaScores,
    finalScore,
    maxPossible,
    criteriaCount
  };
}

/**
 * Check if a DOD is within the recent window (default 14 days)
 */
function isRecentDod(dod, daysWindow = 14) {
  if (!dod) return false;

  const dodDate = new Date(dod);
  const now = new Date();
  const diffMs = now - dodDate;
  const diffDays = diffMs / (24 * 60 * 60 * 1000);

  return diffDays >= 0 && diffDays <= daysWindow;
}

/**
 * Score all candidates and assign ranks
 * Recent DODs (within 14 days) are grouped first, then older/unknown DODs
 * Within each group, sorted by finalScore descending
 * Candidates with firstName score of 0 are excluded (different name = not a match)
 */
function scoreAndRankCandidates(candidates, query, recentDaysWindow = 14) {
  // Score all candidates
  const scored = candidates.map(c => scoreCandidateWithCriteria(c, query));

  // Filter out candidates with first name score of 0 (completely different name)
  // These should never be a best guess - would cause false alerts
  const validCandidates = scored.filter(c =>
    c.criteriaScores.firstName === null || c.criteriaScores.firstName > 0
  );

  // Separate into recent DOD and other
  const recentDod = validCandidates.filter(c => isRecentDod(c.dod, recentDaysWindow));
  const otherDod = validCandidates.filter(c => !isRecentDod(c.dod, recentDaysWindow));

  // Sort each group by finalScore descending
  recentDod.sort((a, b) => b.finalScore - a.finalScore);
  otherDod.sort((a, b) => b.finalScore - a.finalScore);

  // Combine: recent first, then others
  const combined = [...recentDod, ...otherDod];

  // Assign ranks (1 = best)
  let currentRank = 1;
  for (let i = 0; i < combined.length; i++) {
    if (i > 0 && (
      // New rank if score changed OR if we crossed from recent to non-recent
      combined[i].finalScore < combined[i - 1].finalScore ||
      (isRecentDod(combined[i - 1].dod, recentDaysWindow) && !isRecentDod(combined[i].dod, recentDaysWindow))
    )) {
      currentRank = i + 1;
    }
    combined[i].rank = currentRank;
  }

  return combined;
}

module.exports = {
  calculateAgeScore,
  calculateStateScore,
  calculateCityScore,
  calculateLastNameScore,
  calculateFirstNameScore,
  calculateCriteriaScores,
  calculateFinalScore,
  scoreCandidateWithCriteria,
  scoreAndRankCandidates,
  isRecentDod
};
