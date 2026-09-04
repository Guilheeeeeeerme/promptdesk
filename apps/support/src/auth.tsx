import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

  const refreshSession = useCallback(async () => {
    const data = await getSession(API_BASE);
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

  // Poll Redis session so Main company switches appear even in a split view
  // (visibility/focus events often do not fire when both panes stay visible).
  useEffect(() => {
    if (loading || !session) return;

    const id = window.setInterval(() => {
      if (!getToken()) return;
      void refreshSession().catch(() => {
        clearToken();
        redirectToSsoHandoff(MAIN_ORIGIN, window.location.href);
      });
    }, 2000);

    return () => window.clearInterval(id);
  }, [loading, session, refreshSession]);

  // Same token updated on Main → also refresh when this tab is focused.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      if (!getToken()) return;
      void refreshSession().catch(() => {
        clearToken();
        redirectToSsoHandoff(MAIN_ORIGIN, window.location.href);
      });
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refreshSession]);

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
