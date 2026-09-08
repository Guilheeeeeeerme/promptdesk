import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  appendTokenToReturnUrl,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
} from '@shared/auth';
import {
  Banner,
  Button,
  ExternalLinkIcon,
  IconButton,
  MenuIcon,
  Select,
  ThemeToggle,
  cn,
} from '@shared/ui';
import { getToken, SUPPORT_ORIGIN } from './api';
import { useAuth } from './auth';
import type { Role } from './types';
import { useLocale } from './locale';

const navItems: Array<{
  to: string;
  label: string;
  exact?: boolean;
  roles?: Role[];
}> = [
  { to: '/', label: 'Home', exact: true },
  { to: '/history', label: 'History' },
  { to: '/companies', label: 'Companies' },
  { to: '/users', label: 'Users', roles: ['root', 'admin', 'manager', 'owner'] },
];

function supportHref(): string {
  const token = getToken();
  const base = SUPPORT_ORIGIN.endsWith('/')
    ? SUPPORT_ORIGIN
    : `${SUPPORT_ORIGIN}/`;
  return token ? appendTokenToReturnUrl(base, token) : base;
}

function NavLinkItem({
  to,
  label,
  active,
}: {
  to: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center rounded-sm px-3 py-2 text-14 font-medium',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        active
          ? 'bg-accent-muted text-info-foreground'
          : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary',
      )}
    >
      {label}
    </Link>
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
  const { locale, setLocale, t } = useLocale();

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
      <div className="flex min-h-dvh items-center justify-center bg-surface-base text-14 text-ink-secondary">
        {t('Loading session…')}
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
      setSwitchError(err instanceof Error ? err.message : t('Switch failed'));
    } finally {
      setSwitching(false);
    }
  }

  function openSupport(e: MouseEvent<HTMLAnchorElement>) {
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
    <div className="flex min-h-dvh overflow-x-hidden bg-surface-base">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-52 md:shrink-0 md:flex-col md:border-e md:border-line">
        <div className="border-b border-line-subtle px-4 py-5">
          <p className="text-12 font-medium uppercase tracking-wide text-ink-tertiary">
            PromptDesk
          </p>
          <h1 className="mt-1 text-balance text-15 font-semibold text-ink-primary">
            {t('AI Support Assistant')}
          </h1>
        </div>
        {canSwitchCompany ? (
          <div className="border-b border-line-subtle px-4 py-4">
            <label
              htmlFor="company-switcher"
              className="mb-1.25 block text-12 font-medium text-ink-tertiary"
            >
              {t('Company')}
            </label>
            <Select
              id="company-switcher"
              disabled={switching}
              value={session.activeCompany?.id ?? ''}
              onChange={onCompanyChange}
              className="py-1.5 text-13"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="border-b border-line-subtle px-4 py-4">
            <span className="mb-1.25 block text-12 font-medium text-ink-tertiary">
              {t('Company')}
            </span>
            <span className="block truncate text-14 font-medium text-ink-primary">
              {session.activeCompany?.name ?? t('No company')}
            </span>
          </div>
        )}
        <nav
          aria-label={t('Main navigation')}
          className="flex-1 space-y-1 px-2 py-4"
        >
          {visibleNavItems.map((item) => (
            <NavLinkItem
              key={item.to}
              to={item.to}
              label={t(item.label)}
              active={isActive(item)}
            />
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-surface-base supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex h-[52px] max-w-content items-center justify-between gap-3 px-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <IconButton
                ref={menuButtonRef}
                label={t('Open navigation menu')}
                aria-expanded={navOpen}
                aria-controls="main-nav-drawer"
                className="md:hidden"
                onClick={() => setNavOpen(true)}
              >
                <MenuIcon className="size-4" />
              </IconButton>
              <h1 className="truncate text-15 font-semibold text-ink-primary md:hidden">
                PromptDesk
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <a
                href={supportHref()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openSupport}
                aria-label={t('Chat (opens in new tab)')}
                className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-13 font-medium text-ink-secondary hover:bg-surface-hover hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t('Chat')}
                <ExternalLinkIcon className="size-3.5 shrink-0" />
              </a>
              <ThemeToggle
                labelDark={t('Dark mode')}
                labelLight={t('Light mode')}
              />
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className="max-w-[9rem] truncate"
                >
                  {session.user.name}
                </Button>
                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute end-0 mt-1.25 w-52 rounded-md border border-line bg-surface-overlay py-1 shadow-overlay"
                  >
                    <div className="border-b border-line-subtle px-3 py-2 text-12 text-ink-tertiary">
                      {session.user.email}
                    </div>
                    <label
                      className="block px-3 pt-2 text-12 text-ink-tertiary"
                      htmlFor="language-select"
                    >
                      {t('Language')}
                    </label>
                    <Select
                      id="language-select"
                      value={locale}
                      onChange={(e) =>
                        void setLocale(e.target.value as typeof locale)
                      }
                      className="mx-3 my-1 w-[calc(100%-1.5rem)] py-1 text-13"
                    >
                      {SUPPORTED_LOCALES.map((supported) => (
                        <option key={supported} value={supported}>
                          {LOCALE_LABELS[supported]}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void logout()}
                      className="block w-full px-3 py-2 text-start text-14 text-ink-secondary hover:bg-surface-hover hover:text-ink-primary"
                    >
                      {t('Log out')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {navOpen && (
          <button
            type="button"
            aria-label={t('Close navigation menu')}
            className="fixed inset-0 z-40 bg-scrim md:hidden"
            onClick={() => setNavOpen(false)}
          />
        )}

        <aside
          ref={drawerRef}
          id="main-nav-drawer"
          aria-label={t('Main navigation')}
          className={cn(
            'fixed inset-y-0 start-0 z-50 flex w-[min(18rem,88vw)] flex-col border-e border-line bg-surface-raised md:hidden',
            'transition-transform duration-200 ease-out',
            'supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]',
            navOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-4 py-3">
            <p className="text-14 font-semibold text-ink-primary">{t('Menu')}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNavOpen(false)}
              aria-label={t('Close navigation menu')}
            >
              {t('Close')}
            </Button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
            {visibleNavItems.map((item) => (
              <NavLinkItem
                key={item.to}
                to={item.to}
                label={t(item.label)}
                active={isActive(item)}
              />
            ))}
            <a
              href={supportHref()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={openSupport}
              className="flex items-center gap-1.5 rounded-sm px-3 py-2 text-14 font-medium text-ink-secondary hover:bg-surface-hover hover:text-ink-primary"
              aria-label={t('Chat (opens in new tab)')}
            >
              {t('Chat')}
              <ExternalLinkIcon className="size-3.5 shrink-0" />
            </a>
          </nav>
          {canSwitchCompany && (
            <div className="border-t border-line-subtle px-4 py-3 sm:hidden">
              <label
                htmlFor="company-switcher-mobile"
                className="mb-1 block text-12 font-medium text-ink-tertiary"
              >
                {t('Company')}
              </label>
              <Select
                id="company-switcher-mobile"
                disabled={switching}
                value={session.activeCompany?.id ?? ''}
                onChange={onCompanyChange}
                className="py-1.5 text-13"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {!canSwitchCompany && (
            <div className="border-t border-line-subtle px-4 py-3 sm:hidden">
              <span className="mb-1 block text-12 font-medium text-ink-tertiary">
                {t('Company')}
              </span>
              <span className="block truncate text-14 font-medium text-ink-primary">
                {session.activeCompany?.name ?? t('No company')}
              </span>
            </div>
          )}
          <div className="border-t border-line-subtle px-4 py-3 text-12 text-ink-tertiary">
            {session.user.name} ({t(session.user.role)})
          </div>
        </aside>

        {switchError && (
          <Banner tone="error" className="rounded-none border-x-0 border-t-0">
            {switchError}
          </Banner>
        )}

        <main className="mx-auto w-full max-w-content min-w-0 flex-1 px-4 py-4 sm:px-5 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
