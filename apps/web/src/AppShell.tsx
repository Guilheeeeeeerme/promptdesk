import { useState, type ChangeEvent } from 'react';
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-indigo-600">
                  AI Support Assistant
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => {
                  const active = item.exact
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);
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
                  onClick={(e) => {
                    // Always hand the current Main token so Support shares the
                    // same Redis session (including latest activeCompanyId).
                    e.preventDefault();
                    window.open(supportHref(), '_blank', 'noopener,noreferrer');
                  }}
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Chat
                </a>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {canSwitchCompany && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="company-switcher"
                    className="text-sm text-gray-500 hidden md:inline"
                  >
                    Company
                  </label>
                  <select
                    id="company-switcher"
                    disabled={switching}
                    value={session.activeCompany?.id ?? ''}
                    onChange={onCompanyChange}
                    className="rounded-md border-gray-300 shadow-sm text-sm py-1.5 bg-white text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
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

      {switchError && (
        <div className="bg-red-50 border-b border-red-100 text-red-700 text-sm px-4 py-2 text-center">
          {switchError}
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
