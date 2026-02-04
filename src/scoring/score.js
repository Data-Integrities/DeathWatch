const { normalizeName } = require('../normalize/name');
const { isNicknameMatch } = require('../normalize/nicknames');
const { normalizeCity, normalizeState, citiesMatch } = require('../normalize/location');
const { isAgeInRange } = require('../normalize/age');
const config = require('../config');

function calculateScore(candidate, query) {
  let score = 0;
  const reasons = [];
  const weights = config.scoring;

  // Last name match (required for most cases, but check anyway)
  if (candidate.lastName) {
    const candLastName = normalizeName(candidate.lastName);
    if (candLastName === query.normalizedLastName) {
      score += weights.lastNameExact;
      reasons.push(`Last name exact match (+${weights.lastNameExact})`);
    } else {
      score += weights.lastNameMismatch;
      reasons.push(`Last name mismatch (${weights.lastNameMismatch})`);
    }
  }

  // First name matching
  if (candidate.firstName) {
    const candFirstName = normalizeName(candidate.firstName);

    if (candFirstName === query.normalizedFirstName) {
      score += weights.firstNameExact;
      reasons.push(`First name exact match (+${weights.firstNameExact})`);
    } else if (isNicknameMatch(query.normalizedFirstName, candFirstName) ||
               isNicknameMatch(candFirstName, query.normalizedFirstName)) {
      score += weights.nicknameMatch;
      reasons.push(`First name nickname match (+${weights.nicknameMatch})`);
    } else {
      score += weights.firstNameMismatch;
      reasons.push(`First name mismatch (${weights.firstNameMismatch})`);
    }
  }

  // Middle initial match
  if (query.middleName && candidate.middleName) {
    const queryMiddleInit = normalizeName(query.middleName).charAt(0);
    const candMiddleInit = normalizeName(candidate.middleName).charAt(0);
    if (queryMiddleInit === candMiddleInit) {
      score += weights.middleInitial;
      reasons.push(`Middle initial match (+${weights.middleInitial})`);
    }
  }

  // State match
  if (candidate.state && query.normalizedState) {
    const candState = normalizeState(candidate.state);
    if (candState === query.normalizedState) {
      score += weights.stateExact;
      reasons.push(`State exact match (+${weights.stateExact})`);

      // City matching (only meaningful if state matches)
      if (candidate.city && query.normalizedCity) {
        if (citiesMatch(candidate.city, query.normalizedCity)) {
          score += weights.cityExact;
          reasons.push(`City exact match (+${weights.cityExact})`);
        } else {
          // City mismatch in same state - penalty
          score += weights.cityMismatchSameState;
          reasons.push(`City mismatch in same state (${weights.cityMismatchSameState})`);
        }
      }
    }
  }

  // Age matching
  if (candidate.ageYears !== undefined && query.age !== undefined) {
    if (isAgeInRange(candidate.ageYears, query.age)) {
      score += weights.ageInRange;
      reasons.push(`Age within range (+${weights.ageInRange})`);
    } else {
      score += weights.ageOutsideRange;
      reasons.push(`Age outside range (${weights.ageOutsideRange})`);
    }
  }

  return { score, reasons };
}

function scoreCandidate(candidate, query) {
  const result = calculateScore(candidate, query);
  return {
    ...candidate,
    score: result.score,
    reasons: result.reasons
  };
}

function scoreCandidates(candidates, query) {
  return candidates.map(c => scoreCandidate(c, query));
}

module.exports = {
  calculateScore,
  scoreCandidate,
  scoreCandidates
};
