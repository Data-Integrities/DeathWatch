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
 * Also considers nicknames
 */
function calculateFirstNameScore(candidateFirstName, queryFirstName) {
  if (!candidateFirstName || !queryFirstName) return null;

  const candNorm = normalizeName(candidateFirstName);
  const queryNorm = normalizeName(queryFirstName);

  // Direct similarity
  const directSimilarity = stringSimilarity(candNorm, queryNorm);

  // Check nickname matches
  const queryVariants = getNicknameVariants(queryNorm);
  const candVariants = getNicknameVariants(candNorm);

  let bestSimilarity = directSimilarity;

  // Check if candidate matches any query nickname variant
  for (const variant of queryVariants) {
    const sim = stringSimilarity(candNorm, variant);
    if (sim > bestSimilarity) bestSimilarity = sim;
  }

  // Check if query matches any candidate nickname variant
  for (const variant of candVariants) {
    const sim = stringSimilarity(queryNorm, variant);
    if (sim > bestSimilarity) bestSimilarity = sim;
  }

  // Also check direct nickname match (Jim = James)
  if (isNicknameMatch(queryNorm, candNorm) || isNicknameMatch(candNorm, queryNorm)) {
    bestSimilarity = Math.max(bestSimilarity, 0.9); // Nickname match = at least 90
  }

  return similarityToScore(bestSimilarity);
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
 * Score all candidates and assign ranks
 */
function scoreAndRankCandidates(candidates, query) {
  // Score all candidates
  const scored = candidates.map(c => scoreCandidateWithCriteria(c, query));

  // Sort by finalScore descending
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // Assign ranks (1 = best)
  let currentRank = 1;
  for (let i = 0; i < scored.length; i++) {
    if (i > 0 && scored[i].finalScore < scored[i - 1].finalScore) {
      currentRank = i + 1;
    }
    scored[i].rank = currentRank;
  }

  return scored;
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
  scoreAndRankCandidates
};
