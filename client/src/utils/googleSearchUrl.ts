import type { SearchQuery } from '../types';

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
    parts.push(search.state);
  }

  const query = parts.join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
