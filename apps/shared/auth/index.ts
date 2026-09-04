export const TOKEN_KEY = 'session_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  apiBase: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  // Let the browser set multipart boundary for FormData uploads.
  if (!headers.has('Content-Type') && options.body && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const base = apiBase.replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    throw new ApiError(401, 'Unauthorized');
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(data.message)) {
        message = data.message.join(', ');
      } else if (data.message) {
        message = data.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export type Role = 'root' | 'admin' | 'manager' | 'agent';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface SessionPayload {
  user: SessionUser;
  activeCompany: { id: string; name: string } | null;
}

export interface LoginResponse extends SessionPayload {
  token: string;
}

export function isPlatformRole(role: Role): boolean {
  return role === 'root' || role === 'admin';
}

export function getSession(apiBase: string): Promise<SessionPayload> {
  return apiFetch<SessionPayload>(apiBase, '/auth/me');
}

/** Build main-app login URL that returns to an MFE after SSO. */
export function buildLoginRedirectUrl(
  mainOrigin: string,
  returnUrl: string,
): string {
  const url = new URL('/login', mainOrigin.replace(/\/$/, ''));
  url.searchParams.set('returnUrl', returnUrl);
  return url.toString();
}

/**
 * Allowlist check for SSO return URLs.
 * Origins may be exact (`http://localhost:8081`) or listed as host:port.
 */
export function isAllowedReturnUrl(
  returnUrl: string,
  allowedOrigins: string[],
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(returnUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const origin = parsed.origin;
  return allowedOrigins.some((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return false;
    try {
      return new URL(trimmed).origin === origin;
    } catch {
      return trimmed === origin;
    }
  });
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Read token from `#token=` (preferred) or `?token=`, store it, clean the URL.
 * Returns the token if one was consumed.
 */
export function consumeTokenFromUrl(
  loc: Location = window.location,
): string | null {
  let token: string | null = null;

  if (loc.hash) {
    const hash = loc.hash.startsWith('#') ? loc.hash.slice(1) : loc.hash;
    const params = new URLSearchParams(hash);
    token = params.get('token');
    if (token) {
      params.delete('token');
      const nextHash = params.toString();
      const clean = `${loc.pathname}${loc.search}${nextHash ? `#${nextHash}` : ''}`;
      window.history.replaceState(null, '', clean);
    }
  }

  if (!token) {
    const params = new URLSearchParams(loc.search);
    token = params.get('token');
    if (token) {
      params.delete('token');
      const qs = params.toString();
      const clean = `${loc.pathname}${qs ? `?${qs}` : ''}${loc.hash}`;
      window.history.replaceState(null, '', clean);
    }
  }

  if (token) {
    setToken(token);
  }

  return token;
}

/** Append opaque session token to a return URL using the hash fragment. */
export function appendTokenToReturnUrl(returnUrl: string, token: string): string {
  const url = new URL(returnUrl);
  const hashParams = new URLSearchParams(
    url.hash.startsWith('#') ? url.hash.slice(1) : url.hash,
  );
  hashParams.set('token', token);
  url.hash = hashParams.toString();
  return url.toString();
}

/** Build silent SSO handoff URL on the main app (no login form if already signed in). */
export function buildSsoHandoffUrl(
  mainOrigin: string,
  returnUrl: string,
): string {
  const url = new URL('/sso/handoff', mainOrigin.replace(/\/$/, ''));
  url.searchParams.set('returnUrl', returnUrl);
  return url.toString();
}

export function redirectToLogin(mainOrigin: string, returnUrl?: string): void {
  const target = returnUrl ?? window.location.href;
  window.location.assign(buildLoginRedirectUrl(mainOrigin, target));
}

/** Re-sync MFE session from the main app’s current token (cross-origin localStorage). */
export function redirectToSsoHandoff(
  mainOrigin: string,
  returnUrl?: string,
): void {
  const target = (returnUrl ?? window.location.href).split('#')[0];
  window.location.assign(buildSsoHandoffUrl(mainOrigin, target));
}
