/**
 * Build a Google search query string from normalized search parameters
 */
function buildGoogleQuery(query) {
  const parts = [];

  // Name parts
  parts.push(query.firstName);
  parts.push(query.lastName);

  // Add "obituary" keyword
  parts.push('obituary');

  // Location
  if (query.city) {
    parts.push(query.city);
  }
  if (query.state) {
    parts.push(query.state);
  }

  return parts.join(' ');
}

/**
 * Build URL for Google Custom Search API
 */
function buildGoogleApiUrl(query, apiKey, cseId) {
  const params = new URLSearchParams({
    key: apiKey,
    cx: cseId,
    q: query,
    num: '10'
  });

  return `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
}

module.exports = {
  buildGoogleQuery,
  buildGoogleApiUrl
};
