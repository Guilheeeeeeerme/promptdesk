import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  consumeTokenFromUrl,
  getSession,
  redirectToSsoHandoff,
  type SessionPayload,
} from '@shared/auth';
import { apiFetch, clearToken, getToken, MAIN_ORIGIN } from './api';
import {
  FOCUS_REFRESH_DEDUPE_MS,
  HIDDEN_SESSION_REFRESH_MS,
  VISIBLE_SESSION_REFRESH_MS,
} from './polling';

interface AuthContextValue {
  session: SessionPayload | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

/**
 * Survives React StrictMode remount in the same page load, but resets on full
 * refresh so we re-run SSO handoff and pick up the main app's current token.
 */
let skipHandoffOnce = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);
  const lastRefreshAtRef = useRef(0);

  const refreshSession = useCallback(async () => {
    const data = await getSession(API_BASE);
    lastRefreshAtRef.current = Date.now();
    setSession(data);
  }, []);

  useEffect(() => {
    // Prefer a freshly handed-off token from the main app (#token=).
    // :8080 and :8081 do not share localStorage — without re-handoff, Support
    // can keep an old Redis session while Main updates a different token.
    const fromUrl = consumeTokenFromUrl();
    if (fromUrl) {
      skipHandoffOnce = true;
    } else if (!skipHandoffOnce) {
      redirectToSsoHandoff(MAIN_ORIGIN, window.location.href);
      return;
    } else {
      skipHandoffOnce = false;
    }

    if (!getToken()) {
      redirectToSsoHandoff(MAIN_ORIGIN, window.location.href);
      return;
    }

    (async () => {
      try {
        await refreshSession();
      } catch {
        clearToken();
        redirectToSsoHandoff(MAIN_ORIGIN, window.location.href);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshSession]);

  // Poll Redis session so Main company switches appear even in a split view.
  // Use a slower adaptive timer because focus/visibility events handle the
  // interactive case immediately.
  useEffect(() => {
    if (loading || !session) return;

    let cancelled = false;

    const scheduleRefresh = () => {
      if (cancelled) return;
      refreshTimerRef.current = window.setTimeout(async () => {
        if (!getToken()) return;
        try {
          await refreshSession();
        } catch {
          clearToken();
          redirectToSsoHandoff(MAIN_ORIGIN, window.location.href);
          return;
        }
        scheduleRefresh();
      }, document.visibilityState === 'visible'
        ? VISIBLE_SESSION_REFRESH_MS
        : HIDDEN_SESSION_REFRESH_MS);
    };

    const refreshOnActivity = () => {
      if (document.visibilityState !== 'visible' || !getToken()) return;
      if (Date.now() - lastRefreshAtRef.current < FOCUS_REFRESH_DEDUPE_MS) return;
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      lastRefreshAtRef.current = Date.now();
      void refreshSession().catch(() => {
        clearToken();
        redirectToSsoHandoff(MAIN_ORIGIN, window.location.href);
      });
      scheduleRefresh();
    };

    const onVisibilityChange = () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      if (document.visibilityState === 'visible') {
        refreshOnActivity();
        if (refreshTimerRef.current === null) scheduleRefresh();
      } else {
        scheduleRefresh();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', refreshOnActivity);
    scheduleRefresh();

    return () => {
      cancelled = true;
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', refreshOnActivity);
    };
  }, [loading, session?.activeCompany?.id, refreshSession]);

  const logout = useCallback(async () => {
    try {
      if (getToken()) {
        await apiFetch('/auth/logout', { method: 'POST' });
      }
    } catch {
      // ignore
    } finally {
      clearToken();
      setSession(null);
      redirectToSsoHandoff(MAIN_ORIGIN, window.location.href);
    }
  }, []);

  const value = useMemo(
    () => ({ session, loading, logout, refreshSession }),
    [session, loading, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
