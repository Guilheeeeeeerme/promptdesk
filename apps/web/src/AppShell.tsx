import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { appendTokenToReturnUrl } from '@shared/auth';
import { getToken, SUPPORT_ORIGIN } from './api';
import { useAuth } from './auth';

const navItems = [
  { to: '/', label: 'Home', exact: true },
  { to: '/history', label: 'History' },
  { to: '/companies', label: 'Companies' },
];

function supportHref(): string {
  const token = getToken();
  const base = SUPPORT_ORIGIN.endsWith('/')
    ? SUPPORT_ORIGIN
    : `${SUPPORT_ORIGIN}/`;
  return token ? appendTokenToReturnUrl(base, token) : base;
}

export function AppShell() {
  const { session, loading, logout, companies, canSwitchCompany, switchCompany } =
    useAuth();
  const location = useLocation();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = drawerRef.current?.querySelector<HTMLElement>(
      'a, button, select, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      (previouslyFocused ?? menuButtonRef.current)?.focus?.();
    };
  }, [navOpen]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Loading session…
      </div>
    );
  }

  if (!session || !getToken()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  async function onCompanyChange(event: ChangeEvent<HTMLSelectElement>) {
    const companyId = event.currentTarget.value;
    if (!companyId || companyId === session?.activeCompany?.id) {
      return;
    }
    setSwitchError(null);
    setSwitching(true);
    try {
      await switchCompany(companyId);
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : 'Switch failed');
    } finally {
      setSwitching(false);
    }
  }

  function openSupport(e: MouseEvent<HTMLAnchorElement>) {
    // Always hand the current Main token so Support shares the
    // same Redis session (including latest activeCompanyId).
    e.preventDefault();
    setNavOpen(false);
    window.open(supportHref(), '_blank', 'noopener,noreferrer');
  }

  function isActive(item: (typeof navItems)[number]): boolean {
    return item.exact
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to);
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 overflow-x-hidden">
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                ref={menuButtonRef}
                type="button"
                className="md:hidden inline-flex items-center justify-center rounded-md border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50 shrink-0"
                aria-label="Open navigation menu"
                aria-expanded={navOpen}
                aria-controls="main-nav-drawer"
                onClick={() => setNavOpen(true)}
              >
                <span aria-hidden="true" className="block w-4 space-y-1">
                  <span className="block h-px bg-current" />
                  <span className="block h-px bg-current" />
                  <span className="block h-px bg-current" />
                </span>
              </button>
              <h1 className="text-lg sm:text-xl font-bold text-indigo-600 truncate">
                AI Support Assistant
              </h1>
              <div className="ml-2 hidden md:flex flex-wrap items-center gap-x-6 gap-y-1 lg:ml-6 lg:gap-x-8">
                {navItems.map((item) => {
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={
                        active
                          ? 'border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                      }
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <a
                  href={supportHref()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={openSupport}
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Chat
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              {canSwitchCompany && (
                <div className="hidden sm:flex items-center gap-2">
                  <label
                    htmlFor="company-switcher"
                    className="text-sm text-gray-500 hidden lg:inline"
                  >
                    Company
                  </label>
                  <select
                    id="company-switcher"
                    disabled={switching}
                    value={session.activeCompany?.id ?? ''}
                    onChange={onCompanyChange}
                    className="rounded-md border-gray-300 shadow-sm text-sm py-1.5 bg-white text-gray-900 focus:border-indigo-500 focus:ring-indigo-500 max-w-[10rem] lg:max-w-none"
                  >
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <span className="text-sm text-gray-600 hidden lg:inline">
                {session.user.name} ({session.user.role})
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-gray-900/40 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        ref={drawerRef}
        id="main-nav-drawer"
        aria-label="Main navigation"
        className={`fixed inset-y-0 start-0 z-50 w-[min(18rem,88vw)] bg-white shadow-lg flex flex-col transition-transform duration-200 ease-out md:hidden ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">Menu</p>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 px-2 py-1"
            aria-label="Close navigation menu"
          >
            Close
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`block rounded-md px-3 py-2.5 text-sm font-medium ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <a
            href={supportHref()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openSupport}
            className="block rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Chat
          </a>
        </nav>
        {canSwitchCompany && (
          <div className="border-t border-gray-100 px-4 py-3 sm:hidden">
            <label
              htmlFor="company-switcher-mobile"
              className="block text-xs font-medium text-gray-500 mb-1"
            >
              Company
            </label>
            <select
              id="company-switcher-mobile"
              disabled={switching}
              value={session.activeCompany?.id ?? ''}
              onChange={onCompanyChange}
              className="w-full rounded-md border-gray-300 shadow-sm text-sm py-2 bg-white text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          {session.user.name} ({session.user.role})
        </div>
      </aside>

      {switchError && (
        <div className="bg-red-50 border-b border-red-100 text-red-700 text-sm px-4 py-2 text-center">
          {switchError}
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
