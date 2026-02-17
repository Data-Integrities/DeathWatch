const { generateFingerprint, parseFingerprint, fingerprintsMatch } = require('../dedupe/fingerprint');
const { deduplicateCandidates } = require('../dedupe/dedupe');

describe('Fingerprint Generation', () => {
  describe('generateFingerprint', () => {
    it('should generate consistent fingerprint', () => {
      const fp1 = generateFingerprint({
        nameLast: 'Smith',
        nameFirst: 'James',
        city: 'Hamilton',
        state: 'OH',
        dod: '2024-01-15'
      });
      const fp2 = generateFingerprint({
        nameLast: 'Smith',
        nameFirst: 'James',
        city: 'Hamilton',
        state: 'OH',
        dod: '2024-01-15'
      });
      expect(fp1).toBe(fp2);
    });

    it('should normalize case', () => {
      const fp1 = generateFingerprint({
        nameLast: 'SMITH',
        nameFirst: 'JAMES',
        city: 'HAMILTON',
        state: 'oh',
        dod: '2024-01-15'
      });
      const fp2 = generateFingerprint({
        nameLast: 'Smith',
        nameFirst: 'James',
        city: 'Hamilton',
        state: 'OH',
        dod: '2024-01-15'
      });
      expect(fp1).toBe(fp2);
    });

    it('should handle missing fields', () => {
      const fp = generateFingerprint({
        nameLast: 'Smith',
        nameFirst: 'James'
      });
      expect(fp).toContain('unknown');
    });

    it('should use first initial only', () => {
      const fp1 = generateFingerprint({
        nameLast: 'Smith',
        nameFirst: 'James',
        city: 'Hamilton',
        state: 'OH'
      });
      const fp2 = generateFingerprint({
        nameLast: 'Smith',
        nameFirst: 'Jim',  // Different name, same initial
        city: 'Hamilton',
        state: 'OH'
      });
      expect(fp1).toBe(fp2);  // Should match due to same initial
    });
  });

  describe('fingerprintsMatch', () => {
    it('should match identical fingerprints', () => {
      expect(fingerprintsMatch(
        'smith-j-hamilton-oh-2024-01-15',
        'smith-j-hamilton-oh-2024-01-15'
      )).toBe(true);
    });

    it('should not match different fingerprints', () => {
      expect(fingerprintsMatch(
        'smith-j-hamilton-oh-2024-01-15',
        'smith-r-hamilton-oh-2024-01-15'
      )).toBe(false);
    });
  });
});

describe('Deduplication', () => {
  const makeCandidate = (overrides) => ({
    id: 'test-1',
    nameFull: 'James Smith',
    nameFirst: 'James',
    nameLast: 'Smith',
    ageYears: 71,
    city: 'Hamilton',
    state: 'OH',
    source: 'Test',
    url: 'https://example.com/1',
    snippet: 'Test snippet',
    score: 50,
    reasons: [],
    fingerprint: 'smith-j-hamilton-oh-2024-01-15',
    typeProvider: 'native',
    ...overrides
  });

  describe('deduplicateCandidates', () => {
    it('should keep single candidates unchanged', () => {
      const candidates = [makeCandidate({})];
      const result = deduplicateCandidates(candidates);
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/1');
    });

    it('should merge duplicates and keep highest score', () => {
      const candidates = [
        makeCandidate({ id: '1', score: 60, url: 'https://example.com/1' }),
        makeCandidate({ id: '2', score: 80, url: 'https://example.com/2' })
      ];
      const result = deduplicateCandidates(candidates);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(80);
      expect(result[0].alsoFoundAt).toContain('https://example.com/1');
    });

    it('should keep different fingerprints separate', () => {
      const candidates = [
        makeCandidate({ fingerprint: 'smith-j-hamilton-oh-2024-01-15' }),
        makeCandidate({ fingerprint: 'smith-r-cleveland-oh-2024-02-10' })
      ];
      const result = deduplicateCandidates(candidates);
      expect(result).toHaveLength(2);
    });

    it('should prefer native provider data', () => {
      const candidates = [
        makeCandidate({
          id: '1',
          score: 80,
          nameFull: 'James William Smith',
          typeProvider: 'native',
          url: 'https://native.com/1'
        }),
        makeCandidate({
          id: '2',
          score: 90,  // Higher score
          nameFull: 'J. Smith',  // Less complete name
          typeProvider: 'google',
          url: 'https://google.com/1'
        })
      ];
      const result = deduplicateCandidates(candidates);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(90);  // Highest score
      expect(result[0].nameFull).toBe('James William Smith');  // Native data
    });
  });
});
