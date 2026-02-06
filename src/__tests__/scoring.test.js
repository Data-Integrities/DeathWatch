const { calculateScore, scoreCandidate } = require('../scoring/score');
const { isRecentDod, scoreAndRankCandidates } = require('../scoring/criteriaScore');
const config = require('../config');

describe('Scoring Engine', () => {
  const makeQuery = (overrides = {}) => ({
    firstName: 'James',
    lastName: 'Smith',
    city: 'Hamilton',
    state: 'OH',
    age: 71,
    normalizedFirstName: 'james',
    normalizedLastName: 'smith',
    normalizedCity: 'hamilton',
    normalizedState: 'OH',
    firstNameVariants: ['james', 'jim', 'jimmy', 'jamie'],
    searchKey: 'test-key',
    ...overrides
  });

  const makeCandidate = (overrides = {}) => ({
    id: 'test-1',
    fullName: 'James Smith',
    firstName: 'James',
    lastName: 'Smith',
    ageYears: 71,
    city: 'Hamilton',
    state: 'OH',
    source: 'Test',
    url: 'https://example.com',
    snippet: 'Test snippet',
    score: 0,
    reasons: [],
    fingerprint: 'test-fp',
    providerType: 'native',
    ...overrides
  });

  describe('calculateScore', () => {
    it('should give full score for perfect match', () => {
      const query = makeQuery();
      const candidate = makeCandidate();
      const result = calculateScore(candidate, query);

      // Perfect match should have: lastName + firstName + state + city + age
      expect(result.score).toBe(
        config.scoring.lastNameExact +
        config.scoring.firstNameExact +
        config.scoring.stateExact +
        config.scoring.cityExact +
        config.scoring.ageInRange
      );
    });

    it('should score nickname match', () => {
      const query = makeQuery();
      const candidate = makeCandidate({ firstName: 'Jim' });
      const result = calculateScore(candidate, query);

      expect(result.reasons.some(r => r.includes('nickname'))).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should apply city mismatch penalty in same state', () => {
      const query = makeQuery();
      const candidate = makeCandidate({ city: 'Cincinnati' });
      const result = calculateScore(candidate, query);

      expect(result.reasons.some(r => r.includes('City mismatch'))).toBe(true);
      expect(result.score).toBeLessThan(
        config.scoring.lastNameExact +
        config.scoring.firstNameExact +
        config.scoring.stateExact +
        config.scoring.ageInRange
      );
    });

    it('should apply age outside range penalty', () => {
      const query = makeQuery({ age: 71 });
      const candidate = makeCandidate({ ageYears: 55 });  // Way outside ±6 range
      const result = calculateScore(candidate, query);

      expect(result.reasons.some(r => r.includes('Age outside range'))).toBe(true);
    });

    it('should score middle initial match', () => {
      const query = makeQuery({ middleName: 'William' });
      const candidate = makeCandidate({ middleName: 'Walter' });
      const result = calculateScore(candidate, query);

      expect(result.reasons.some(r => r.includes('Middle initial match'))).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle missing candidate fields gracefully', () => {
      const query = makeQuery();
      const candidate = makeCandidate({
        firstName: undefined,
        city: undefined,
        state: undefined,
        ageYears: undefined
      });

      const result = calculateScore(candidate, query);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('scoreCandidate', () => {
    it('should return candidate with score and reasons', () => {
      const query = makeQuery();
      const candidate = makeCandidate();
      const scored = scoreCandidate(candidate, query);

      expect(scored.score).toBeGreaterThan(0);
      expect(scored.reasons.length).toBeGreaterThan(0);
      expect(scored.id).toBe(candidate.id);  // Original data preserved
    });
  });

  describe('isRecentDod', () => {
    it('should return true for DOD within 14 days', () => {
      const today = new Date();
      const fiveDaysAgo = new Date(today - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      expect(isRecentDod(fiveDaysAgo)).toBe(true);
    });

    it('should return true for DOD 13 days ago (within 14-day window)', () => {
      const today = new Date();
      const thirteenDaysAgo = new Date(today - 13 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      expect(isRecentDod(thirteenDaysAgo)).toBe(true);
    });

    it('should return false for DOD more than 14 days ago', () => {
      const today = new Date();
      const twentyDaysAgo = new Date(today - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      expect(isRecentDod(twentyDaysAgo)).toBe(false);
    });

    it('should return false for null/undefined DOD', () => {
      expect(isRecentDod(null)).toBe(false);
      expect(isRecentDod(undefined)).toBe(false);
    });

    it('should return false for future DOD', () => {
      const today = new Date();
      const future = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      expect(isRecentDod(future)).toBe(false);
    });

    it('should respect custom days window', () => {
      const today = new Date();
      const tenDaysAgo = new Date(today - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      expect(isRecentDod(tenDaysAgo, 7)).toBe(false);  // Outside 7-day window
      expect(isRecentDod(tenDaysAgo, 14)).toBe(true);  // Within 14-day window
    });
  });

  describe('scoreAndRankCandidates with DOD recency', () => {
    const makeQueryForCriteria = () => ({
      firstName: 'John',
      lastName: 'Smith',
      city: 'Columbus',
      state: 'OH',
      age: 75
    });

    const makeCandidateForCriteria = (overrides = {}) => ({
      id: 'test-1',
      fullName: 'John Smith',
      firstName: 'John',
      lastName: 'Smith',
      ageYears: 75,
      city: 'Columbus',
      state: 'OH',
      dod: null,
      ...overrides
    });

    it('should rank recent DOD candidates before older DOD candidates', () => {
      const today = new Date();
      const fiveDaysAgo = new Date(today - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const oneYearAgo = new Date(today - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const query = makeQueryForCriteria();
      const candidates = [
        makeCandidateForCriteria({ id: 'old', dod: oneYearAgo, firstName: 'John', lastName: 'Smith' }),
        makeCandidateForCriteria({ id: 'recent', dod: fiveDaysAgo, firstName: 'Jon', lastName: 'Smyth' })  // Worse name match
      ];

      const ranked = scoreAndRankCandidates(candidates, query);

      // Recent DOD should be ranked first even with worse name match
      expect(ranked[0].id).toBe('recent');
      expect(ranked[1].id).toBe('old');
    });

    it('should rank by score within the recent DOD group', () => {
      const today = new Date();
      const threeDaysAgo = new Date(today - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const fiveDaysAgo = new Date(today - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const query = makeQueryForCriteria();
      const candidates = [
        makeCandidateForCriteria({ id: 'recent-bad', dod: threeDaysAgo, firstName: 'Jon', lastName: 'Smyth' }),
        makeCandidateForCriteria({ id: 'recent-good', dod: fiveDaysAgo, firstName: 'John', lastName: 'Smith' })
      ];

      const ranked = scoreAndRankCandidates(candidates, query);

      // Both recent, so better score should win
      expect(ranked[0].id).toBe('recent-good');
      expect(ranked[1].id).toBe('recent-bad');
    });
  });
});
