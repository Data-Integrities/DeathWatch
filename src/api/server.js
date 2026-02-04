require('dotenv').config();
const express = require('express');
const { searchObits, normalizeQuery } = require('../index');
const { exclusionStore } = require('../data/ExclusionStore');
const config = require('../config');
const { logger } = require('../utils/logger');

const app = express();
app.use(express.json());

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  logger.error('API Error:', err);
  res.status(500).json({ error: err.message });
};

// Search endpoint
app.get('/search', async (req, res, next) => {
  try {
    const query = {
      firstName: req.query.firstName,
      lastName: req.query.lastName,
      middleName: req.query.middleName,
      city: req.query.city,
      state: req.query.state,
      age: req.query.age ? parseInt(req.query.age, 10) : undefined
    };

    if (!query.firstName || !query.lastName) {
      res.status(400).json({ error: 'firstName and lastName are required' });
      return;
    }

    const result = await searchObits(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Add exclusion endpoint
app.post('/exclude', async (req, res, next) => {
  try {
    const { searchKey, fingerprint, url, name, reason } = req.body;

    if (!searchKey || !fingerprint) {
      res.status(400).json({ error: 'searchKey and fingerprint are required' });
      return;
    }

    const exclusion = exclusionStore.add({
      searchKey,
      excludedFingerprint: fingerprint,
      excludedUrl: url,
      excludedName: name,
      reason
    });

    res.json({ exclusion });
  } catch (err) {
    next(err);
  }
});

// List exclusions endpoint
app.get('/exclusions', async (req, res, next) => {
  try {
    const searchKey = req.query.searchKey;

    if (!searchKey) {
      res.status(400).json({ error: 'searchKey query parameter is required' });
      return;
    }

    const exclusions = exclusionStore.getBySearchKey(searchKey);
    res.json({ exclusions });
  } catch (err) {
    next(err);
  }
});

// Remove exclusion endpoint
app.delete('/exclude/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const success = exclusionStore.remove(id);
    res.json({ success });
  } catch (err) {
    next(err);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

// Start server
const PORT = config.port;

function startServer() {
  return app.listen(PORT, () => {
    logger.info(`DeathWatch API server running on http://localhost:${PORT}`);
    logger.info('Endpoints:');
    logger.info('  GET  /search?firstName=&lastName=&city=&state=&age=');
    logger.info('  POST /exclude { searchKey, fingerprint, url?, name?, reason? }');
    logger.info('  GET  /exclusions?searchKey=');
    logger.info('  DELETE /exclude/:id');
    logger.info('  GET  /health');
  });
}

// Run if executed directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
