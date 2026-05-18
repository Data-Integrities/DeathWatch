#!/usr/bin/env node

// ObitNote Round Robin Health Check
// Runs FROM staging (ON-ST-CHI-1) and checks all three servers.
// Usage: node obitnote_roundrobin_check.js

const { execSync } = require('child_process');

const SERVERS = {
  staging: {
    name: 'ON-ST-CHI-1',
    role: 'Staging',
    ip: 'localhost',
    checks: ['pm2', 'pg_local', 'api', 'https', 'disk'],
    pgHost: 'localhost',
    apiUrl: 'http://localhost:3001/api/health',
    httpsUrl: 'https://stage.obitnote.com',
  },
  prodWeb: {
    name: 'ON-WB-CHI-1',
    role: 'Prod Web',
    ip: '10.0.0.4',
    sshUser: 'obitnote_admin',
    checks: ['ssh', 'pm2', 'api', 'https', 'disk'],
    apiUrl: 'http://localhost:3001/api/health',
    httpsUrl: 'https://obitnote.com',
  },
  prodDb: {
    name: 'ON-DB-CHI-1',
    role: 'Prod DB',
    ip: '10.0.0.2',
    sshUser: 'obitnote_admin',
    checks: ['ssh', 'pg_remote', 'disk'],
    pgHost: '10.0.0.2',
  },
};

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';

function run(cmd, timeout = 10000) {
  try {
    return execSync(cmd, { timeout, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return null;
  }
}

function sshCmd(server, cmd) {
  return `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no ${server.sshUser}@${server.ip} '${cmd}'`;
}

function checkSsh(server) {
  const result = run(sshCmd(server, 'echo OK'));
  return { check: 'SSH', status: result === 'OK' ? PASS : FAIL, detail: result === 'OK' ? '' : 'Connection failed' };
}

function checkPm2Local() {
  const raw = run('pm2 jlist 2>/dev/null');
  if (!raw) return { check: 'PM2', status: FAIL, detail: 'pm2 not responding' };
  try {
    const procs = JSON.parse(raw);
    const lines = procs.map(p => `${p.name}=${p.pm2_env.status}`);
    const allOnline = procs.every(p => p.pm2_env.status === 'online');
    return { check: 'PM2', status: allOnline ? PASS : FAIL, detail: lines.join(', ') };
  } catch {
    return { check: 'PM2', status: FAIL, detail: 'Parse error' };
  }
}

function checkPm2Remote(server) {
  const raw = run(sshCmd(server, 'pm2 jlist 2>/dev/null'));
  if (!raw) return { check: 'PM2', status: FAIL, detail: 'pm2 not responding' };
  try {
    const procs = JSON.parse(raw);
    const lines = procs.map(p => `${p.name}=${p.pm2_env.status}`);
    const allOnline = procs.every(p => p.pm2_env.status === 'online');
    return { check: 'PM2', status: allOnline ? PASS : FAIL, detail: lines.join(', ') };
  } catch {
    return { check: 'PM2', status: FAIL, detail: 'Parse error' };
  }
}

function checkPgLocal() {
  const result = run('PGPASSWORD=ondata psql -U onadmin -h localhost -d dw -t -q -c "SELECT 1" 2>/dev/null');
  const ok = result && result.trim() === '1';
  return { check: 'PostgreSQL', status: ok ? PASS : FAIL, detail: ok ? 'localhost' : 'Connection failed' };
}

function checkPgRemote(server) {
  const result = run(`PGPASSWORD=ondata psql -U onadmin -h ${server.pgHost} -d dw -t -q -c "SELECT 1" 2>/dev/null`);
  const ok = result && result.trim() === '1';
  return { check: 'PostgreSQL', status: ok ? PASS : FAIL, detail: ok ? server.pgHost : 'Connection failed' };
}

function checkApiLocal(server) {
  const result = run(`curl -s -o /dev/null -w '%{http_code}' ${server.apiUrl}`);
  const ok = result === '200';
  return { check: 'API Health', status: ok ? PASS : FAIL, detail: ok ? 'HTTP 200' : `HTTP ${result || 'timeout'}` };
}

function checkApiRemote(server) {
  const result = run(sshCmd(server, `curl -s -o /dev/null -w '%{http_code}' ${server.apiUrl}`));
  const ok = result === '200';
  return { check: 'API Health', status: ok ? PASS : FAIL, detail: ok ? 'HTTP 200' : `HTTP ${result || 'timeout'}` };
}

function checkHttps(server) {
  const result = run(`curl -s -o /dev/null -w '%{http_code}' ${server.httpsUrl}`);
  const ok = result === '200';
  return { check: 'HTTPS', status: ok ? PASS : FAIL, detail: ok ? server.httpsUrl : `HTTP ${result || 'timeout'}` };
}

function checkDiskLocal() {
  const result = run("df -h / | tail -1 | awk '{print $5, $4}'");
  if (!result) return { check: 'Disk', status: FAIL, detail: 'Unable to check' };
  const [pct, free] = result.split(' ');
  const usage = parseInt(pct);
  return { check: 'Disk', status: usage < 85 ? PASS : FAIL, detail: `${pct} used (${free} free)` };
}

function checkDiskRemote(server) {
  const result = run(sshCmd(server, 'df -h / | tail -1'));
  if (!result) return { check: 'Disk', status: FAIL, detail: 'Unable to check' };
  const parts = result.split(/\s+/);
  const pct = parts[4];
  const free = parts[3];
  const usage = parseInt(pct);
  return { check: 'Disk', status: usage < 85 ? PASS : FAIL, detail: `${pct} used (${free} free)` };
}

function runChecks(key, server) {
  const results = [];
  const isLocal = key === 'staging';

  for (const check of server.checks) {
    switch (check) {
      case 'ssh':
        results.push(checkSsh(server));
        break;
      case 'pm2':
        results.push(isLocal ? checkPm2Local() : checkPm2Remote(server));
        break;
      case 'pg_local':
        results.push(checkPgLocal());
        break;
      case 'pg_remote':
        results.push(checkPgRemote(server));
        break;
      case 'api':
        results.push(isLocal ? checkApiLocal(server) : checkApiRemote(server));
        break;
      case 'https':
        results.push(checkHttps(server));
        break;
      case 'disk':
        results.push(isLocal ? checkDiskLocal() : checkDiskRemote(server));
        break;
    }
  }
  return results;
}

function main() {
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');
  console.log(`\nObitNote Round Robin Health Check`);
  console.log(`${now}`);
  console.log('='.repeat(60));

  let totalPass = 0;
  let totalFail = 0;

  for (const [key, server] of Object.entries(SERVERS)) {
    console.log(`\n${server.name} (${server.role}) ${server.ip === 'localhost' ? '' : server.ip}`);
    console.log('-'.repeat(50));

    const results = runChecks(key, server);
    for (const r of results) {
      const detail = r.detail ? `  ${r.detail}` : '';
      console.log(`  ${r.check.padEnd(14)} ${r.status}${detail}`);
      if (r.status === PASS) totalPass++;
      else totalFail++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${totalPass} passed, ${totalFail} failed`);
  if (totalFail > 0) {
    console.log('\x1b[31m*** FAILURES DETECTED ***\x1b[0m');
    process.exit(1);
  } else {
    console.log('\x1b[32mAll checks passed.\x1b[0m');
  }
  console.log('');
}

main();
