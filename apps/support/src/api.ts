import {
  ApiError,
  apiFetch as sharedApiFetch,
  clearToken,
  getToken,
  setToken,
} from '@shared/auth';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export { ApiError, clearToken, getToken, setToken };

export const MAIN_ORIGIN =
  (import.meta.env.VITE_MAIN_ORIGIN as string | undefined) ??
  'http://localhost:8080';

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return sharedApiFetch<T>(API_BASE, path, options);
}

/** Origin used for Socket.IO (same host; nginx proxies /socket.io). */
export function getApiOrigin(): string {
  if (API_BASE.startsWith('http')) {
    return API_BASE.replace(/\/$/, '');
  }
  return window.location.origin;
}

export function getSocketPath(): string {
  return '/socket.io';
}
