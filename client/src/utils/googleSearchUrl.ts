import type { SearchQuery } from '../types';

const stateNames: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
  SK: 'Saskatchewan', YT: 'Yukon',
};

/**
 * Build a Google search URL from the user's search fields.
 * Mirrors the exact query that SerperProvider._buildQuery() sends to Serper,
 * using only user-input data (no external/scraped data).
 */
export function buildGoogleSearchUrl(search: SearchQuery): string {
  const parts: string[] = [];

  // If nickname is provided and different from nameFirst, use OR clause
  if (search.nameNickname && search.nameFirst &&
      search.nameNickname.toLowerCase() !== search.nameFirst.toLowerCase()) {
    const first = capitalize(search.nameFirst);
    const nick = capitalize(search.nameNickname);
    parts.push(`(${first} OR ${nick})`);
  } else if (search.nameFirst) {
    parts.push(search.nameFirst);
  }

  if (search.nameLast) {
    parts.push(search.nameLast);
  }

  parts.push('obituary');

  if (search.city) {
    parts.push(search.city);
  }
  if (search.state) {
    parts.push(stateNames[search.state] || search.state);
  }

  const query = parts.join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
