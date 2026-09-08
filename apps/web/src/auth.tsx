import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, clearToken, getToken, setToken } from './api';
import type { Company, LoginResponse, SessionPayload } from './types';
import { isPlatformRole } from './types';

interface AuthContextValue {
  session: SessionPayload | null;
  companies: Company[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshCompanies: () => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  canSwitchCompany: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompanies = useCallback(async () => {
    const list = await apiFetch<Company[]>('/companies');
    setCompanies(list);
  }, []);

  const refreshSession = useCallback(async () => {
    const data = await apiFetch<SessionPayload>('/auth/me');
    setSession(data);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        await refreshSession();
        await loadCompanies();
      } catch {
        clearToken();
        setSession(null);
        setCompanies([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCompanies, refreshSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setSession({ user: data.user, activeCompany: data.activeCompany });
      await loadCompanies();
    },
    [loadCompanies],
  );

  const loginDemo = useCallback(async () => {
    const data = await apiFetch<LoginResponse>('/auth/demo', {
      method: 'POST',
    });
    setToken(data.token);
    setSession({ user: data.user, activeCompany: data.activeCompany });
    await loadCompanies();
  }, [loadCompanies]);

  const logout = useCallback(async () => {
    try {
      if (getToken()) {
        await apiFetch('/auth/logout', { method: 'POST' });
      }
    } catch {
      // ignore logout errors
    } finally {
      clearToken();
      setSession(null);
      setCompanies([]);
    }
  }, []);

  const switchCompany = useCallback(async (companyId: string) => {
    const data = await apiFetch<LoginResponse>('/auth/context', {
      method: 'PATCH',
      body: JSON.stringify({ companyId }),
    });
    setSession({ user: data.user, activeCompany: data.activeCompany });
    // Re-fetch from Redis so UI matches server truth (same as MFEs will see).
    const fresh = await apiFetch<SessionPayload>('/auth/me');
    setSession(fresh);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      companies,
      loading,
      login,
      loginDemo,
      logout,
      refreshSession,
      refreshCompanies: loadCompanies,
      switchCompany,
      canSwitchCompany: Boolean(
        session && isPlatformRole(session.user.role),
      ),
    }),
    [
      session,
      companies,
      loading,
      login,
      loginDemo,
      logout,
      refreshSession,
      loadCompanies,
      switchCompany,
    ],
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
