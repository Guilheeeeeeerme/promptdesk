import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from './api';
import { useAuth } from './auth';
import { useI18n } from './i18n';
import type { Company, CompanyDetail } from './types';
import { isPlatformRole } from './types';

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function accentFor(name: string): { bg: string; icon: string } {
  const palette = [
    {
      bg: 'bg-indigo-100 dark:bg-indigo-500/20',
      icon: 'text-indigo-600 dark:text-indigo-300',
    },
    {
      bg: 'bg-purple-100 dark:bg-purple-500/20',
      icon: 'text-purple-600 dark:text-purple-300',
    },
    {
      bg: 'bg-sky-100 dark:bg-sky-500/20',
      icon: 'text-sky-600 dark:text-sky-300',
    },
    {
      bg: 'bg-emerald-100 dark:bg-emerald-500/20',
      icon: 'text-emerald-600 dark:text-emerald-300',
    },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i)) % palette.length;
  }
  return palette[hash] ?? palette[0];
}

export function CompaniesPage() {
  const { session, refreshCompanies } = useAuth();
  const { t } = useI18n();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CompanyDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const canManage = Boolean(
    session &&
      (isPlatformRole(session.user.role) || session.user.role === 'manager'),
  );
  const canCreate = Boolean(session && isPlatformRole(session.user.role));

  const load = useCallback(async () => {
    setError(null);
    const list = await apiFetch<Company[]>('/companies');
    setCompanies(list);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t('companies.loadFailed'),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [load, t]);

  async function openGuidelines(companyId: string) {
    setViewLoading(true);
    setError(null);
    try {
      const detail = await apiFetch<CompanyDetail>(`/companies/${companyId}`);
      setViewing(detail);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('companies.guidelinesLoadFailed'),
      );
    } finally {
      setViewLoading(false);
    }
  }

  async function onUpload(companyId: string, file: File | undefined) {
    if (!file) return;
    setBusyId(companyId);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      await apiFetch(`/companies/${companyId}/guidelines`, {
        method: 'PUT',
        body,
      });
      await load();
      await refreshCompanies();
      if (viewing?.id === companyId) {
        await openGuidelines(companyId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('companies.uploadFailed'));
    } finally {
      setBusyId(null);
      const input = fileInputs.current[companyId];
      if (input) input.value = '';
    }
  }

  async function onClear(companyId: string) {
    if (!window.confirm(t('companies.clearConfirm'))) return;
    setBusyId(companyId);
    setError(null);
    try {
      await apiFetch(`/companies/${companyId}/guidelines`, {
        method: 'DELETE',
      });
      await load();
      await refreshCompanies();
      if (viewing?.id === companyId) {
        setViewing((prev) =>
          prev
            ? {
                ...prev,
                guidelineText: null,
                guidelineFileName: null,
                guidelineUpdatedAt: null,
                hasGuidelines: false,
              }
            : null,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('companies.clearFailed'));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-strong">{t('companies.loading')}</p>;
  }

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{t('companies.title')}</h1>
          <p className="mt-1 text-sm text-muted-strong">
            {t('companies.subtitle')}
          </p>
        </div>
        {canCreate && (
          <div className="mt-4 md:mt-0">
            <Link
              to="/companies/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <i className="fas fa-plus me-2" aria-hidden="true" />
              {t('companies.addCompany')}
            </Link>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-surface shadow overflow-hidden sm:rounded-md">
        {companies.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted text-center">
            {t('companies.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {companies.map((company) => {
              const accent = accentFor(company.name);
              const busy = busyId === company.id;
              return (
                <li key={company.id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-bg transition-colors duration-150">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center min-w-0">
                        <div
                          className={`flex-shrink-0 h-12 w-12 ${accent.bg} rounded-full flex items-center justify-center`}
                        >
                          <i
                            className={`fas fa-building ${accent.icon} text-xl`}
                            aria-hidden="true"
                          />
                        </div>
                        <div className="ms-4 min-w-0">
                          <div className="text-sm font-medium text-primary truncate">
                            {company.name}
                          </div>
                          <div className="text-sm text-muted truncate">
                            {company.guidelineFileName
                              ? company.guidelineFileName
                              : t('companies.noGuidelines')}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={viewLoading}
                          onClick={() => void openGuidelines(company.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-500/20 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        >
                          <i className="fas fa-eye me-1" aria-hidden="true" />
                          {t('companies.view')}
                        </button>
                        {canManage && (
                          <>
                            <input
                              ref={(el) => {
                                fileInputs.current[company.id] = el;
                              }}
                              type="file"
                              accept=".txt,text/plain"
                              className="sr-only"
                              id={`guideline-upload-${company.id}`}
                              onChange={(e) =>
                                void onUpload(
                                  company.id,
                                  e.currentTarget.files?.[0],
                                )
                              }
                            />
                            <label
                              htmlFor={`guideline-upload-${company.id}`}
                              className={`inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 cursor-pointer ${
                                busy ? 'opacity-60 pointer-events-none' : ''
                              }`}
                            >
                              <i
                                className="fas fa-file-upload me-1"
                                aria-hidden="true"
                              />
                              {company.hasGuidelines
                                ? t('companies.replaceGuidelines')
                                : t('companies.uploadGuidelines')}
                            </label>
                            {company.hasGuidelines && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void onClear(company.id)}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-60"
                              >
                                <i
                                  className="fas fa-trash me-1"
                                  aria-hidden="true"
                                />
                                {t('companies.clear')}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="flex items-center text-sm text-muted">
                        <i
                          className="fas fa-file-alt flex-shrink-0 me-1.5 text-gray-400 dark:text-gray-500"
                          aria-hidden="true"
                        />
                        <p>
                          {t('companies.updatedOn')}{' '}
                          <time
                            dateTime={company.guidelineUpdatedAt ?? undefined}
                          >
                            {company.guidelineUpdatedAt
                              ? formatDate(company.guidelineUpdatedAt)
                              : t('companies.never')}
                          </time>
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-muted sm:mt-0">
                        <i
                          className="fas fa-comments flex-shrink-0 me-1.5 text-gray-400 dark:text-gray-500"
                          aria-hidden="true"
                        />
                        <p>
                          {t('companies.conversations', {
                            count: company.messageCount ?? 0,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {viewing && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-gray-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guidelines-title"
        >
          <div className="bg-surface rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="px-4 py-4 border-b border-border flex items-start justify-between gap-4">
              <div>
                <h2
                  id="guidelines-title"
                  className="text-lg font-semibold text-text"
                >
                  {t('companies.guidelinesTitle', { name: viewing.name })}
                </h2>
                <p className="text-sm text-muted mt-1">
                  {viewing.guidelineFileName ?? t('companies.noFile')}
                  {viewing.guidelineUpdatedAt
                    ? ` · ${t('companies.updatedOn')} ${formatDate(viewing.guidelineUpdatedAt)}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="text-muted hover:text-text text-sm font-medium"
              >
                {t('companies.close')}
              </button>
            </div>
            <pre className="px-4 py-4 overflow-auto text-sm text-text whitespace-pre-wrap flex-1">
              {viewing.guidelineText?.trim()
                ? viewing.guidelineText
                : t('companies.emptyGuidelines')}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
