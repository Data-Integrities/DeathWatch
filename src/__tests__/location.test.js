const {
  normalizeState,
  normalizeCity,
  citiesMatch,
  statesMatch,
  getCityVariants
} = require('../normalize/location');

describe('Location Normalization', () => {
  describe('normalizeState', () => {
    it('should return valid state codes unchanged', () => {
      expect(normalizeState('OH')).toBe('OH');
      expect(normalizeState('CA')).toBe('CA');
      expect(normalizeState('NY')).toBe('NY');
    });

    it('should convert full state names to codes', () => {
      expect(normalizeState('Ohio')).toBe('OH');
      expect(normalizeState('california')).toBe('CA');
      expect(normalizeState('New York')).toBe('NY');
    });

    it('should handle lowercase state codes', () => {
      expect(normalizeState('oh')).toBe('OH');
    });

    it('should handle extra whitespace', () => {
      expect(normalizeState('  OH  ')).toBe('OH');
    });
  });

  describe('normalizeCity', () => {
    it('should lowercase and trim cities', () => {
      expect(normalizeCity('  Hamilton  ')).toBe('hamilton');
      expect(normalizeCity('CLEVELAND')).toBe('cleveland');
    });

    it('should normalize St to Saint', () => {
      expect(normalizeCity('St. Louis')).toBe('saint louis');
      expect(normalizeCity('St Louis')).toBe('saint louis');
    });

    it('should keep Saint as is', () => {
      expect(normalizeCity('Saint Louis')).toBe('saint louis');
    });
  });

  describe('citiesMatch', () => {
    it('should match identical cities', () => {
      expect(citiesMatch('Hamilton', 'Hamilton')).toBe(true);
    });

    it('should match case-insensitively', () => {
      expect(citiesMatch('HAMILTON', 'hamilton')).toBe(true);
    });

    it('should match St and Saint variations', () => {
      expect(citiesMatch('St. Louis', 'Saint Louis')).toBe(true);
      expect(citiesMatch('St Louis', 'Saint Louis')).toBe(true);
    });

    it('should not match different cities', () => {
      expect(citiesMatch('Hamilton', 'Cincinnati')).toBe(false);
    });
  });

  describe('statesMatch', () => {
    it('should match same state codes', () => {
      expect(statesMatch('OH', 'OH')).toBe(true);
    });

    it('should match code and full name', () => {
      expect(statesMatch('OH', 'Ohio')).toBe(true);
      expect(statesMatch('California', 'CA')).toBe(true);
    });

    it('should not match different states', () => {
      expect(statesMatch('OH', 'PA')).toBe(false);
    });
  });

  describe('getCityVariants', () => {
    it('should return both St and Saint variants', () => {
      const variants = getCityVariants('St. Louis');
      expect(variants).toContain('saint louis');
      expect(variants).toContain('st louis');
    });

    it('should return single variant for non-saint cities', () => {
      const variants = getCityVariants('Hamilton');
      expect(variants).toEqual(['hamilton']);
    });
  });
});
