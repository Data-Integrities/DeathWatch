const express = require('express');
const path = require('path');
const fs = require('fs');

// Get results file from CLI argument
const resultsFile = process.argv[2];
if (!resultsFile) {
  console.error('Usage: node server.js <results-file.json>');
  console.error('Example: node server.js ../obit-engine/data/results-20260204-031939.json');
  process.exit(1);
}

// Resolve path
const resultsPath = path.resolve(resultsFile);
if (!fs.existsSync(resultsPath)) {
  console.error(`Error: File not found: ${resultsPath}`);
  process.exit(1);
}

// Load results
let results;
try {
  const data = fs.readFileSync(resultsPath, 'utf-8');
  results = JSON.parse(data);
  console.log(`Loaded ${results.length} queries from ${resultsPath}`);
} catch (err) {
  console.error(`Error reading results file: ${err.message}`);
  process.exit(1);
}

// Try to load ExclusionStore from obit-engine
let exclusionStore = null;
const obitEnginePath = path.resolve(__dirname, '../../obit-engine');
try {
  const { exclusionStore: store } = require(path.join(obitEnginePath, 'src/data/ExclusionStore'));
  exclusionStore = store;
  console.log('Connected to obit-engine ExclusionStore');
} catch (err) {
  console.warn('Warning: Could not load obit-engine ExclusionStore. Exclusions will be logged only.');
  console.warn(`  Tried: ${obitEnginePath}`);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Get all results
app.get('/api/results', (req, res) => {
  res.json(results);
});

// API: Exclude a result
app.post('/api/exclude', (req, res) => {
  const { searchKey, fingerprint, url, name, reason, scope } = req.body;

  if (!fingerprint && !url) {
    return res.status(400).json({ error: 'Must provide fingerprint or url' });
  }

  const exclusionData = {
    searchKey,
    excludedFingerprint: fingerprint,
    excludedUrl: url,
    excludedName: name,
    reason: reason || 'excluded via web UI',
    scope: scope || 'per-query'
  };

  if (exclusionStore) {
    try {
      const { exclusion, isNew } = exclusionStore.add(exclusionData);
      console.log(`${isNew ? 'Added' : 'Already exists'} exclusion: ${exclusion.id}`);
      res.json({ success: true, exclusion, isNew });
    } catch (err) {
      console.error('Error adding exclusion:', err);
      res.status(500).json({ error: err.message });
    }
  } else {
    // Just log if no ExclusionStore
    console.log('Exclusion request (not saved):', exclusionData);
    res.json({ success: true, exclusion: exclusionData, isNew: true, warning: 'ExclusionStore not connected' });
  }
});

// API: Get exclusion stats
app.get('/api/exclusion-stats', (req, res) => {
  if (exclusionStore) {
    res.json(exclusionStore.getStats());
  } else {
    res.json({ total: 0, global: 0, perQuery: 0, byReason: {} });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\nObit Client running at http://localhost:${PORT}`);
  console.log(`Viewing results from: ${resultsPath}`);
});
