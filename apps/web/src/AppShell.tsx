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
import type { Role } from './types';

const navItems: Array<{
  to: string;
  label: string;
  exact?: boolean;
  roles?: Role[];
}> = [
  { to: '/', label: 'Home', exact: true },
  { to: '/history', label: 'History' },
  { to: '/companies', label: 'Companies' },

  { to: '/users', label: 'Users', roles: ['root', 'admin', 'manager'] },
];

function supportHref(): string {
  const token = getToken();
  const base = SUPPORT_ORIGIN.endsWith('/')
    ? SUPPORT_ORIGIN
    : `${SUPPORT_ORIGIN}/`;
  return token ? appendTokenToReturnUrl(base, token) : base;
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6.5 3.5H3.5A1 1 0 0 0 2.5 4.5v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3" />
      <path d="M9.5 2.5h4v4" />
      <path d="M7.5 8.5 13.5 2.5" />
    </svg>
  );
}

export function AppShell() {
  const { session, loading, logout, companies, canSwitchCompany, switchCompany } =
    useAuth();
  const location = useLocation();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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

  useEffect(() => {
    if (!userMenuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userMenuOpen]);

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

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(session.user.role),
  );

  return (
    <div className="min-h-dvh flex bg-gray-50 overflow-x-hidden">
      <aside className="hidden md:flex md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 bg-white border-r border-gray-200 flex-col">
        <div className="px-6 py-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-indigo-600 leading-tight">
            AI Support Assistant
          </h1>
        </div>
        {canSwitchCompany && (
          <div className="px-4 py-5 border-b border-gray-100">
            <label
              htmlFor="company-switcher"
              className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2"
            >
              Company
            </label>
            <select
              id="company-switcher"
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
        {!canSwitchCompany && (
          <div className="px-4 py-5 border-b border-gray-100">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Company
            </span>
            <span className="block truncate text-sm font-medium text-gray-900">
              {session.activeCompany?.name ?? 'No company'}
            </span>
          </div>
        )}
        <nav aria-label="Main navigation" className="flex-1 px-3 py-5 space-y-1">
          {visibleNavItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center rounded-md px-3 py-2.5 text-sm font-medium ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 flex flex-col">
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
              <h1 className="md:hidden text-lg sm:text-xl font-bold text-indigo-600 truncate">
                AI Support Assistant
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <a
                href={supportHref()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openSupport}
                aria-label="Chat (opens in new tab)"
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-indigo-700"
              >
                Chat
                <ExternalLinkIcon className="size-3.5 shrink-0" />
              </a>
                <div className="relative">
                  <button
                    type="button"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => setUserMenuOpen((open) => !open)}
                    className="max-w-[9rem] truncate text-sm font-medium text-gray-700 hover:text-indigo-700"
                  >
                    {session.user.name}
                  </button>
                  {userMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                    >
                      <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                        {session.user.email}
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void logout()}
                        className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Log out
                      </button>
                    </div>
                  )}
                </div>
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
          {visibleNavItems.map((item) => {
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
            aria-label="Chat (opens in new tab)"
            className="flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Chat
            <ExternalLinkIcon className="size-3.5 shrink-0" />
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
        {!canSwitchCompany && (
          <div className="border-t border-gray-100 px-4 py-3 sm:hidden">
            <span className="block text-xs font-medium text-gray-500 mb-1">
              Company
            </span>
            <span className="block truncate text-sm font-medium text-gray-900">
              {session.activeCompany?.name ?? 'No company'}
            </span>
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
    </div>
  );
}
