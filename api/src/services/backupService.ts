import { pool } from '../db/pool';
import { reportFatalError } from './fatalErrorService';
import { sendBackupAlertEmail } from './emailService';

const ALERT_RECIPIENTS = ['support@obitnote.com', 'james.jones@obitnote.com'];
const MIN_BACKUP_SIZE = 10240;

export async function reportBackup(data: {
  pgDumpOk: boolean;
  filePath?: string;
  fileSizeBytes?: number;
  idriveOk: boolean;
  errorMessage?: string;
}) {
  const { rows } = await pool.query(
    `INSERT INTO backup_log (file_path, file_size_bytes, pg_dump_ok, idrive_ok, error_message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, backup_date`,
    [data.filePath || null, data.fileSizeBytes || 0, data.pgDumpOk, data.idriveOk, data.errorMessage || null]
  );
  console.log(`[Backup] Logged backup report id=${rows[0].id} date=${rows[0].backup_date} pgDump=${data.pgDumpOk} idrive=${data.idriveOk} size=${data.fileSizeBytes || 0}`);

  if (!data.pgDumpOk || !data.idriveOk) {
    await sendBackupAlert(data.errorMessage || 'Backup script reported failure');
  } else if ((data.fileSizeBytes || 0) < MIN_BACKUP_SIZE) {
    await sendBackupAlert(`Backup file suspiciously small: ${data.fileSizeBytes} bytes`);
  }

  return { id: rows[0].id, backupDate: rows[0].backup_date };
}

export async function checkTodayBackup() {
  const { rows } = await pool.query(
    `SELECT id, pg_dump_ok, idrive_ok, file_size_bytes
     FROM backup_log
     WHERE backup_date = CURRENT_DATE AND pg_dump_ok = true AND idrive_ok = true AND file_size_bytes >= $1
     LIMIT 1`,
    [MIN_BACKUP_SIZE]
  );

  if (rows.length === 0) {
    console.warn('[Backup] No successful backup found for today — sending alert');
    await sendBackupAlert('No successful backup report received for today');
  } else {
    console.log(`[Backup] Today's backup verified OK (id=${rows[0].id}, ${rows[0].file_size_bytes} bytes)`);
  }
}

const DB_SIZE_WARN_MB = 1024;

export async function checkDatabaseHealth() {
  try {
    const { rows } = await pool.query(
      `SELECT pg_database_size('dw') AS size_bytes,
              pg_size_pretty(pg_database_size('dw')) AS size_pretty`
    );
    const sizeMb = Math.round(rows[0].size_bytes / 1024 / 1024);
    console.log(`[DBHealth] Database size: ${rows[0].size_pretty} (${sizeMb} MB)`);

    if (sizeMb >= DB_SIZE_WARN_MB) {
      await sendInfraAlert('database', `Database size is ${rows[0].size_pretty} (threshold: ${DB_SIZE_WARN_MB} MB)`);
    }
  } catch (err: any) {
    console.error('[DBHealth] Database health check FAILED:', err.message);
    await sendInfraAlert('database', `Database unreachable: ${err.message}`);
  }
}

async function sendInfraAlert(source: string, message: string) {
  reportFatalError(source, null, message).catch(() => {});

  for (const recipient of ALERT_RECIPIENTS) {
    sendBackupAlertEmail(recipient, message).catch(err =>
      console.error(`[Infra] Failed to send alert to ${recipient}:`, err)
    );
  }
}

async function sendBackupAlert(message: string) {
  await sendInfraAlert('backup', message);
}
