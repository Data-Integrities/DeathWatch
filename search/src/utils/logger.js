const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

let currentLevel = LogLevel.INFO;

const logger = {
  setLevel(level) {
    currentLevel = level;
  },

  debug(...args) {
    if (currentLevel <= LogLevel.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  },

  info(...args) {
    if (currentLevel <= LogLevel.INFO) {
      console.log('[INFO]', ...args);
    }
  },

  warn(...args) {
    if (currentLevel <= LogLevel.WARN) {
      console.warn('[WARN]', ...args);
    }
  },

  error(...args) {
    if (currentLevel <= LogLevel.ERROR) {
      console.error('[ERROR]', ...args);
    }
  }
};

module.exports = { LogLevel, logger };
