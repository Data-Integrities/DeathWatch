import fs from 'fs';
import { Reader, ReaderModel } from '@maxmind/geoip2-node';

const DB_PATH = process.env.GEOLITE_DB_PATH || '/var/www/obitnote/data/GeoLite2-City.mmdb';

let reader: ReaderModel | null = null;

try {
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    reader = Reader.openBuffer(buffer);
    console.log('[Geo] GeoLite2-City database loaded');
  } else {
    console.warn(`[Geo] GeoLite2-City database not found at ${DB_PATH} — geo lookups will return null`);
  }
} catch (err: any) {
  console.error('[Geo] Failed to load GeoLite2-City database:', err.message);
}

export interface GeoResult {
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
}

export function lookupGeo(ip: string | undefined): GeoResult | null {
  if (!ip || !reader) return null;

  try {
    const response = reader.city(ip);

    return {
      city: response.city?.names?.en || null,
      region: response.subdivisions?.[0]?.isoCode || null,
      country: response.country?.isoCode || null,
      lat: response.location?.latitude ?? null,
      lon: response.location?.longitude ?? null,
    };
  } catch {
    // Private IPs, localhost, or unknown addresses — expected, not an error
    return null;
  }
}
