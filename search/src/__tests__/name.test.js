const {
  normalizeName,
  getFirstInitial,
  getMiddleInitial,
  namesMatch,
  firstInitialsMatch
} = require('../normalize/name');

describe('Name Normalization', () => {
  describe('normalizeName', () => {
    it('should lowercase and trim names', () => {
      expect(normalizeName('  JAMES  ')).toBe('james');
      expect(normalizeName('Smith')).toBe('smith');
    });

    it('should remove punctuation', () => {
      expect(normalizeName("O'Brien")).toBe('obrien');
      expect(normalizeName('Smith-Jones')).toBe('smith-jones');
      expect(normalizeName('Dr. John')).toBe('dr john');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeName('Mary  Ann')).toBe('mary ann');
    });
  });

  describe('getFirstInitial', () => {
    it('should return first character lowercase', () => {
      expect(getFirstInitial('James')).toBe('j');
      expect(getFirstInitial('ROBERT')).toBe('r');
    });

    it('should handle empty strings', () => {
      expect(getFirstInitial('')).toBe('');
    });
  });

  describe('getMiddleInitial', () => {
    it('should return first character of middle name', () => {
      expect(getMiddleInitial('William')).toBe('w');
      expect(getMiddleInitial('A')).toBe('a');
    });

    it('should return undefined for undefined input', () => {
      expect(getMiddleInitial(undefined)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(getMiddleInitial('')).toBeUndefined();
    });
  });

  describe('namesMatch', () => {
    it('should match identical names', () => {
      expect(namesMatch('James', 'James')).toBe(true);
    });

    it('should match case-insensitively', () => {
      expect(namesMatch('JAMES', 'james')).toBe(true);
    });

    it('should match after trimming', () => {
      expect(namesMatch('  James  ', 'James')).toBe(true);
    });

    it('should not match different names', () => {
      expect(namesMatch('James', 'John')).toBe(false);
    });
  });

  describe('firstInitialsMatch', () => {
    it('should match same initials', () => {
      expect(firstInitialsMatch('James', 'John')).toBe(true);
      expect(firstInitialsMatch('Robert', 'Richard')).toBe(true);
    });

    it('should not match different initials', () => {
      expect(firstInitialsMatch('James', 'Robert')).toBe(false);
    });
  });
});
