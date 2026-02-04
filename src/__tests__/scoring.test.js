const { calculateScore, scoreCandidate } = require('../scoring/score');
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
});
