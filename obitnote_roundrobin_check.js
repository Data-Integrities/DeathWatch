#!/usr/bin/env node

// ObitNote Round Robin Health Check + Auto-Failover
// Runs on Dallas standby (ON-PB-DAL-1) every 2 minutes via crontab.
// Checks all servers and alerts via SMS + email on failure.
// Suppresses after 3 consecutive alerts for the same check.
// Auto-failover: if Chicago web is unreachable for 5 consecutive checks
// (10 min) via BOTH VPN/SSH and public HTTPS, promotes Dallas to primary.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Resolve modules from API's node_modules (Sinch, nodemailer, pg)
module.paths.unshift('/var/www/obitnote/api/node_modules');

const ENV_PATH = '/var/www/obitnote/api/.env';
const STATE_FILE = '/var/www/obitnote/data/roundrobin-state.json';
const FAILOVER_FILE = '/var/www/obitnote/data/failover-executed.json';
const MAX_ALERTS = 3;
const REPLICATION_LAG_THRESHOLD = 300; // seconds
const FAILOVER_THRESHOLD = 5; // consecutive failures before auto-failover (5 × 2 min = 10 min)
const DALLAS_PUBLIC_IP = '43.231.235.200';
const CHICAGO_PUBLIC_IP = '103.90.163.56';

// Load .env manually
function loadEnv(filePath) {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const val = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (e) {
    console.error(`[RoundRobin] Cannot load ${filePath}: ${e.message}`);
    process.exit(1);
  }
}

loadEnv(ENV_PATH);

const HARDCODED_RECIPIENTS = [
  { name: 'Jim Jones', phone: '+19044770311', email: 'jimjones1000@gmail.com' },
];

const SERVERS = {
  dallas: {
    name: 'ON-PB-DAL-1',
    role: 'Dallas Standby',
    ip: 'localhost',
    isLocal: true,
    checks: ['pm2', 'pg_replica', 'replication_lag', 'vpn', 'api', 'disk'],
    apiUrl: 'http://localhost:3001/api/health',
  },
  prodWeb: {
    name: 'ON-WB-CHI-1',
    role: 'Prod Web',
    ip: '103.90.163.56',
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
    checks: ['vpn_ping', 'pg_remote', 'disk'],
    pgHost: '10.0.0.2',
  },
  staging: {
    name: 'ON-ST-CHI-1',
    role: 'Staging',
    ip: '146.71.78.194',
    sshUser: 'obitnote_admin',
    optional: true,
    checks: ['ssh', 'pm2', 'api', 'https', 'disk'],
    apiUrl: 'http://localhost:3001/api/health',
    httpsUrl: 'https://stage.obitnote.com',
  },
};

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const SKIP = '\x1b[33mSKIP\x1b[0m';

function run(cmd, timeout = 10000) {
  try {
    return execSync(cmd, { timeout, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function sshCmd(server, cmd) {
  return `ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no ${server.sshUser}@${server.ip} '${cmd}'`;
}

// --- State management ---

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error(`[RoundRobin] Cannot save state: ${e.message}`);
  }
}

function isFailoverExecuted() {
  try {
    return fs.existsSync(FAILOVER_FILE);
  } catch {
    return false;
  }
}

function markFailoverExecuted(details) {
  try {
    fs.writeFileSync(FAILOVER_FILE, JSON.stringify({
      executedAt: new Date().toISOString(),
      ...details,
    }, null, 2));
  } catch (e) {
    console.error(`[Failover] Cannot save failover marker: ${e.message}`);
  }
}

// --- Check functions ---

function checkSsh(server) {
  const result = run(sshCmd(server, 'echo OK'));
  return {
    check: 'SSH', passed: result === 'OK',
    detail: result === 'OK' ? '' : 'Connection failed',
  };
}

function checkPm2Local() {
  const raw = run('pm2 jlist 2>/dev/null');
  if (!raw) return { check: 'PM2', passed: false, detail: 'pm2 not responding' };
  try {
    const procs = JSON.parse(raw);
    const lines = procs.map(p => `${p.name}=${p.pm2_env.status}`);
    const allOnline = procs.every(p => p.pm2_env.status === 'online');
    return { check: 'PM2', passed: allOnline, detail: lines.join(', ') };
  } catch {
    return { check: 'PM2', passed: false, detail: 'Parse error' };
  }
}

function checkPm2Remote(server) {
  const raw = run(sshCmd(server, 'pm2 jlist 2>/dev/null'));
  if (!raw) return { check: 'PM2', passed: false, detail: 'pm2 not responding' };
  try {
    const procs = JSON.parse(raw);
    const lines = procs.map(p => `${p.name}=${p.pm2_env.status}`);
    const allOnline = procs.every(p => p.pm2_env.status === 'online');
    return { check: 'PM2', passed: allOnline, detail: lines.join(', ') };
  } catch {
    return { check: 'PM2', passed: false, detail: 'Parse error' };
  }
}

function checkPgReplica() {
  const result = run('PGPASSWORD=ondata psql -U onadmin -h localhost -d dw -t -q -c "SELECT pg_is_in_recovery()" 2>/dev/null');
  if (!result) return { check: 'PG Replica', passed: false, detail: 'Cannot connect to local PG' };
  const inRecovery = result.trim() === 't';
  return {
    check: 'PG Replica', passed: inRecovery,
    detail: inRecovery ? 'In recovery (replica)' : 'NOT in recovery — may have been promoted',
  };
}

function checkReplicationLag() {
  const lsnResult = run('PGPASSWORD=ondata psql -U onadmin -h localhost -d dw -t -q -c "SELECT pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn()" 2>/dev/null');
  const walCaughtUp = lsnResult && lsnResult.trim() === 't';

  const result = run('PGPASSWORD=ondata psql -U onadmin -h localhost -d dw -t -q -c "SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp()))::int" 2>/dev/null');
  if (!result || result.trim() === '') {
    return { check: 'Repl Lag', passed: true, detail: 'No replay timestamp (idle primary)' };
  }
  const lagSeconds = parseInt(result.trim(), 10);
  if (isNaN(lagSeconds)) return { check: 'Repl Lag', passed: false, detail: `Unexpected: ${result.trim()}` };

  if (walCaughtUp) {
    return { check: 'Repl Lag', passed: true, detail: 'WAL caught up (primary idle)' };
  }

  const ok = lagSeconds < REPLICATION_LAG_THRESHOLD;
  const mins = Math.floor(lagSeconds / 60);
  const secs = lagSeconds % 60;
  return { check: 'Repl Lag', passed: ok, detail: `${mins}m ${secs}s lag` };
}

function checkVpn() {
  const result = run('ping -c 1 -W 5 10.0.0.2 2>/dev/null');
  return { check: 'VPN Tunnel', passed: result !== null, detail: result ? 'DB reachable' : 'Cannot ping 10.0.0.2' };
}

function checkVpnPing() {
  const result = run('ping -c 1 -W 5 10.0.0.2 2>/dev/null');
  return { check: 'Ping', passed: result !== null, detail: result ? '10.0.0.2 reachable' : 'Cannot ping 10.0.0.2' };
}

function checkPgRemote(server) {
  const result = run(`PGPASSWORD=ondata psql -U onadmin -h ${server.pgHost} -d dw -t -q -c "SELECT 1" 2>/dev/null`);
  const ok = result && result.trim() === '1';
  return { check: 'PostgreSQL', passed: ok, detail: ok ? server.pgHost : 'Connection failed' };
}

function checkApiLocal(server) {
  const result = run(`curl -s -o /dev/null -w '%{http_code}' ${server.apiUrl}`);
  const ok = result === '200';
  return { check: 'API Health', passed: ok, detail: ok ? 'HTTP 200' : `HTTP ${result || 'timeout'}` };
}

function checkApiRemote(server) {
  const result = run(sshCmd(server, `curl -s -o /dev/null -w '%{http_code}' ${server.apiUrl}`));
  const ok = result === '200';
  return { check: 'API Health', passed: ok, detail: ok ? 'HTTP 200' : `HTTP ${result || 'timeout'}` };
}

function checkHttps(server) {
  const result = run(`curl -s -o /dev/null -w '%{http_code}' --max-time 10 ${server.httpsUrl}`);
  const ok = result === '200';
  return { check: 'HTTPS', passed: ok, detail: ok ? server.httpsUrl : `HTTP ${result || 'timeout'}` };
}

function checkDiskLocal() {
  const result = run("df -h / | tail -1 | awk '{print $5, $4}'");
  if (!result) return { check: 'Disk', passed: false, detail: 'Unable to check' };
  const [pct, free] = result.split(' ');
  const usage = parseInt(pct);
  return { check: 'Disk', passed: usage < 85, detail: `${pct} used (${free} free)` };
}

function checkDiskRemote(server) {
  const result = run(sshCmd(server, 'df -h / | tail -1'));
  if (!result) return { check: 'Disk', passed: false, detail: 'Unable to check' };
  const parts = result.split(/\s+/);
  const pct = parts[4];
  const free = parts[3];
  const usage = parseInt(pct);
  return { check: 'Disk', passed: usage < 85, detail: `${pct} used (${free} free)` };
}

function runChecks(serverKey, server) {
  const results = [];
  const isLocal = server.isLocal;
  const failedOver = isFailoverExecuted();

  for (const check of server.checks) {
    // After failover, skip replica-specific checks on Dallas (it's now a primary)
    if (failedOver && serverKey === 'dallas' && (check === 'pg_replica' || check === 'replication_lag')) {
      results.push({
        check: check === 'pg_replica' ? 'PG Replica' : 'Repl Lag',
        passed: true, skipped: true,
        detail: 'Skipped (failover executed — Dallas is primary)',
        serverKey, checkKey: `${serverKey}:${check}`,
      });
      continue;
    }

    let result;
    switch (check) {
      case 'ssh':        result = checkSsh(server); break;
      case 'pm2':        result = isLocal ? checkPm2Local() : checkPm2Remote(server); break;
      case 'pg_replica': result = checkPgReplica(); break;
      case 'replication_lag': result = checkReplicationLag(); break;
      case 'vpn':        result = checkVpn(); break;
      case 'vpn_ping':   result = checkVpnPing(); break;
      case 'pg_remote':  result = checkPgRemote(server); break;
      case 'api':        result = isLocal ? checkApiLocal(server) : checkApiRemote(server); break;
      case 'https':      result = checkHttps(server); break;
      case 'disk':       result = isLocal ? checkDiskLocal() : checkDiskRemote(server); break;
      default: continue;
    }
    result.serverKey = serverKey;
    result.checkKey = `${serverKey}:${check}`;
    results.push(result);

    // If SSH fails on an optional server, skip all checks (including SSH itself)
    if (check === 'ssh' && !result.passed && server.optional) {
      result.skipped = true;
      for (const remaining of server.checks.slice(server.checks.indexOf(check) + 1)) {
        results.push({
          check: remaining, passed: true, skipped: true,
          detail: 'Skipped (server offline)',
          serverKey, checkKey: `${serverKey}:${remaining}`,
        });
      }
      break;
    }
  }
  return results;
}

// --- Alerting ---

async function getOnCallChief() {
  try {
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const { rows } = await client.query(
      'SELECT name, phone_number FROM support_staff WHERE is_on_call = true LIMIT 1',
    );
    await client.end();
    return rows[0] || null;
  } catch (e) {
    console.error(`[RoundRobin] Cannot query support_staff: ${e.message}`);
    return null;
  }
}

async function sendSms(phone, message) {
  try {
    const { SinchClient } = require('@sinch/sdk-core');
    const sinch = new SinchClient({
      projectId: process.env.SINCH_PROJECT_ID,
      keyId: process.env.SINCH_KEY_ID,
      keySecret: process.env.SINCH_KEY_SECRET,
      smsRegion: 'us',
    });
    await sinch.sms.batches.send({
      sendSMSRequestBody: {
        to: [phone],
        from: process.env.SINCH_FROM_NUMBER,
        body: message,
      },
    });
    console.log(`[Alert] SMS sent to ${phone}`);
  } catch (e) {
    console.error(`[Alert] SMS to ${phone} failed: ${e.message}`);
  }
}

async function sendEmail(to, subject, body) {
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
      port: parseInt(process.env.ZOHO_SMTP_PORT || '465', 10),
      secure: true,
      auth: { user: process.env.ZOHO_SMTP_USER, pass: process.env.ZOHO_SMTP_PASSWORD },
    });
    await transporter.sendMail({
      from: `"ObitNote Monitor" <${process.env.ZOHO_SMTP_USER}>`,
      to,
      subject,
      text: body,
    });
    console.log(`[Alert] Email sent to ${to}`);
  } catch (e) {
    console.error(`[Alert] Email to ${to} failed: ${e.message}`);
  }
}

async function sendAlerts(failures, isRecovery) {
  const chief = await getOnCallChief();
  const prefix = isRecovery ? 'RECOVERED' : 'ALERT';
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');

  const lines = failures.map(f => {
    const server = SERVERS[f.serverKey];
    return `${server.name} (${server.role}) ${f.check}: ${f.detail}`;
  });

  const smsBody = `ObitNote ${prefix}: ${lines.join('; ')}`;
  const emailBody = `ObitNote Round Robin Health Check ${prefix}\nTime: ${now}\n\n${lines.join('\n')}`;
  const emailSubject = `ObitNote Health Check ${prefix}`;

  const phones = new Set();
  if (chief) phones.add(chief.phone_number);
  for (const r of HARDCODED_RECIPIENTS) phones.add(r.phone);

  for (const phone of phones) {
    await sendSms(phone, smsBody);
  }

  const emails = new Set();
  for (const r of HARDCODED_RECIPIENTS) emails.add(r.email);

  for (const email of emails) {
    await sendEmail(email, emailSubject, emailBody);
  }
}

async function sendFailoverAlert(scenario, details) {
  const chief = await getOnCallChief();
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');

  const smsBody = `ObitNote AUTO-FAILOVER EXECUTED (${scenario}): Dallas is now serving production traffic.  DNS updated.  ${details}`;
  const emailSubject = 'ObitNote AUTO-FAILOVER EXECUTED';
  const emailBody = [
    'ObitNote AUTO-FAILOVER EXECUTED',
    `Time: ${now}`,
    `Scenario: ${scenario}`,
    '',
    details,
    '',
    'Dallas (ON-PB-DAL-1) is now serving production traffic.',
    'DNS A record for obitnote.com updated to 43.231.235.200.',
    '',
    'MANUAL ACTION REQUIRED:',
    '- Investigate Chicago failure',
    '- When Chicago is restored, follow "Switch Back to Chicago" in ObitNote.md Section 9',
    `- Remove failover marker: rm ${FAILOVER_FILE}`,
  ].join('\n');

  const phones = new Set();
  if (chief) phones.add(chief.phone_number);
  for (const r of HARDCODED_RECIPIENTS) phones.add(r.phone);

  for (const phone of phones) {
    await sendSms(phone, smsBody);
  }

  const emails = new Set();
  for (const r of HARDCODED_RECIPIENTS) emails.add(r.email);

  for (const email of emails) {
    await sendEmail(email, emailSubject, emailBody);
  }
}

// --- Cloudflare DNS ---

function updateCloudflareDns(ip) {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const recordId = process.env.CLOUDFLARE_RECORD_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!zoneId || !recordId || !token) {
    console.error('[Failover] Missing Cloudflare credentials in .env');
    return false;
  }

  const data = JSON.stringify({
    type: 'A',
    name: 'obitnote.com',
    content: ip,
    ttl: 60,
    proxied: false,
  });

  const result = run(`curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '${data}'`, 15000);

  if (result) {
    try {
      const parsed = JSON.parse(result);
      if (parsed.success) {
        console.log(`[Failover] DNS updated: obitnote.com → ${ip}`);
        return true;
      }
    } catch {}
  }
  console.error(`[Failover] DNS update FAILED`);
  return false;
}

// --- Auto-Failover ---

async function performFailover(state) {
  console.log('\n\x1b[31m*** AUTO-FAILOVER INITIATED ***\x1b[0m');
  console.log(`[Failover] Chicago web unreachable for ${FAILOVER_THRESHOLD} consecutive checks`);

  const steps = [];

  // Step 1: Check if Chicago DB is reachable through VPN
  const dbReachable = run('PGPASSWORD=ondata psql -U onadmin -h 10.0.0.2 -d dw -t -q -c "SELECT 1" 2>/dev/null');
  const dbOk = dbReachable && dbReachable.trim() === '1';
  let scenario;

  if (dbOk) {
    scenario = 'Web server failure (DB alive via VPN)';
    console.log('[Failover] Chicago DB reachable via VPN — keeping remote DB');
    run("sudo sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://onadmin:ondata@10.0.0.2:5432/dw|' /var/www/obitnote/api/.env");
    run("sudo sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://onadmin:ondata@10.0.0.2:5432/dw|' /var/www/obitnote/search/.env");
    steps.push('DATABASE_URL pointed to Chicago DB (10.0.0.2) via VPN');
  } else {
    scenario = 'Full datacenter outage (DB unreachable)';
    console.log('[Failover] Chicago DB unreachable — promoting PostgreSQL replica');
    run('sudo pg_ctlcluster 16 main promote', 30000);
    run('sleep 3');
    steps.push('PostgreSQL replica promoted to primary (localhost)');
  }

  // Step 2: Set SERVER_ROLE=primary
  run("sudo sed -i 's|SERVER_ROLE=standby|SERVER_ROLE=primary|' /var/www/obitnote/api/.env");
  steps.push('SERVER_ROLE set to primary');

  // Step 3: Restart PM2
  const pm2Result = run('pm2 restart all --update-env', 30000);
  steps.push(pm2Result !== null ? 'PM2 restarted' : 'PM2 restart FAILED');

  // Step 4: Start nginx (SSL cert already pre-staged)
  run('sudo systemctl start nginx', 15000);
  steps.push('nginx started (SSL pre-staged)');

  // Step 5: Update DNS
  const dnsOk = updateCloudflareDns(DALLAS_PUBLIC_IP);
  steps.push(dnsOk ? 'DNS updated to Dallas (43.231.235.200)' : 'DNS update FAILED — manual update required');

  // Step 6: Mark failover as executed
  markFailoverExecuted({ scenario, steps, dbReachable: dbOk });

  // Step 7: Alert
  const details = steps.join('\n');
  console.log('\n[Failover] Steps completed:');
  steps.forEach(s => console.log(`  - ${s}`));

  await sendFailoverAlert(scenario, details);

  console.log('\x1b[31m*** AUTO-FAILOVER COMPLETE ***\x1b[0m');
}

function shouldFailover(state) {
  if (isFailoverExecuted()) return false;

  const sshFails = state['prodWeb:ssh']?.consecutiveFails || 0;
  const httpsFails = state['prodWeb:https']?.consecutiveFails || 0;

  // Both paths to Chicago must be down for FAILOVER_THRESHOLD consecutive checks
  return sshFails >= FAILOVER_THRESHOLD && httpsFails >= FAILOVER_THRESHOLD;
}

// --- Main ---

async function main() {
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');
  console.log(`\nObitNote Round Robin Health Check`);
  console.log(now);
  if (isFailoverExecuted()) {
    console.log('\x1b[33m[FAILOVER MODE — Dallas is serving production]\x1b[0m');
  }
  console.log('='.repeat(60));

  const state = loadState();
  let totalPass = 0;
  let totalFail = 0;
  let totalSkip = 0;
  const newFailures = [];
  const recoveries = [];

  for (const [serverKey, server] of Object.entries(SERVERS)) {
    console.log(`\n${server.name} (${server.role}) ${server.isLocal ? '' : server.ip}`);
    console.log('-'.repeat(50));

    const results = runChecks(serverKey, server);
    for (const r of results) {
      let displayStatus;
      if (r.skipped) {
        displayStatus = SKIP;
        totalSkip++;
      } else if (r.passed) {
        displayStatus = PASS;
        totalPass++;
      } else {
        displayStatus = FAIL;
        totalFail++;
      }

      const detail = r.detail ? `  ${r.detail}` : '';
      console.log(`  ${r.check.padEnd(14)} ${displayStatus}${detail}`);

      if (r.skipped) continue;

      const prev = state[r.checkKey];

      if (r.passed) {
        if (prev && prev.consecutiveFails > 0) {
          recoveries.push(r);
        }
        delete state[r.checkKey];
      } else {
        if (!state[r.checkKey]) {
          state[r.checkKey] = { consecutiveFails: 0, lastAlertTime: null };
        }
        state[r.checkKey].consecutiveFails++;
        state[r.checkKey].lastFailDetail = r.detail;

        if (state[r.checkKey].consecutiveFails <= MAX_ALERTS) {
          newFailures.push(r);
          state[r.checkKey].lastAlertTime = new Date().toISOString();
        } else {
          console.log(`  ${''.padEnd(14)} (suppressed — alert ${state[r.checkKey].consecutiveFails}/${MAX_ALERTS} max)`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${totalPass} passed, ${totalFail} failed, ${totalSkip} skipped`);

  // Save state before failover check (so consecutive counts are current)
  saveState(state);

  // Check auto-failover conditions
  if (shouldFailover(state)) {
    await performFailover(state);
  } else {
    // Normal alerting (skip during failover execution — failover sends its own alert)
    if (newFailures.length > 0) {
      console.log(`\nSending ${newFailures.length} failure alert(s)...`);
      await sendAlerts(newFailures, false);
    }

    if (recoveries.length > 0) {
      console.log(`\nSending ${recoveries.length} recovery notification(s)...`);
      await sendAlerts(recoveries, true);
    }
  }

  if (totalFail > 0) {
    const sshFails = state['prodWeb:ssh']?.consecutiveFails || 0;
    const httpsFails = state['prodWeb:https']?.consecutiveFails || 0;
    if (sshFails > 0 && httpsFails > 0 && !isFailoverExecuted()) {
      console.log(`\n\x1b[33m[Failover countdown: SSH ${sshFails}/${FAILOVER_THRESHOLD}, HTTPS ${httpsFails}/${FAILOVER_THRESHOLD}]\x1b[0m`);
    }
    console.log('\x1b[31m*** FAILURES DETECTED ***\x1b[0m\n');
    process.exit(1);
  } else {
    console.log('\x1b[32mAll checks passed.\x1b[0m\n');
  }
}

main().catch(e => {
  console.error(`[RoundRobin] Fatal: ${e.message}`);
  process.exit(1);
});
