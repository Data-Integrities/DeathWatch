import { pool } from '../db/pool';
import { lookupGeo } from './geoService';

export function logPageHit(page: string, ip: string | undefined): void {
  const geo = lookupGeo(ip);
  pool.query(
    `INSERT INTO page_hit (page, ip_address, geo_city, geo_region, geo_country, geo_lat, geo_lon)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [page, ip || null, geo?.city || null, geo?.region || null, geo?.country || null, geo?.lat ?? null, geo?.lon ?? null]
  ).catch(err => console.error('[PageHit] insert failed:', err.message));
}

export interface PageHitSummaryRow {
  location: string;
  hitCount: number;
}

export async function getPageHitSummary(
  startDate: string,
  endDate: string,
  page?: string,
): Promise<PageHitSummaryRow[]> {
  const pageFilter = page ? 'AND page = $3' : '';
  const params: any[] = [startDate, endDate];
  if (page) params.push(page);

  const { rows } = await pool.query(
    `SELECT
       COALESCE(NULLIF(CONCAT_WS(', ', NULLIF(geo_city, ''), NULLIF(geo_region, ''), NULLIF(geo_country, '')), ''), 'Unknown') AS location,
       COUNT(*)::int AS hit_count
     FROM page_hit
     WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
       ${pageFilter}
     GROUP BY location
     ORDER BY hit_count DESC`,
    params
  );

  return rows.map(r => ({
    location: r.location,
    hitCount: r.hit_count,
  }));
}

export async function getTrackedPages(): Promise<string[]> {
  const { rows } = await pool.query(
    'SELECT DISTINCT page FROM page_hit ORDER BY page'
  );
  return rows.map(r => r.page);
}
