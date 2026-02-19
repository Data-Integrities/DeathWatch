import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
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

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...(__DEV__ ? { cache: 'no-store' as RequestCache } : {}),
  });

  const json = await res.json();

  if (!res.ok) {
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
