const config = {
  ageWindowYears: 6,
  maxResults: 20,
  cacheDir: 'data/cache',
  dataDir: 'data',
  port: 3000,

  // Search provider: 'serper', 'serpapi', or 'google'
  searchProvider: process.env.SEARCH_PROVIDER || 'serper',

  google: {
    apiKey: process.env.GOOGLE_CSE_API_KEY || '',
    cseId: process.env.GOOGLE_CSE_ID || '',
    get isStubMode() {
      return !this.apiKey || !this.cseId;
    }
  },

  serpapi: {
    apiKey: process.env.SERPAPI_KEY || '',
    get isEnabled() {
      return !!this.apiKey;
    }
  },

  serper: {
    apiKey: process.env.SERPER_API_KEY || '',
    get isEnabled() {
      return !!this.apiKey;
    }
  },

  scoring: {
    lastNameExact: 35,
    cityExact: 20,
    stateExact: 15,
    ageInRange: 15,
    firstNameExact: 10,
    nicknameMatch: 6,
    middleInitial: 3,
    cityMismatchSameState: -10,
    ageOutsideRange: -15,
    lastNameMismatch: -35,
    firstNameMismatch: -10
  }
};

module.exports = config;
