const { extractVisitationDate, extractFuneralDate, extractServiceDates, inferYearFromDod } = require('../normalize/serviceDates');

describe('inferYearFromDod', () => {
  test('same year when service is after DOD', () => {
    expect(inferYearFromDod('January', '5', '2026-01-02')).toBe('2026-01-05');
    expect(inferYearFromDod('March', '20', '2025-03-15')).toBe('2025-03-20');
  });

  test('next year when service month/day is before DOD (year-end cusp)', () => {
    expect(inferYearFromDod('January', '3', '2025-12-29')).toBe('2026-01-03');
    expect(inferYearFromDod('Jan', '2', '2025-12-30')).toBe('2026-01-02');
  });

  test('same day as DOD is valid', () => {
    expect(inferYearFromDod('December', '29', '2025-12-29')).toBe('2025-12-29');
  });

  test('returns null without DOD', () => {
    expect(inferYearFromDod('January', '5', null)).toBeNull();
  });
});

describe('extractVisitationDate', () => {
  test('extracts with full year', () => {
    expect(extractVisitationDate('Visitation will be held on Friday, January 3, 2026')).toBe('2026-01-03');
  });

  test('infers year from DOD', () => {
    expect(extractVisitationDate('Visitation on Friday, January 3', '2025-12-29')).toBe('2026-01-03');
    expect(extractVisitationDate('Viewing will be held March 20', '2025-03-15')).toBe('2025-03-20');
  });

  test('extracts "calling hours" with year inference', () => {
    expect(extractVisitationDate('Calling hours will be on Friday, January 3', '2025-12-30')).toBe('2026-01-03');
  });

  test('extracts "friends may call" with year inference', () => {
    expect(extractVisitationDate('Friends may call on Thursday, January 2', '2025-12-29')).toBe('2026-01-02');
  });

  test('returns null for no visitation date', () => {
    expect(extractVisitationDate('John Smith passed away on January 1, 2026')).toBeNull();
    expect(extractVisitationDate('')).toBeNull();
    expect(extractVisitationDate(null)).toBeNull();
  });
});

describe('extractFuneralDate', () => {
  test('extracts with full year', () => {
    expect(extractFuneralDate('Funeral service will be held on Saturday, January 4, 2026')).toBe('2026-01-04');
  });

  test('infers year from DOD', () => {
    expect(extractFuneralDate('Funeral service on Saturday, January 4', '2025-12-29')).toBe('2026-01-04');
    expect(extractFuneralDate('Memorial service will be held January 10', '2026-01-05')).toBe('2026-01-10');
  });

  test('extracts "the service will be at" pattern', () => {
    expect(extractFuneralDate('The service will be at 12 noon, Friday, Feb 6th', '2026-01-30')).toBe('2026-02-06');
  });

  test('extracts "memorial gathering" pattern', () => {
    expect(extractFuneralDate('A memorial gathering will be held to honor Charles on Saturday June 26', '2020-06-15')).toBe('2020-06-26');
  });

  test('extracts "celebration of life" with year inference', () => {
    expect(extractFuneralDate('Celebration of life will be held on January 15', '2026-01-10')).toBe('2026-01-15');
  });

  test('extracts "graveside service" with year inference', () => {
    expect(extractFuneralDate('Graveside service will be held January 5', '2026-01-02')).toBe('2026-01-05');
  });

  test('returns null for no funeral date', () => {
    expect(extractFuneralDate('John Smith passed away on January 1, 2026')).toBeNull();
    expect(extractFuneralDate('')).toBeNull();
    expect(extractFuneralDate(null)).toBeNull();
  });
});

describe('extractServiceDates', () => {
  test('extracts both with DOD inference', () => {
    const text = 'Visitation on Friday, January 3. Funeral service on Saturday, January 4.';
    const result = extractServiceDates(text, '2025-12-29');
    expect(result.visitation).toBe('2026-01-03');
    expect(result.funeral).toBe('2026-01-04');
  });

  test('handles real snippet with no year', () => {
    const text = 'The service will be at 12 noon, Friday, Feb 6th at the Cunningham Becker Funeral';
    const result = extractServiceDates(text, '2026-02-01');
    expect(result.funeral).toBe('2026-02-06');
  });

  test('returns nulls when neither present', () => {
    const result = extractServiceDates('John Smith, age 86, of Hamilton, Ohio.', '2026-01-01');
    expect(result.visitation).toBeNull();
    expect(result.funeral).toBeNull();
  });
});
