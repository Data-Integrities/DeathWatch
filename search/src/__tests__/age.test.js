const {
  getAgeRange,
  isAgeInRange,
  isAgeInExplicitRange,
  calculateAge,
  extractAgeFromText
} = require('../normalize/age');

describe('Age Utilities', () => {
  describe('getAgeRange', () => {
    it('should return range with default window', () => {
      const range = getAgeRange(71);
      expect(range.min).toBe(65);  // 71 - 6
      expect(range.max).toBe(77);  // 71 + 6
    });

    it('should use custom window when provided', () => {
      const range = getAgeRange(71, 10);
      expect(range.min).toBe(61);  // 71 - 10
      expect(range.max).toBe(81);  // 71 + 10
    });
  });

  describe('isAgeInRange', () => {
    it('should return true for age within range', () => {
      expect(isAgeInRange(71, 71)).toBe(true);  // Exact match
      expect(isAgeInRange(68, 71)).toBe(true);  // Within window
      expect(isAgeInRange(75, 71)).toBe(true);  // Within window
    });

    it('should return true for edge cases', () => {
      expect(isAgeInRange(65, 71)).toBe(true);  // Min edge
      expect(isAgeInRange(77, 71)).toBe(true);  // Max edge
    });

    it('should return false for age outside range', () => {
      expect(isAgeInRange(64, 71)).toBe(false);  // Below min
      expect(isAgeInRange(78, 71)).toBe(false);  // Above max
    });

    it('should use custom window', () => {
      expect(isAgeInRange(60, 71, 12)).toBe(true);  // Within ±12
      expect(isAgeInRange(58, 71, 12)).toBe(false); // Outside ±12
    });
  });

  describe('isAgeInExplicitRange', () => {
    it('should check against explicit bounds', () => {
      expect(isAgeInExplicitRange(70, 65, 75)).toBe(true);
      expect(isAgeInExplicitRange(64, 65, 75)).toBe(false);
      expect(isAgeInExplicitRange(76, 65, 75)).toBe(false);
    });

    it('should handle missing bounds', () => {
      expect(isAgeInExplicitRange(70, 65, undefined)).toBe(true);
      expect(isAgeInExplicitRange(70, undefined, 75)).toBe(true);
      expect(isAgeInExplicitRange(70, undefined, undefined)).toBe(true);
    });
  });

  describe('calculateAge', () => {
    it('should calculate age from dob and dod', () => {
      const age = calculateAge('1953-03-15', '2024-01-15');
      expect(age).toBe(70);  // Birthday not yet in 2024
    });

    it('should calculate age to current date if no dod', () => {
      const age = calculateAge('2000-01-01');
      expect(age).toBeGreaterThan(20);
    });

    it('should handle birthday edge cases', () => {
      // Born March 15, died March 16 - should be 71
      const age = calculateAge('1953-03-15', '2024-03-16');
      expect(age).toBe(71);
    });

    it('should return undefined for invalid dates', () => {
      expect(calculateAge('invalid')).toBeUndefined();
    });
  });

  describe('extractAgeFromText', () => {
    it('should extract "age X" pattern', () => {
      expect(extractAgeFromText('John Smith, age 71, of Hamilton')).toBe(71);
      expect(extractAgeFromText('Smith, aged 71')).toBe(71);
    });

    it('should extract "X years old" pattern', () => {
      expect(extractAgeFromText('John was 71 years old')).toBe(71);
      expect(extractAgeFromText('He was 68 year old')).toBe(68);
    });

    it('should extract comma-delimited age', () => {
      expect(extractAgeFromText('James Smith, 71, Hamilton OH')).toBe(71);
    });

    it('should return undefined when no age found', () => {
      expect(extractAgeFromText('John Smith of Hamilton')).toBeUndefined();
    });

    it('should reject implausible ages', () => {
      expect(extractAgeFromText('age 200')).toBeUndefined();
      expect(extractAgeFromText('age 0')).toBeUndefined();
    });
  });
});
