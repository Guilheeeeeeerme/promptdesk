import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from './api';
import { useAuth } from './auth';
import type {
  Company,
  CompanyDetail,
  GuidelineValidationStatus,
  GuidelineVersionMeta,
} from './types';
import { isPlatformRole } from './types';

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const VALIDATION_STATUS_LABELS: Record<GuidelineValidationStatus, string> = {
  pending: 'Pending validation',
  valid: 'Valid',
  invalid: 'Invalid',
  provider_error: 'Provider error',
};

const VALIDATION_STATUS_STYLES: Record<GuidelineValidationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  valid: 'bg-emerald-100 text-emerald-800',
  invalid: 'bg-rose-100 text-rose-800',
  provider_error: 'bg-orange-100 text-orange-800',
};

function validationStatusLabel(status: string): string {
  return (
    VALIDATION_STATUS_LABELS[status as GuidelineValidationStatus] ?? status
  );
}

function validationStatusStyle(status: string): string {
  return (
    VALIDATION_STATUS_STYLES[status as GuidelineValidationStatus] ??
    'bg-gray-100 text-gray-700'
  );
}

function shortHash(value: string | null | undefined): string {
  return value ? `${value.slice(0, 12)}…` : '—';
}

function accentFor(name: string): { bg: string; icon: string } {
  const palette = [
    { bg: 'bg-indigo-100', icon: 'text-indigo-600' },
    { bg: 'bg-purple-100', icon: 'text-purple-600' },
    { bg: 'bg-sky-100', icon: 'text-sky-600' },
    { bg: 'bg-emerald-100', icon: 'text-emerald-600' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i)) % palette.length;
  }
  return palette[hash] ?? palette[0];
}

export function CompaniesPage() {
  const { session, refreshCompanies } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CompanyDetail | null>(null);
  const [viewingVersions, setViewingVersions] = useState<
    GuidelineVersionMeta[] | null
  >(null);
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
        setError(err instanceof Error ? err.message : 'Failed to load companies');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function openGuidelines(companyId: string) {
    setViewLoading(true);
    setError(null);
    try {
      const [detail, versions] = await Promise.all([
        apiFetch<CompanyDetail>(`/companies/${companyId}`),
        apiFetch<GuidelineVersionMeta[]>(
          `/companies/${companyId}/guidelines/versions`,
        ),
      ]);
      setViewing(detail);
      setViewingVersions(versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guidelines');
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
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusyId(null);
      const input = fileInputs.current[companyId];
      if (input) input.value = '';
    }
  }

  async function onClear(companyId: string) {
    if (!window.confirm('Clear guidelines for this company?')) return;
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
      setError(err instanceof Error ? err.message : 'Clear failed');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-600">Loading companies…</p>;
  }

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage company information and guidelines
          </p>
        </div>
        {canCreate && (
          <div className="mt-4 md:mt-0">
            <Link
              to="/companies/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <i className="fas fa-plus mr-2" aria-hidden="true" />
              Add Company
            </Link>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {companies.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-500 text-center">
            No companies available for your account.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {companies.map((company) => {
              const accent = accentFor(company.name);
              const busy = busyId === company.id;
              return (
                <li key={company.id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors duration-150">
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
                        <div className="ml-4 min-w-0">
                          <div className="text-sm font-medium text-indigo-600 truncate">
                            {company.name}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {company.guidelineFileName
                              ? company.guidelineFileName
                              : 'No guidelines uploaded'}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={viewLoading}
                          onClick={() => void openGuidelines(company.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <i className="fas fa-eye mr-1" aria-hidden="true" />
                          View
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
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => fileInputs.current[company.id]?.click()}
                              className={`inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 cursor-pointer ${
                                busy ? 'opacity-60 pointer-events-none' : ''
                              }`}
                            >
                              <i
                                className="fas fa-file-upload mr-1"
                                aria-hidden="true"
                              />
                              {company.hasGuidelines
                                ? 'Replace Guidelines'
                                : 'Upload Guidelines'}
                            </button>
                            {company.hasGuidelines && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void onClear(company.id)}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-60"
                              >
                                <i
                                  className="fas fa-trash mr-1"
                                  aria-hidden="true"
                                />
                                Clear
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        <i
                          className="fas fa-file-alt flex-shrink-0 mr-1.5 text-gray-400"
                          aria-hidden="true"
                        />
                        <p>
                          {company.currentVersion
                            ? `Version ${company.currentVersion} · updated on `
                            : 'Guidelines last updated on '}
                          <time
                            dateTime={company.guidelineUpdatedAt ?? undefined}
                          >
                            {formatDate(company.guidelineUpdatedAt)}
                          </time>
                        </p>
                        {company.latestValidVersion && (
                          <p className="text-xs text-gray-500">
                            Latest valid: v{company.latestValidVersion}
                            {company.latestValidVersionHash
                              ? ` · ${shortHash(company.latestValidVersionHash)}`
                              : ''}
                          </p>
                        )}
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <i
                          className="fas fa-comments flex-shrink-0 mr-1.5 text-gray-400"
                          aria-hidden="true"
                        />
                        <p>
                          {company.messageCount ?? 0} support conversations
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
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="px-4 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="guidelines-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  {viewing.name} guidelines
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {viewing.guidelineFileName ?? 'No file uploaded'}
                  {viewing.currentVersion ? ` · version ${viewing.currentVersion}` : ''}
                  {viewing.guidelineUpdatedAt
                    ? ` · updated ${formatDate(viewing.guidelineUpdatedAt)}`
                    : ''}
                </p>
                <div className="mt-3 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-gray-700">Active:</span>{' '}
                    {viewing.currentVersion
                      ? `v${viewing.currentVersion}`
                      : 'None'}
                    {viewing.currentVersion &&
                    viewingVersions?.find(
                      (version) => version.version === viewing.currentVersion,
                    )?.contentHash
                      ? ` · ${shortHash(
                          viewingVersions.find(
                            (version) =>
                              version.version === viewing.currentVersion,
                          )?.contentHash,
                        )}`
                      : ''}
                  </p>
                  <p>
                    <span className="font-medium text-gray-700">
                      Latest valid:
                    </span>{' '}
                    {viewing.latestValidVersion
                      ? `v${viewing.latestValidVersion} · ${shortHash(
                          viewing.latestValidVersionHash,
                        )}`
                      : 'None'}
                  </p>
                </div>
                {(() => {
                  const pending = viewingVersions?.find(
                    (version) => version.status === 'pending',
                  );
                  const latestAttempt = viewingVersions?.[0];
                  const replacementFailed = Boolean(
                    latestAttempt &&
                      latestAttempt.version !== viewing.currentVersion &&
                      (latestAttempt.status === 'invalid' ||
                        latestAttempt.status === 'provider_error'),
                  );
                  return (
                    <div className="mt-2 space-y-1 text-xs">
                      {pending && (
                        <p className="text-amber-700">
                          Pending version: v{pending.version} · validation in progress
                        </p>
                      )}
                      {replacementFailed && latestAttempt && (
                        <p className="text-orange-700">
                          Active guideline remains v{viewing.currentVersion ?? 'none'};{' '}
                          v{latestAttempt.version} was not activated.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewing(null);
                  setViewingVersions(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-sm font-medium"
              >
                Close
              </button>
            </div>
            {viewingVersions && viewingVersions.length > 0 && (
              <ul className="px-4 py-3 border-b border-gray-100 space-y-1 text-sm text-gray-500">
                {viewingVersions.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-gray-700">
                      v{v.version}
                    </span>
                    <span className="truncate">
                      {v.fileName ?? 'guidelines.txt'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <time
                      dateTime={v.createdAt}
                      className="flex-shrink-0 whitespace-nowrap"
                    >
                      {formatDate(v.createdAt)}
                    </time>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${validationStatusStyle(v.status)}`}
                    >
                      {validationStatusLabel(v.status)}
                    </span>
                    {v.validationReason && (
                      <span className="min-w-0 truncate text-gray-600">
                        — {v.validationReason}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <pre className="px-4 py-4 overflow-auto text-sm text-gray-800 whitespace-pre-wrap flex-1">
              {viewing.guidelineText?.trim()
                ? viewing.guidelineText
                : 'No guidelines uploaded for this company yet.'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
