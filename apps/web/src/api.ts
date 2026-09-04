import {
  ApiError,
  apiFetch as sharedApiFetch,
  clearToken,
  getToken,
  setToken,
} from '@shared/auth';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export { ApiError, clearToken, getToken, setToken };

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return sharedApiFetch<T>(API_BASE, path, options);
}

export function getAllowedReturnOrigins(): string[] {
  const fromEnv = import.meta.env.VITE_SSO_RETURN_ORIGINS as string | undefined;
  if (fromEnv) {
    return fromEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ];
}

export const SUPPORT_ORIGIN =
  (import.meta.env.VITE_SUPPORT_ORIGIN as string | undefined) ??
  'http://localhost:8081';
