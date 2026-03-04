import { pool } from '../db/pool';

/**
 * Build a search fingerprint string like "Jones, John - Austin, TX"
 */
export function buildFingerprint(search: {
  nameLast: string;
  nameFirst: string | null;
  city: string | null;
  state: string | null;
}): string {
  const parts: string[] = [];
  if (search.nameFirst) {
    parts.push(`${search.nameLast}, ${search.nameFirst}`);
  } else {
    parts.push(search.nameLast);
  }

  const locParts: string[] = [];
  if (search.city) locParts.push(search.city);
  if (search.state) locParts.push(search.state);
  if (locParts.length > 0) {
    parts.push(locParts.join(', '));
  }

  return parts.join(' - ');
}

/**
 * Fire-and-forget insert into activity_log.
 * Failures are logged, never thrown.
 */
export function logActivity(loginId: string, action: string, detail?: string): void {
  pool.query(
    `INSERT INTO activity_log (login_id, action, detail) VALUES ($1, $2, $3)`,
    [loginId, action, detail || null]
  ).catch(err => console.error('[Activity] log insert failed:', err.message));
}

export interface ActivityRow {
  location: string;
  ip: string;
  name: string;
  lastName: string;
  firstName: string;
  dateTime: string;
  action: string;
  detail: string;
}

/**
 * Admin report: all user activity in the last N hours.
 * UNIONs login_history (SignIn) with activity_log (other actions).
 */
export interface UserSummaryRow {
  firstName: string;
  lastName: string;
  location: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  signInCount: number;
  searchesCount: number;
  matchesCount: number;
  searchesDeletedCount: number;
  rightPersonCount: number;
  wrongPersonCount: number;
  searchEditCount: number;
}

/**
 * Admin report: all registered users with lifetime activity counts.
 */
export async function getUsersSummary(): Promise<UserSummaryRow[]> {
  const { rows } = await pool.query(
    `SELECT u.first_name, u.last_name, u.email, u.is_admin, u.created_at,
       (SELECT CONCAT_WS(', ', NULLIF(lh.geo_city, ''), NULLIF(lh.geo_region, ''))
        FROM login_history lh WHERE lh.login_id = u.login_id ORDER BY lh.login_at ASC LIMIT 1) AS signup_location,
       (SELECT COUNT(*) FROM login_history lh WHERE lh.login_id = u.login_id) AS sign_in_count,
       (SELECT COUNT(*) FROM user_query uq WHERE uq.login_id = u.login_id AND uq.disabled = false) AS searches_count,
       (SELECT COUNT(*) FROM user_result ur JOIN user_query uq ON ur.user_query_id = uq.id WHERE uq.login_id = u.login_id) AS matches_count,
       (SELECT COUNT(*) FROM user_query uq WHERE uq.login_id = u.login_id AND uq.disabled = true) AS searches_deleted_count,
       (SELECT COUNT(*) FROM user_result ur JOIN user_query uq ON ur.user_query_id = uq.id WHERE uq.login_id = u.login_id AND ur.status = 'confirmed') AS right_person_count,
       (SELECT COUNT(*) FROM user_result ur JOIN user_query uq ON ur.user_query_id = uq.id WHERE uq.login_id = u.login_id AND ur.status = 'rejected') AS wrong_person_count,
       (SELECT COUNT(*) FROM activity_log al WHERE al.login_id = u.login_id AND al.action = 'Search Edit') AS search_edit_count
     FROM dw_user u
     ORDER BY u.created_at DESC`
  );

  return rows.map(row => ({
    firstName: row.first_name,
    lastName: row.last_name,
    location: row.signup_location || '',
    email: row.email,
    isAdmin: row.is_admin,
    createdAt: row.created_at?.toISOString?.() || row.created_at || '',
    signInCount: Number(row.sign_in_count),
    searchesCount: Number(row.searches_count),
    matchesCount: Number(row.matches_count),
    searchesDeletedCount: Number(row.searches_deleted_count),
    rightPersonCount: Number(row.right_person_count),
    wrongPersonCount: Number(row.wrong_person_count),
    searchEditCount: Number(row.search_edit_count),
  }));
}

export async function getRecentActivity(startDate: string, endDate: string): Promise<ActivityRow[]> {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(lh.geo_city, '') AS geo_city,
       COALESCE(lh.geo_region, '') AS geo_region,
       COALESCE(lh.ip_address, '') AS ip_address,
       u.first_name,
       u.last_name,
       lh.login_at AS created_at,
       'SignIn' AS action,
       '' AS detail
     FROM login_history lh
     JOIN dw_user u ON u.login_id = lh.login_id
     WHERE lh.login_at >= $1::date AND lh.login_at < ($2::date + interval '1 day')

     UNION ALL

     SELECT
       COALESCE(latest_login.geo_city, '') AS geo_city,
       COALESCE(latest_login.geo_region, '') AS geo_region,
       COALESCE(latest_login.ip_address, '') AS ip_address,
       u.first_name,
       u.last_name,
       al.created_at,
       al.action,
       COALESCE(al.detail, '') AS detail
     FROM activity_log al
     JOIN dw_user u ON u.login_id = al.login_id
     LEFT JOIN LATERAL (
       SELECT lh.geo_city, lh.geo_region, lh.ip_address
       FROM login_history lh
       WHERE lh.login_id = al.login_id AND lh.login_at <= al.created_at
       ORDER BY lh.login_at DESC
       LIMIT 1
     ) latest_login ON true
     WHERE al.created_at >= $1::date AND al.created_at < ($2::date + interval '1 day')

     ORDER BY created_at DESC`,
    [startDate, endDate]
  );

  return rows.map(row => {
    const locParts: string[] = [];
    if (row.geo_city) locParts.push(row.geo_city);
    if (row.geo_region) locParts.push(row.geo_region);

    return {
      location: locParts.join(', '),
      ip: row.ip_address || '',
      name: `${row.first_name} ${row.last_name}`,
      lastName: row.last_name,
      firstName: row.first_name,
      dateTime: row.created_at?.toISOString?.() || row.created_at || '',
      action: row.action === 'Search' ? 'Home list' : row.action === 'Match' ? 'Obit list' : row.action,
      detail: row.detail || '',
    };
  });
}
