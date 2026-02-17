const {
  extractNameFromTitle,
  extractNameFromSnippet,
  extractNameFromUrl,
  isValidParsedName,
  isGenericTitle
} = require('../normalize/nameExtract');

describe('Name Extraction', () => {

  describe('extractNameFromTitle', () => {

    // === Pattern 1: Smashed dates (funeral home "NameDate" format) ===
    describe('smashed date titles', () => {
      it('should strip date smashed onto name (Newcomer format)', () => {
        const result = extractNameFromTitle('Antonio "Tony" AvilaFebruary 4, 2026');
        expect(result.nameFirst).toBe('Antonio');
        expect(result.nameLast).toBe('Avila');
      });

      it('should strip date smashed onto name (no nickname)', () => {
        const result = extractNameFromTitle('Stephen KellyFebruary 7, 2026');
        expect(result.nameFirst).toBe('Stephen');
        expect(result.nameLast).toBe('Kelly');
      });

      it('should strip date smashed onto name with Jr. suffix', () => {
        const result = extractNameFromTitle('John R. Taffner Jr.February 8, 2026');
        expect(result.nameFirst).toBe('John');
        expect(result.nameLast).toBe('Taffner');
      });

      it('should strip date smashed with no comma', () => {
        const result = extractNameFromTitle('Mary JohnsonJanuary 15 2026');
        expect(result.nameFirst).toBe('Mary');
        expect(result.nameLast).toBe('Johnson');
      });

      it('should handle date with space before it', () => {
        const result = extractNameFromTitle('Robert Williams February 10, 2026');
        expect(result.nameFirst).toBe('Robert');
        expect(result.nameLast).toBe('Williams');
      });
    });

    // === Pattern 2: Facebook post titles ===
    describe('Facebook-style long titles', () => {
      it('should strip "Passed away on..." continuation', () => {
        const result = extractNameFromTitle('Lucy J. Little Passed away on February 5, 2026 at the age of 92');
        expect(result.nameFirst).toBe('Lucy');
        expect(result.nameLast).toBe('Little');
      });

      it('should strip location + "Passed away on..."', () => {
        const result = extractNameFromTitle('Patricia M. Pierce Rochester, New York Passed away on, February 7');
        expect(result.nameFirst).toBe('Patricia');
        expect(result.nameLast).toBe('Pierce');
      });

      it('should strip "and service information..."', () => {
        const result = extractNameFromTitle('Linda K. R. Etter Anand service information will be published soon');
        // "Anand" starts a sentence continuation - tricky, but "service information" should trigger
        // The key thing is we don't get "soon" as last name
        expect(result.nameFirst).toBe('Linda');
        expect(result.nameLast).not.toBe('soon');
      });
    });

    // === Pattern 3: Memorial Website suffix ===
    describe('memorial website suffixes', () => {
      it('should strip "\'s Memorial Website"', () => {
        const result = extractNameFromTitle('Ruth "Granny" M Foster\'s Memorial Website');
        expect(result.nameFirst).toBe('Ruth');
        expect(result.nameLast).toBe('Foster');
      });

      it('should strip "Memorial Website" without possessive', () => {
        const result = extractNameFromTitle('John Smith Memorial Website');
        expect(result.nameFirst).toBe('John');
        expect(result.nameLast).toBe('Smith');
      });

      it('should strip "Tribute Wall"', () => {
        const result = extractNameFromTitle('Jane Doe\'s Tribute Wall');
        expect(result.nameFirst).toBe('Jane');
        expect(result.nameLast).toBe('Doe');
      });
    });

    // === Pattern 4: Social media garbage ===
    describe('social media titles', () => {
      it('should strip Instagram username and bullet', () => {
        const result = extractNameFromTitle('Anna Lander (@annalander7272) • Instagram photos and videos');
        expect(result.nameFirst).toBe('Anna');
        expect(result.nameLast).toBe('Lander');
      });

      it('should strip "| Facebook" suffix', () => {
        const result = extractNameFromTitle('John Smith | Facebook');
        expect(result.nameFirst).toBe('John');
        expect(result.nameLast).toBe('Smith');
      });

      it('should strip "on Instagram"', () => {
        const result = extractNameFromTitle('Jane Doe on Instagram');
        expect(result.nameFirst).toBe('Jane');
        expect(result.nameLast).toBe('Doe');
      });
    });

    // === Pattern 5: Hyphenated last names ===
    describe('hyphenated last names', () => {
      it('should preserve hyphenated last name (Gonzalez-Irizarry)', () => {
        const result = extractNameFromTitle('Maria Gonzalez-Irizarry Obituary');
        expect(result.nameFirst).toBe('Maria');
        expect(result.nameLast).toBe('Gonzalez-Irizarry');
      });

      it('should still strip em-dash delimiters with spaces', () => {
        const result = extractNameFromTitle('John Smith — Legacy.com');
        expect(result.nameFirst).toBe('John');
        expect(result.nameLast).toBe('Smith');
      });

      it('should still strip dash delimiters with spaces', () => {
        const result = extractNameFromTitle('John Smith - Newcomer Funeral Home');
        expect(result.nameFirst).toBe('John');
        expect(result.nameLast).toBe('Smith');
      });

      it('should still strip pipe delimiters', () => {
        const result = extractNameFromTitle('John Smith | Obituary | Legacy.com');
        expect(result.nameFirst).toBe('John');
        expect(result.nameLast).toBe('Smith');
      });
    });

    // === Pattern 6: Month/day names as real surnames ===
    describe('names that are also month/day words', () => {
      it('should extract "Jesse May" (May is a real surname)', () => {
        const result = extractNameFromTitle('Jesse Gerald May Obituary - Newcomer Dayton');
        expect(result.nameFirst).toBe('Jesse');
        expect(result.nameLast).toBe('May');
      });

      it('should extract "May" as last name from year-range title', () => {
        const result = extractNameFromTitle('Jesse May (1930 - 2026) - Beavercreek, OH');
        expect(result.nameFirst).toBe('Jesse');
        expect(result.nameLast).toBe('May');
      });

      it('should extract "April" as last name', () => {
        const result = extractNameFromTitle('Virginia April Obituary');
        expect(result.nameFirst).toBe('Virginia');
        expect(result.nameLast).toBe('April');
      });

      it('should extract "June" as last name', () => {
        const result = extractNameFromTitle('Robert June - Legacy.com');
        expect(result.nameFirst).toBe('Robert');
        expect(result.nameLast).toBe('June');
      });

      it('should still strip smashed dates (month as date, not name)', () => {
        const result = extractNameFromTitle('Stephen KellyMay 7, 2026');
        expect(result.nameFirst).toBe('Stephen');
        expect(result.nameLast).toBe('Kelly');
      });
    });

    // === Existing functionality (regression tests) ===
    describe('standard title formats', () => {
      it('should parse simple "First Last" title', () => {
        const result = extractNameFromTitle('James Smith');
        expect(result.nameFirst).toBe('James');
        expect(result.nameLast).toBe('Smith');
      });

      it('should parse "First Middle Last" title', () => {
        const result = extractNameFromTitle('James William Smith');
        expect(result.nameFirst).toBe('James');
        expect(result.nameLast).toBe('Smith');
      });

      it('should parse title with middle initial', () => {
        const result = extractNameFromTitle('James W. Smith');
        expect(result.nameFirst).toBe('James');
        expect(result.nameLast).toBe('Smith');
      });

      it('should strip "Obituary for" prefix', () => {
        const result = extractNameFromTitle('Obituary for James Smith');
        expect(result.nameFirst).toBe('James');
        expect(result.nameLast).toBe('Smith');
      });

      it('should strip "In Memory of" prefix', () => {
        const result = extractNameFromTitle('In Memory of James Smith');
        expect(result.nameFirst).toBe('James');
        expect(result.nameLast).toBe('Smith');
      });

      it('should strip pipe-delimited suffix', () => {
        const result = extractNameFromTitle('James Smith | Legacy.com');
        expect(result.nameFirst).toBe('James');
        expect(result.nameLast).toBe('Smith');
      });

      it('should strip trailing age', () => {
        const result = extractNameFromTitle('James Smith, 71');
        expect(result.nameFirst).toBe('James');
        expect(result.nameLast).toBe('Smith');
      });

      it('should strip year range', () => {
        const result = extractNameFromTitle('James Smith 1955-2026');
        expect(result.nameFirst).toBe('James');
        expect(result.nameLast).toBe('Smith');
      });

      it('should strip parenthetical year', () => {
        const result = extractNameFromTitle('James Smith (1955');
        expect(result.nameFirst).toBe('James');
        expect(result.nameLast).toBe('Smith');
      });

      it('should strip parenthetical MM/DD/YYYY date', () => {
        const result = extractNameFromTitle('Thomas Malone(02/16/1943');
        expect(result.nameFirst).toBe('Thomas');
        expect(result.nameLast).toBe('Malone');
      });

      it('should remove Jr. suffix but still extract name', () => {
        const result = extractNameFromTitle('James Smith Jr.');
        expect(result.nameFirst).toBe('James');
        expect(result.nameLast).toBe('Smith');
      });

      it('should strip honorifics', () => {
        const result = extractNameFromTitle('Dr. James Smith');
        expect(result.nameFirst).toBe('James');
        expect(result.nameLast).toBe('Smith');
      });

      it('should return nameFull for single word', () => {
        const result = extractNameFromTitle('Smith');
        expect(result.nameFirst).toBeUndefined();
        expect(result.nameLast).toBeUndefined();
      });

      it('should handle empty string', () => {
        const result = extractNameFromTitle('');
        expect(result.nameFull).toBeNull();
      });

      it('should handle null', () => {
        const result = extractNameFromTitle(null);
        expect(result.nameFull).toBeNull();
      });
    });
  });

  describe('extractNameFromSnippet', () => {
    it('should extract from "LASTNAME, Firstname" pattern', () => {
      const snippet = 'KELLY, Stephen "Steve" age 72, of Springfield...';
      const query = { nameLast: 'Kelly' };
      const result = extractNameFromSnippet(snippet, query);
      expect(result.nameFirst).toBe('Stephen');
      expect(result.nameLast).toBe('Kelly');
    });

    it('should extract from "passed away" pattern', () => {
      const snippet = 'John Michael Smith passed away on February 5, 2026.';
      const result = extractNameFromSnippet(snippet, {});
      expect(result.nameFirst).toBe('John');
      expect(result.nameLast).toBe('Smith');
    });

    it('should extract from "name, age," pattern', () => {
      const snippet = 'James William Smith, 71, of Hamilton, OH...';
      const result = extractNameFromSnippet(snippet, {});
      expect(result.nameFirst).toBe('James');
      expect(result.nameLast).toBe('Smith');
    });

    it('should find name using query lastName hint', () => {
      const snippet = 'Services for Antonio Avila will be held...';
      const query = { nameLast: 'Avila' };
      const result = extractNameFromSnippet(snippet, query);
      expect(result.nameFirst).toBe('Antonio');
      expect(result.nameLast).toBe('Avila');
    });

    it('should return null for empty snippet', () => {
      const result = extractNameFromSnippet('', {});
      expect(result.nameFull).toBeNull();
    });

    it('should return null for null snippet', () => {
      const result = extractNameFromSnippet(null, {});
      expect(result.nameFull).toBeNull();
    });
  });

  describe('extractNameFromUrl', () => {
    it('should extract from /obituaries/firstname-lastname URL', () => {
      const result = extractNameFromUrl('https://www.newcomertoledo.com/obituaries/antonio-avila');
      expect(result.nameFirst).toBe('Antonio');
      expect(result.nameLast).toBe('Avila');
    });

    it('should extract from /obituary/ path', () => {
      const result = extractNameFromUrl('https://www.legacy.com/obituary/john-smith');
      expect(result.nameFirst).toBe('John');
      expect(result.nameLast).toBe('Smith');
    });

    it('should handle three-part names', () => {
      const result = extractNameFromUrl('https://www.example.com/obituaries/john-michael-smith');
      expect(result.nameFirst).toBe('John');
      expect(result.nameLast).toBe('Smith');
      expect(result.nameFull).toBe('John Michael Smith');
    });

    it('should return null for non-obituary URLs', () => {
      const result = extractNameFromUrl('https://www.google.com/search?q=test');
      expect(result.nameFull).toBeNull();
    });

    it('should return null for null URL', () => {
      const result = extractNameFromUrl(null);
      expect(result.nameFull).toBeNull();
    });

    it('should return null for invalid URL', () => {
      const result = extractNameFromUrl('not-a-url');
      expect(result.nameFull).toBeNull();
    });
  });

  describe('isValidParsedName', () => {
    it('should accept normal names', () => {
      expect(isValidParsedName('James', 'Smith')).toBe(true);
    });

    it('should accept "May" as a last name', () => {
      expect(isValidParsedName('Jesse', 'May')).toBe(true);
    });

    it('should accept "April" as a last name', () => {
      expect(isValidParsedName('John', 'April')).toBe(true);
    });

    it('should accept "June" as a last name', () => {
      expect(isValidParsedName('Sarah', 'June')).toBe(true);
    });

    it('should accept "March" as a last name', () => {
      expect(isValidParsedName('Fredric', 'March')).toBe(true);
    });

    it('should accept "May" as a first name', () => {
      expect(isValidParsedName('May', 'Wilson')).toBe(true);
    });

    it('should accept "April" as a first name', () => {
      expect(isValidParsedName('April', 'Jones')).toBe(true);
    });

    it('should accept "Tuesday" as a first name', () => {
      expect(isValidParsedName('Tuesday', 'Weld')).toBe(true);
    });

    it('should reject year as last name', () => {
      expect(isValidParsedName('John', '2026')).toBe(false);
    });

    it('should reject "videos" as last name', () => {
      expect(isValidParsedName('Anna', 'videos')).toBe(false);
    });

    it('should reject "Website" as last name', () => {
      expect(isValidParsedName('Ruth', 'Website')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isValidParsedName(null, 'Smith')).toBe(false);
      expect(isValidParsedName('John', null)).toBe(false);
    });

    it('should reject pure digits', () => {
      expect(isValidParsedName('John', '123')).toBe(false);
    });
  });

  describe('isGenericTitle', () => {
    it('should identify "Obituaries for..." as generic', () => {
      expect(isGenericTitle('Obituaries for Springfield')).toBe(true);
    });

    it('should identify "Recent obituaries" as generic', () => {
      expect(isGenericTitle('Recent obituaries')).toBe(true);
    });

    it('should not flag a real name as generic', () => {
      expect(isGenericTitle('James Smith')).toBe(false);
    });

    it('should flag single-word titles', () => {
      expect(isGenericTitle('Obituary')).toBe(true);
    });

    it('should flag null/empty', () => {
      expect(isGenericTitle(null)).toBe(true);
      expect(isGenericTitle('')).toBe(true);
    });
  });
});
