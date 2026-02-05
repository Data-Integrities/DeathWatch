const { extractDodFromText, extractDeathYear } = require('../normalize/dod');

describe('extractDodFromText', () => {
  test('extracts "passed away on" pattern', () => {
    expect(extractDodFromText('passed away on Monday, December 29, 2025')).toBe('2025-12-29');
    expect(extractDodFromText('passed away on December 29, 2025')).toBe('2025-12-29');
    expect(extractDodFromText('He passed away on January 15, 2026 at home')).toBe('2026-01-15');
  });

  test('extracts "died" pattern', () => {
    expect(extractDodFromText('died on January 15, 2026')).toBe('2026-01-15');
    expect(extractDodFromText('died January 15, 2026')).toBe('2026-01-15');
    expect(extractDodFromText('She died on Friday, March 3, 2025')).toBe('2025-03-03');
  });

  test('extracts "passed" without "away"', () => {
    expect(extractDodFromText('passed on February 10, 2025')).toBe('2025-02-10');
    expect(extractDodFromText('passed February 10, 2025')).toBe('2025-02-10');
  });

  test('extracts religious phrases', () => {
    expect(extractDodFromText('went to be with the Lord on January 24, 2026')).toBe('2026-01-24');
    expect(extractDodFromText('called home on March 15, 2025')).toBe('2025-03-15');
  });

  test('extracts date ranges (birth-death)', () => {
    expect(extractDodFromText('April 24, 1935 - January 2, 2026')).toBe('2026-01-02');
    expect(extractDodFromText('(March 1, 1950 – December 29, 2025)')).toBe('2025-12-29');
  });

  test('extracts year-only ranges', () => {
    expect(extractDodFromText('John Smith (1939 - 2025)')).toBe('2025-01-01');
    expect(extractDodFromText('1950-2026')).toBe('2026-01-01');
  });

  test('extracts loose dates in obituary context', () => {
    expect(extractDodFromText('Obituary: services held December 30, 2025')).toBe('2025-12-30');
  });

  test('returns null for no date', () => {
    expect(extractDodFromText('John Smith, age 86, of Hamilton')).toBeNull();
    expect(extractDodFromText('')).toBeNull();
    expect(extractDodFromText(null)).toBeNull();
  });

  test('handles abbreviated months', () => {
    expect(extractDodFromText('passed away on Dec 29, 2025')).toBe('2025-12-29');
    expect(extractDodFromText('died Jan 15, 2026')).toBe('2026-01-15');
  });
});

describe('extractDeathYear', () => {
  test('extracts year from DOD', () => {
    expect(extractDeathYear('passed away December 29, 2025')).toBe(2025);
    expect(extractDeathYear('(1939-2026)')).toBe(2026);
  });

  test('returns null when no date', () => {
    expect(extractDeathYear('No date here')).toBeNull();
  });
});
