#!/usr/bin/env node

/**
 * Daily Rank-1 Tracking & Report Generator
 *
 * Queries all batches that used the same test input file,
 * compares rank-1 results across days, generates a metrics JSON
 * and an HTML report with Chart.js charts.
 *
 * Usage: node search_test_data/track.js [--input <path>]
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool, close } = require('../src/db/pool');
const fs = require('fs');
const path = require('path');

const DEFAULT_INPUT = 'search_test_data/test-input-2026-02-16.json';

async function fetchTrackingData(inputFile) {
  const inputBasename = path.basename(inputFile);

  const { rows } = await pool.query(`
    SELECT b.id AS batch_id, b.created_at AS batch_date,
           q.name_first, q.name_last, q.age_apx, q.city, q.state,
           r.name_last AS r_name_last, r.score_final, r.score_max,
           r.criteria_cnt, r.scores_criteria
    FROM batches b
    JOIN queries q ON q.batch_id = b.id
    LEFT JOIN results r ON r.query_id = q.id AND r.rank = 1
    WHERE b.input_file LIKE $1
    ORDER BY b.created_at, q.name_last, q.name_first
  `, [`%${inputBasename}%`]);

  return rows;
}

function buildMatrix(rows) {
  const batchMap = new Map();
  const personMap = new Map();

  for (const row of rows) {
    if (!batchMap.has(row.batch_id)) {
      batchMap.set(row.batch_id, {
        batchId: row.batch_id,
        batchDate: row.batch_date,
        dayNum: batchMap.size + 1
      });
    }

    const personKey = `${(row.name_first || '').toLowerCase()}-${(row.name_last || '').toLowerCase()}`;

    if (!personMap.has(personKey)) {
      personMap.set(personKey, {
        nameFirst: row.name_first,
        nameLast: row.name_last,
        ageApx: row.age_apx,
        city: row.city,
        state: row.state,
        days: []
      });
    }

    const batch = batchMap.get(row.batch_id);
    const hasResult = row.score_final !== null;
    const scoresCriteria = row.scores_criteria || {};

    let rank1NameMatch = false;
    if (hasResult && row.r_name_last && row.name_last) {
      rank1NameMatch = row.r_name_last.toLowerCase() === row.name_last.toLowerCase();
    }

    personMap.get(personKey).days.push({
      dayNum: batch.dayNum,
      batchId: row.batch_id,
      batchDate: batch.batchDate,
      scoreFinal: row.score_final,
      scoreMax: row.score_max,
      criteriaCnt: row.criteria_cnt,
      rank1NameMatch,
      hasResult,
      scoresCriteria
    });
  }

  return {
    batches: Array.from(batchMap.values()),
    persons: Array.from(personMap.values())
  };
}

function computeDailyMetrics(matrix) {
  const { batches, persons } = matrix;

  return batches.map(batch => {
    const dayData = [];

    for (const person of persons) {
      const dayEntry = person.days.find(d => d.dayNum === batch.dayNum);
      if (dayEntry) dayData.push(dayEntry);
    }

    const totalQueries = dayData.length;
    const withResults = dayData.filter(d => d.hasResult);
    const nameMatches = dayData.filter(d => d.rank1NameMatch);

    let high = 0, medium = 0, low = 0, none = 0;
    const scorePcts = [];

    for (const d of dayData) {
      if (!d.hasResult) { none++; continue; }
      const pct = d.scoreMax > 0 ? (d.scoreFinal / d.scoreMax) * 100 : 0;
      scorePcts.push(pct);
      if (pct >= 80) high++;
      else if (pct >= 50) medium++;
      else low++;
    }

    const criteriaKeys = ['nameLast', 'nameFirst', 'state', 'city', 'age'];
    const criteriaAvgs = {};
    for (const key of criteriaKeys) {
      const values = withResults
        .map(d => d.scoresCriteria[key])
        .filter(v => v !== null && v !== undefined);
      criteriaAvgs[key] = values.length > 0
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : null;
    }

    return {
      dayNum: batch.dayNum,
      batchId: batch.batchId,
      batchDate: batch.batchDate,
      totalQueries,
      hitRate: totalQueries > 0 ? Math.round((withResults.length / totalQueries) * 100) : 0,
      nameMatchRate: totalQueries > 0 ? Math.round((nameMatches.length / totalQueries) * 100) : 0,
      avgScoreFinal: withResults.length > 0
        ? Math.round(withResults.reduce((a, d) => a + d.scoreFinal, 0) / withResults.length)
        : 0,
      avgScorePct: scorePcts.length > 0
        ? Math.round(scorePcts.reduce((a, b) => a + b, 0) / scorePcts.length)
        : 0,
      buckets: { high, medium, low, none },
      criteriaAvgs
    };
  });
}

function generateHtml(matrix, dailyMetrics) {
  const { batches, persons } = matrix;

  const dayDates = dailyMetrics.map(d => {
    const dt = new Date(d.batchDate);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const hitRates = dailyMetrics.map(d => d.hitRate);
  const nameMatchRates = dailyMetrics.map(d => d.nameMatchRate);
  const avgScoreFinals = dailyMetrics.map(d => d.avgScoreFinal);
  const avgScorePcts = dailyMetrics.map(d => d.avgScorePct);
  const bucketsHigh = dailyMetrics.map(d => d.buckets.high);
  const bucketsMedium = dailyMetrics.map(d => d.buckets.medium);
  const bucketsLow = dailyMetrics.map(d => d.buckets.low);
  const bucketsNone = dailyMetrics.map(d => d.buckets.none);

  const criteriaKeys = ['nameLast', 'nameFirst', 'state', 'city', 'age'];
  const criteriaColors = {
    nameLast: '#e74c3c',
    nameFirst: '#3498db',
    state: '#2ecc71',
    city: '#f39c12',
    age: '#9b59b6'
  };
  const criteriaDatasets = criteriaKeys.map(key => ({
    label: key,
    data: dailyMetrics.map(d => d.criteriaAvgs[key]),
    borderColor: criteriaColors[key],
    backgroundColor: criteriaColors[key] + '20',
    tension: 0.3,
    fill: false
  }));

  // Build trajectory table
  const trajectoryRows = persons.map(person => {
    const cells = batches.map(batch => {
      const day = person.days.find(d => d.dayNum === batch.dayNum);
      if (!day || !day.hasResult) {
        return { pct: null, scoreFinal: null, scoreMax: null, cls: 'none' };
      }
      const pct = day.scoreMax > 0 ? Math.round((day.scoreFinal / day.scoreMax) * 100) : 0;
      let cls = 'low';
      if (pct >= 80) cls = 'high';
      else if (pct >= 50) cls = 'medium';
      return { pct, scoreFinal: day.scoreFinal, scoreMax: day.scoreMax, cls };
    });
    return { person, cells };
  });

  trajectoryRows.sort((a, b) => (a.person.nameLast || '').localeCompare(b.person.nameLast || ''));

  const trajectoryHtml = trajectoryRows.map(row => {
    const personInfo = `${row.person.nameLast}, ${row.person.nameFirst}`;
    const location = [row.person.city, row.person.state].filter(Boolean).join(', ');
    const cellsHtml = row.cells.map(c => {
      if (c.pct === null) return '<td class="cell none">-</td>';
      return `<td class="cell ${c.cls}" title="${c.scoreFinal}/${c.scoreMax}">${c.pct}%</td>`;
    }).join('');
    return `<tr><td class="name">${personInfo}</td><td class="location">${location}</td>${cellsHtml}</tr>`;
  }).join('\n        ');

  const dayHeaders = batches.map(b => {
    const dt = new Date(b.batchDate);
    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `<th>Day ${b.dayNum}<br><small>${dateStr}</small></th>`;
  }).join('');

  // Summary cards (latest day)
  let summaryHtml = '';
  if (dailyMetrics.length > 0) {
    const latest = dailyMetrics[dailyMetrics.length - 1];
    summaryHtml = `
  <div class="summary">
    <div class="stat-card"><div class="label">Days Tracked</div><div class="value">${batches.length}</div></div>
    <div class="stat-card"><div class="label">Latest Hit Rate</div><div class="value">${latest.hitRate}%</div></div>
    <div class="stat-card"><div class="label">Latest Name Match</div><div class="value">${latest.nameMatchRate}%</div></div>
    <div class="stat-card"><div class="label">Avg Score (Latest)</div><div class="value">${latest.avgScorePct}%</div></div>
  </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Indexing Tail Tracker</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ecf0f1; color: #2c3e50; }
  header { background: #2c3e50; color: white; padding: 20px 30px; }
  header h1 { font-size: 1.5em; font-weight: 600; }
  header p { opacity: 0.8; margin-top: 4px; font-size: 0.9em; }
  .container { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat-card { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .stat-card .label { font-size: 0.8em; color: #7f8c8d; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-card .value { font-size: 1.8em; font-weight: 700; margin-top: 4px; }
  .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .chart-box { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .chart-box h3 { font-size: 1em; margin-bottom: 12px; color: #2c3e50; }
  .chart-box canvas { max-height: 300px; }
  .table-box { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; overflow-x: auto; }
  .table-box h3 { font-size: 1em; margin-bottom: 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85em; }
  th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #ecf0f1; }
  th { background: #f8f9fa; font-weight: 600; position: sticky; top: 0; cursor: pointer; }
  th:hover { background: #e8e9ea; }
  .name { font-weight: 600; white-space: nowrap; }
  .location { color: #7f8c8d; white-space: nowrap; }
  .cell { text-align: center; min-width: 60px; font-weight: 600; }
  .cell.high { background: #d5f5e3; color: #1e8449; }
  .cell.medium { background: #fef9e7; color: #b7950b; }
  .cell.low { background: #fadbd8; color: #c0392b; }
  .cell.none { background: #f2f3f4; color: #aab7b8; }
  .sort-arrow { font-size: 0.7em; margin-left: 3px; }
  @media (max-width: 800px) { .chart-grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <h1>Indexing Tail Tracker</h1>
  <p>${batches.length} batch${batches.length !== 1 ? 'es' : ''} &middot; ${persons.length} queries tracked</p>
</header>
<div class="container">
  ${summaryHtml}
  <div class="chart-grid">
    <div class="chart-box">
      <h3>Rank-1 Hit Rate & Name Match Rate</h3>
      <canvas id="hitRateChart"></canvas>
    </div>
    <div class="chart-box">
      <h3>Average Score</h3>
      <canvas id="scoreChart"></canvas>
    </div>
    <div class="chart-box">
      <h3>Score Distribution</h3>
      <canvas id="distChart"></canvas>
    </div>
    <div class="chart-box">
      <h3>Per-Criteria Averages</h3>
      <canvas id="criteriaChart"></canvas>
    </div>
  </div>
  <div class="table-box">
    <h3>Individual Query Trajectories</h3>
    <table id="trajTable">
      <thead>
        <tr><th data-col="name">Name</th><th data-col="location">Location</th>${dayHeaders}</tr>
      </thead>
      <tbody>
        ${trajectoryHtml}
      </tbody>
    </table>
  </div>
</div>

<script>
const dayLabels = ${JSON.stringify(dayDates)};

new Chart(document.getElementById('hitRateChart'), {
  type: 'line',
  data: {
    labels: dayLabels,
    datasets: [
      {
        label: 'Hit Rate %',
        data: ${JSON.stringify(hitRates)},
        borderColor: '#3498db',
        backgroundColor: '#3498db20',
        tension: 0.3,
        fill: true
      },
      {
        label: 'Name Match %',
        data: ${JSON.stringify(nameMatchRates)},
        borderColor: '#2ecc71',
        backgroundColor: '#2ecc7120',
        tension: 0.3,
        fill: true
      }
    ]
  },
  options: {
    scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } },
    plugins: { legend: { position: 'bottom' } }
  }
});

new Chart(document.getElementById('scoreChart'), {
  type: 'line',
  data: {
    labels: dayLabels,
    datasets: [
      {
        label: 'Avg Score Final',
        data: ${JSON.stringify(avgScoreFinals)},
        borderColor: '#e74c3c',
        backgroundColor: '#e74c3c20',
        tension: 0.3,
        yAxisID: 'y'
      },
      {
        label: 'Avg Score %',
        data: ${JSON.stringify(avgScorePcts)},
        borderColor: '#9b59b6',
        backgroundColor: '#9b59b620',
        tension: 0.3,
        yAxisID: 'y1'
      }
    ]
  },
  options: {
    scales: {
      y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Score Final' } },
      y1: { beginAtZero: true, max: 100, position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%' } }
    },
    plugins: { legend: { position: 'bottom' } }
  }
});

new Chart(document.getElementById('distChart'), {
  type: 'bar',
  data: {
    labels: dayLabels,
    datasets: [
      { label: 'High (>=80%)', data: ${JSON.stringify(bucketsHigh)}, backgroundColor: '#2ecc71' },
      { label: 'Medium (50-79%)', data: ${JSON.stringify(bucketsMedium)}, backgroundColor: '#f39c12' },
      { label: 'Low (<50%)', data: ${JSON.stringify(bucketsLow)}, backgroundColor: '#e74c3c' },
      { label: 'No Result', data: ${JSON.stringify(bucketsNone)}, backgroundColor: '#bdc3c7' }
    ]
  },
  options: {
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
    plugins: { legend: { position: 'bottom' } }
  }
});

new Chart(document.getElementById('criteriaChart'), {
  type: 'line',
  data: {
    labels: dayLabels,
    datasets: ${JSON.stringify(criteriaDatasets)}
  },
  options: {
    scales: { y: { beginAtZero: true, max: 100 } },
    plugins: { legend: { position: 'bottom' } }
  }
});

// Simple table sorting
document.querySelectorAll('#trajTable thead th').forEach((th, colIdx) => {
  let asc = true;
  th.addEventListener('click', () => {
    const tbody = document.querySelector('#trajTable tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((a, b) => {
      const aText = a.children[colIdx]?.textContent || '';
      const bText = b.children[colIdx]?.textContent || '';
      const aNum = parseFloat(aText);
      const bNum = parseFloat(bText);
      if (!isNaN(aNum) && !isNaN(bNum)) return asc ? aNum - bNum : bNum - aNum;
      return asc ? aText.localeCompare(bText) : bText.localeCompare(aText);
    });
    rows.forEach(r => tbody.appendChild(r));
    asc = !asc;
  });
});
</script>
</body>
</html>`;
}

async function main() {
  const args = process.argv.slice(2);
  let inputFile = DEFAULT_INPUT;

  const inputIdx = args.indexOf('--input');
  if (inputIdx !== -1 && args[inputIdx + 1]) {
    inputFile = args[inputIdx + 1];
  }

  console.log(`Tracking batches for: ${inputFile}`);

  try {
    const rows = await fetchTrackingData(inputFile);

    if (rows.length === 0) {
      console.log('No batches found matching this input file.');
      return;
    }

    const matrix = buildMatrix(rows);
    console.log(`Found ${matrix.batches.length} batch(es), ${matrix.persons.length} unique queries`);

    const dailyMetrics = computeDailyMetrics(matrix);

    // Write metrics JSON
    const dataPath = path.join(__dirname, 'track-data.json');
    fs.writeFileSync(dataPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      inputFile,
      batches: matrix.batches,
      dailyMetrics,
      persons: matrix.persons
    }, null, 2));
    console.log(`Wrote metrics: ${dataPath}`);

    // Generate HTML report
    const htmlPath = path.join(__dirname, 'track-report.html');
    fs.writeFileSync(htmlPath, generateHtml(matrix, dailyMetrics));
    console.log(`Wrote report: ${htmlPath}`);

    // Print summary
    for (const day of dailyMetrics) {
      const dt = new Date(day.batchDate);
      console.log(`  Day ${day.dayNum} (${dt.toLocaleDateString()}): hit=${day.hitRate}% nameMatch=${day.nameMatchRate}% avgScore=${day.avgScorePct}% high=${day.buckets.high} med=${day.buckets.medium} low=${day.buckets.low} none=${day.buckets.none}`);
    }
  } finally {
    await close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
