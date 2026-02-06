require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3001;

// Kill any existing process on our port
function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const lines = result.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' }); console.log(`Killed existing process on port ${port} (PID: ${pid})`); } catch (e) {}
      }
    } else {
      const result = execSync(`lsof -ti :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const pids = result.trim().split('\n').filter(p => p);
      for (const pid of pids) {
        try { execSync(`kill -9 ${pid}`, { stdio: 'ignore' }); console.log(`Killed existing process on port ${port} (PID: ${pid})`); } catch (e) {}
      }
    }
  } catch (e) {}
}

killProcessOnPort(PORT);

// Load obit-engine modules
const obitEnginePath = path.resolve(__dirname, '../..');
const { pool } = require(path.join(obitEnginePath, 'src/db/pool'));
const { exclusionStore } = require(path.join(obitEnginePath, 'src/data/ExclusionStore'));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: List available runs (distinct ran_dt values)
app.get('/api/runs', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ran_dt, COUNT(DISTINCT user_query_id)::int AS query_count, COUNT(*)::int AS result_count
       FROM user_result
       GROUP BY ran_dt
       ORDER BY ran_dt DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error listing runs:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Get results for a run
app.get('/api/results', async (req, res) => {
  try {
    let ranDt = req.query.ran_dt;

    // Default to latest run
    if (!ranDt) {
      const { rows } = await pool.query('SELECT ran_dt FROM user_result ORDER BY ran_dt DESC LIMIT 1');
      if (rows.length === 0) {
        res.json({ ran_dt: null, queries: [] });
        return;
      }
      ranDt = rows[0].ran_dt.toISOString();
    }

    // Get all queries that have results in this run
    const { rows: queryRows } = await pool.query(
      `SELECT DISTINCT uq.id, uq.first_name, uq.middle_name, uq.last_name, uq.apx_age, uq.city, uq.state
       FROM user_query uq
       JOIN user_result ur ON ur.user_query_id = uq.id
       WHERE ur.ran_dt = $1
       ORDER BY uq.last_name, uq.first_name`,
      [ranDt]
    );

    const queries = [];
    for (const qr of queryRows) {
      const { rows: resultRows } = await pool.query(
        `SELECT * FROM user_result WHERE user_query_id = $1 AND ran_dt = $2 ORDER BY rank ASC NULLS LAST`,
        [qr.id, ranDt]
      );

      queries.push({
        query: {
          firstName: qr.first_name,
          middleName: qr.middle_name,
          lastName: qr.last_name,
          apxAge: qr.apx_age,
          city: qr.city,
          state: qr.state
        },
        searchKey: null,
        resultCount: resultRows.length,
        results: resultRows.map(r => ({
          id: r.id,
          fullName: r.full_name,
          firstName: r.first_name,
          lastName: r.last_name,
          ageYears: r.age_years,
          dod: r.dod ? r.dod.toISOString().split('T')[0] : null,
          visitationDate: r.visitation_date ? r.visitation_date.toISOString().split('T')[0] : null,
          funeralDate: r.funeral_date ? r.funeral_date.toISOString().split('T')[0] : null,
          city: r.city,
          state: r.state,
          source: r.source,
          url: r.url,
          snippet: r.snippet,
          score: r.score,
          reasons: r.reasons || [],
          fingerprint: r.fingerprint,
          providerType: r.provider_type,
          alsoFoundAt: r.also_found_at,
          criteriaScores: r.criteria_scores,
          finalScore: r.final_score,
          maxPossible: r.max_possible,
          criteriaCount: r.criteria_count,
          rank: r.rank,
          imageUrl: r.image_url
        }))
      });
    }

    res.json({ ran_dt: ranDt, queries });
  } catch (err) {
    console.error('Error loading results:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: List all user queries
app.get('/api/user-queries', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, middle_name, last_name, apx_age, city, state, disabled, created_at
       FROM user_query ORDER BY created_at DESC`
    );
    const activeCount = rows.filter(r => !r.disabled).length;
    res.json({ queries: rows, activeCount });
  } catch (err) {
    console.error('Error listing user queries:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Add a user query
app.post('/api/user-queries', async (req, res) => {
  const { firstName, middleName, lastName, apxAge, city, state } = req.body;

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'firstName and lastName are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO user_query (first_name, middle_name, last_name, apx_age, city, state)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [firstName, middleName || null, lastName, apxAge || null, city || null, state || null]
    );
    res.json({ query: rows[0] });
  } catch (err) {
    console.error('Error adding user query:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Update a user query (toggle disabled or edit fields)
app.patch('/api/user-queries/:id', async (req, res) => {
  try {
    const { disabled, firstName, middleName, lastName, apxAge, city, state } = req.body;

    // If only disabled is provided, do a simple toggle
    if ('disabled' in req.body && firstName === undefined) {
      const { rows } = await pool.query(
        'UPDATE user_query SET disabled = $1 WHERE id = $2 RETURNING *',
        [disabled, req.params.id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Query not found' });
      }
      return res.json({ query: rows[0] });
    }

    // Full field update
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'firstName and lastName are required' });
    }

    const { rows } = await pool.query(
      `UPDATE user_query
       SET first_name = $1, middle_name = $2, last_name = $3, apx_age = $4, city = $5, state = $6
       WHERE id = $7 RETURNING *`,
      [firstName, middleName || null, lastName, apxAge || null, city || null, state || null, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }
    res.json({ query: rows[0] });
  } catch (err) {
    console.error('Error updating user query:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Delete a user query
app.delete('/api/user-queries/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM user_query WHERE id = $1', [req.params.id]);
    res.json({ success: rowCount > 0 });
  } catch (err) {
    console.error('Error deleting user query:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Exclude a result
app.post('/api/exclude', async (req, res) => {
  const { searchKey, fingerprint, url, name, reason, scope } = req.body;

  if (!fingerprint && !url) {
    return res.status(400).json({ error: 'Must provide fingerprint or url' });
  }

  try {
    const { exclusion, isNew } = await exclusionStore.add({
      searchKey,
      excludedFingerprint: fingerprint,
      excludedUrl: url,
      excludedName: name,
      reason: reason || 'excluded via web UI',
      scope: scope || 'per-query'
    });
    console.log(`${isNew ? 'Added' : 'Already exists'} exclusion: ${exclusion.id}`);
    res.json({ success: true, exclusion, isNew });
  } catch (err) {
    console.error('Error adding exclusion:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Get exclusion stats
app.get('/api/exclusion-stats', async (req, res) => {
  try {
    const stats = await exclusionStore.getStats();
    res.json(stats);
  } catch (err) {
    console.error('Error getting exclusion stats:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\nObit Client running at http://localhost:${PORT}`);
  console.log('Loading results from dw database (user_query / user_result)');
});
