import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setOnUnauthorized(callback: (() => void) | null) {
  onUnauthorized = callback;
}

function reportError(error: string, path: string) {
  if (!authToken) return;
  const page = Platform.OS === 'web' ? window.location.pathname : path;
  const userAgent = Platform.OS === 'web' ? navigator.userAgent : `${Platform.OS} ${Platform.Version}`;
  fetch(`${API_BASE}/api/errors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ error, page, userAgent }),
  }).catch(() => {});
}

async function request<T>(
  method: string,
  path: string,
  body?: any,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...(__DEV__ ? { cache: 'no-store' as RequestCache } : {}),
    });
  } catch (err: any) {
    const message = err.message || 'Failed to fetch';
    if (path !== '/api/errors') {
      reportError(`${method} ${path}: ${message}`, path);
    }
    throw err;
  }

  const json = await res.json();

  if (!res.ok) {
    if (
      res.status === 401 &&
      onUnauthorized &&
      path !== '/api/auth/login' &&
      path !== '/api/auth/register'
    ) {
      onUnauthorized();
      // Never resolve — signOut will redirect to sign-in and unmount the caller
      return new Promise<T>(() => {});
    }
    if (res.status >= 400 && res.status !== 401 && res.status !== 404 && path !== '/api/errors') {
      reportError(`${method} ${path}: ${res.status} ${json.error || 'Server error'}`, path);
    }
    const error = new Error(json.error || 'Request failed') as any;
    error.status = res.status;
    throw error;
  }

  return json;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: any) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: any) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
