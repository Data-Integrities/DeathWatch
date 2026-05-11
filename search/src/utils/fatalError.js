const { logger } = require('./logger');

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function reportFatalError(source, errorCode, message) {
  logger.error(`[FATAL] ${source}${errorCode ? ' ' + errorCode : ''}: ${message}`);
  try {
    await fetch(`${API_URL}/api/internal/fatal-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, errorCode, message }),
    });
  } catch (err) {
    logger.error('[FATAL] Failed to report fatal error to API:', err.message);
  }
}

module.exports = { reportFatalError };
