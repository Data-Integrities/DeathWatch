const { calculateScore, scoreCandidate } = require('../scoring/score');
const { isRecentDod, scoreAndRankCandidates, calculateKeyWordsScore } = require('../scoring/criteriaScore');
const config = require('../config');

describe('Scoring Engine', () => {
  const makeQuery = (overrides = {}) => ({
    nameFirst: 'James',
    nameLast: 'Smith',
    city: 'Hamilton',
    state: 'OH',
    age: 71,
    nameFirstNorm: 'james',
    nameLastNorm: 'smith',
    cityNorm: 'hamilton',
    stateNorm: 'OH',
    nameFirstVariants: ['james', 'jim', 'jimmy', 'jamie'],
    keySearch: 'test-key',
    ...overrides
  });

  const makeCandidate = (overrides = {}) => ({
    id: 'test-1',
    nameFull: 'James Smith',
    nameFirst: 'James',
    nameLast: 'Smith',
    ageYears: 71,
    city: 'Hamilton',
    state: 'OH',
    source: 'Test',
    url: 'https://example.com',
    snippet: 'Test snippet',
    score: 0,
    reasons: [],
    fingerprint: 'test-fp',
    typeProvider: 'native',
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
      const candidate = makeCandidate({ nameFirst: 'Jim' });
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
      const query = makeQuery({ nameMiddle: 'William' });
      const candidate = makeCandidate({ nameMiddle: 'Walter' });
      const result = calculateScore(candidate, query);

      expect(result.reasons.some(r => r.includes('Middle initial match'))).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle missing candidate fields gracefully', () => {
      const query = makeQuery();
      const candidate = makeCandidate({
        nameFirst: undefined,
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
      nameFirst: 'John',
      nameLast: 'Smith',
      city: 'Columbus',
      state: 'OH',
      age: 75
    });

    const makeCandidateForCriteria = (overrides = {}) => ({
      id: 'test-1',
      nameFull: 'John Smith',
      nameFirst: 'John',
      nameLast: 'Smith',
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
        makeCandidateForCriteria({ id: 'old', dod: oneYearAgo, nameFirst: 'John', nameLast: 'Smith' }),
        makeCandidateForCriteria({ id: 'recent', dod: fiveDaysAgo, nameFirst: 'Jon', nameLast: 'Smyth' })  // Worse name match
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
        makeCandidateForCriteria({ id: 'recent-bad', dod: threeDaysAgo, nameFirst: 'Jon', nameLast: 'Smyth' }),
        makeCandidateForCriteria({ id: 'recent-good', dod: fiveDaysAgo, nameFirst: 'John', nameLast: 'Smith' })
      ];

      const ranked = scoreAndRankCandidates(candidates, query);

      // Both recent, so better score should win
      expect(ranked[0].id).toBe('recent-good');
      expect(ranked[1].id).toBe('recent-bad');
    });
  });

  describe('calculateKeyWordsScore', () => {
    it('should return null when no keywords provided', () => {
      expect(calculateKeyWordsScore({ snippet: 'some text' }, null)).toBeNull();
      expect(calculateKeyWordsScore({ snippet: 'some text' }, [])).toBeNull();
      expect(calculateKeyWordsScore({ snippet: 'some text' }, undefined)).toBeNull();
    });

    it('should return 100 when keyword found in snippet', () => {
      const candidate = { snippet: 'He served in the Army for 20 years', title: 'Obituary' };
      expect(calculateKeyWordsScore(candidate, ['army'])).toBe(100);
    });

    it('should return 100 when keyword found in title', () => {
      const candidate = { snippet: 'Some text', title: 'Army veteran John Smith obituary' };
      expect(calculateKeyWordsScore(candidate, ['army'])).toBe(100);
    });

    it('should return 0 when no keywords match', () => {
      const candidate = { snippet: 'Loved gardening and fishing', title: 'Obituary' };
      expect(calculateKeyWordsScore(candidate, ['army', 'navy'])).toBe(0);
    });

    it('should be case insensitive', () => {
      const candidate = { snippet: 'Served in the ARMY', title: '' };
      expect(calculateKeyWordsScore(candidate, ['army'])).toBe(100);
    });

    it('should return 100 when any of multiple keywords match', () => {
      const candidate = { snippet: 'Lived in Middletown for years', title: '' };
      expect(calculateKeyWordsScore(candidate, ['army', 'middletown'])).toBe(100);
    });

    it('should handle apostrophes in keywords', () => {
      const candidate = { snippet: "Attended St. Mary's School", title: '' };
      expect(calculateKeyWordsScore(candidate, ["st. mary's"])).toBe(100);
    });

    it('should match substrings in longer text', () => {
      const candidate = { snippet: 'Graduate of Ohio University and worked at IBM', title: '' };
      expect(calculateKeyWordsScore(candidate, ['ohio university'])).toBe(100);
    });

    it('should return 0 when snippet and title are missing', () => {
      const candidate = {};
      expect(calculateKeyWordsScore(candidate, ['army'])).toBe(0);
    });
  });
});
