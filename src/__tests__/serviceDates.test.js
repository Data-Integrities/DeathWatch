const { extractVisitationDate, extractFuneralDate, extractServiceDates } = require('../normalize/serviceDates');

describe('extractVisitationDate', () => {
  test('extracts "visitation will be held" pattern', () => {
    expect(extractVisitationDate('Visitation will be held on Friday, January 3, 2026')).toBe('2026-01-03');
    expect(extractVisitationDate('visitation will be held January 3, 2026 at the church')).toBe('2026-01-03');
  });

  test('extracts "visitation on" pattern', () => {
    expect(extractVisitationDate('Visitation on Thursday, January 2, 2026')).toBe('2026-01-02');
  });

  test('extracts "viewing" pattern', () => {
    expect(extractVisitationDate('Viewing will be held on December 30, 2025')).toBe('2025-12-30');
    expect(extractVisitationDate('A viewing on January 5, 2026')).toBe('2026-01-05');
  });

  test('extracts "calling hours" pattern', () => {
    expect(extractVisitationDate('Calling hours will be on Friday, January 3, 2026')).toBe('2026-01-03');
  });

  test('extracts "friends may call" pattern', () => {
    expect(extractVisitationDate('Friends may call on Thursday, January 2, 2026')).toBe('2026-01-02');
    expect(extractVisitationDate('Friends will be received on January 2, 2026')).toBe('2026-01-02');
  });

  test('returns null for no visitation date', () => {
    expect(extractVisitationDate('John Smith passed away on January 1, 2026')).toBeNull();
    expect(extractVisitationDate('')).toBeNull();
    expect(extractVisitationDate(null)).toBeNull();
  });
});

describe('extractFuneralDate', () => {
  test('extracts "funeral service" pattern', () => {
    expect(extractFuneralDate('Funeral service will be held on Saturday, January 4, 2026')).toBe('2026-01-04');
    expect(extractFuneralDate('Funeral services on January 4, 2026')).toBe('2026-01-04');
  });

  test('extracts "memorial service" pattern', () => {
    expect(extractFuneralDate('A memorial service will be held January 10, 2026')).toBe('2026-01-10');
    expect(extractFuneralDate('Memorial services on Saturday, January 4, 2026')).toBe('2026-01-04');
  });

  test('extracts "celebration of life" pattern', () => {
    expect(extractFuneralDate('Celebration of life will be held on January 15, 2026')).toBe('2026-01-15');
  });

  test('extracts "service will be held" pattern', () => {
    expect(extractFuneralDate('Service will be held on Monday, January 6, 2026')).toBe('2026-01-06');
  });

  test('extracts "graveside service" pattern', () => {
    expect(extractFuneralDate('Graveside service will be held January 5, 2026')).toBe('2026-01-05');
  });

  test('extracts "burial" pattern', () => {
    expect(extractFuneralDate('Burial will be on January 4, 2026 at Oak Hill Cemetery')).toBe('2026-01-04');
  });

  test('extracts "interment" pattern', () => {
    expect(extractFuneralDate('Interment will be held on January 4, 2026')).toBe('2026-01-04');
  });

  test('returns null for no funeral date', () => {
    expect(extractFuneralDate('John Smith passed away on January 1, 2026')).toBeNull();
    expect(extractFuneralDate('')).toBeNull();
    expect(extractFuneralDate(null)).toBeNull();
  });
});

describe('extractServiceDates', () => {
  test('extracts both visitation and funeral', () => {
    const text = 'Visitation will be on Friday, January 3, 2026. Funeral service on Saturday, January 4, 2026.';
    const result = extractServiceDates(text);
    expect(result.visitation).toBe('2026-01-03');
    expect(result.funeral).toBe('2026-01-04');
  });

  test('extracts only visitation when funeral not present', () => {
    const text = 'Visitation will be held January 3, 2026. Private burial.';
    const result = extractServiceDates(text);
    expect(result.visitation).toBe('2026-01-03');
    expect(result.funeral).toBeNull();
  });

  test('extracts only funeral when visitation not present', () => {
    const text = 'Memorial service will be held on January 10, 2026.';
    const result = extractServiceDates(text);
    expect(result.visitation).toBeNull();
    expect(result.funeral).toBe('2026-01-10');
  });

  test('returns nulls when neither present', () => {
    const result = extractServiceDates('John Smith, age 86, of Hamilton, Ohio.');
    expect(result.visitation).toBeNull();
    expect(result.funeral).toBeNull();
  });
});
