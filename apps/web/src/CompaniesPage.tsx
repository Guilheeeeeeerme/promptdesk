import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
  apiFetch,
  getApiOrigin,
  getSocketPath,
  getToken,
} from './api';
import { useAuth } from './auth';
import type {
  Company,
  CompanyDetail,
  GuidelineValidationEvent,
  GuidelineValidationStatus,
  GuidelineVersionDetail,
  GuidelineVersionMeta,
} from './types';
import { isPlatformRole } from './types';
import { FeedbackBanner, type Feedback } from './FeedbackBanner';

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

const VALIDATION_STATUS_LABELS: Record<GuidelineValidationStatus, string> = {
  pending: 'Pending validation',
  processing: 'Validating',
  valid: 'Valid',
  invalid: 'Invalid',
  provider_error: 'Provider error',
  cancelled: 'Cancelled',
};

function validationStatusLabel(status: string): string {
  return (
    VALIDATION_STATUS_LABELS[status as GuidelineValidationStatus] ?? status
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
  const location = useLocation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CompanyDetail | null>(null);
  const [viewingVersions, setViewingVersions] = useState<
    GuidelineVersionMeta[] | null
  >(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewTab, setViewTab] = useState<'replace' | 'history'>('replace');
  const [historyDetail, setHistoryDetail] =
    useState<GuidelineVersionDetail | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const socketRef = useRef<Socket | null>(null);
  const companiesRef = useRef<Company[]>([]);
  const viewingRef = useRef<CompanyDetail | null>(null);
  companiesRef.current = companies;
  viewingRef.current = viewing;

  useEffect(() => {
    const state = location.state as { feedback?: Feedback } | null;
    if (state?.feedback) setFeedback(state.feedback);
  }, [location.state]);

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
        const message = err instanceof Error ? err.message : 'Failed to load companies';
        setError(message);
        setFeedback({ tone: 'error', message });
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const openGuidelines = useCallback(async (companyId: string) => {
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
      setHistoryDetail(null);
      socketRef.current?.emit('guideline:subscribe', { companyId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load guidelines';
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      setViewLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const socket = io(getApiOrigin(), {
      path: getSocketPath(),
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    const subscribeVisible = () => {
      for (const company of companiesRef.current) {
        socket.emit('guideline:subscribe', { companyId: company.id });
      }
    };
    socket.on('connect', subscribeVisible);
    socket.on('ready', subscribeVisible);
    socket.on('guideline:validation', (event: GuidelineValidationEvent) => {
      setViewingVersions((versions) =>
        viewingRef.current?.id === event.companyId && versions
          ? versions.map((version) =>
              version.id === event.versionId
                ? {
                    ...version,
                    status: event.status,
                    validationReason: event.reason ?? null,
                    validationStartedAt:
                      event.status === 'processing'
                        ? event.occurredAt
                        : version.validationStartedAt,
                    validatedAt:
                      event.status === 'processing'
                        ? version.validatedAt
                        : event.occurredAt,
                  }
                : version,
            )
        : versions,
      );
      if (viewingRef.current?.id === event.companyId) {
        if (event.status === 'processing') {
          setFeedback({
            tone: 'info',
            message: `Guideline v${event.version} is being validated…`,
          });
        } else if (event.status === 'valid') {
          setFeedback({
            tone: 'success',
            message: `Guideline v${event.version} passed validation and is now active.`,
          });
        } else if (event.status === 'invalid') {
          setFeedback({
            tone: 'error',
            message: `Guideline v${event.version} was rejected: ${event.reason ?? 'validation failed'}`,
          });
        } else if (event.status === 'provider_error') {
          setFeedback({
            tone: 'error',
            message: `Guideline v${event.version} could not be validated: ${event.reason ?? 'validation service unavailable'}`,
          });
        } else if (event.status === 'cancelled') {
          setFeedback({
            tone: 'info',
            message: `Guideline v${event.version} validation was cancelled.`,
          });
        }
      }
      if (event.status !== 'processing' && event.status !== 'pending') {
        void load();
        void refreshCompanies();
        if (viewingRef.current?.id === event.companyId) {
          void openGuidelines(event.companyId);
        }
      }
    });
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [load, openGuidelines, refreshCompanies]);

  useEffect(() => {
    if (!socketRef.current?.connected) return;
    for (const company of companies) {
      socketRef.current.emit('guideline:subscribe', { companyId: company.id });
    }
  }, [companies]);

  async function cancelPending(companyId: string, versionId: string) {
    setBusyId(companyId);
    setError(null);
    setFeedback({ tone: 'info', message: 'Cancelling guideline validation…' });
    try {
      await apiFetch(`/companies/${companyId}/guidelines/versions/${versionId}`, {
        method: 'DELETE',
      });
      await openGuidelines(companyId);
      setFeedback({ tone: 'success', message: 'Guideline validation cancelled. The active guideline was unchanged.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cancellation failed';
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      setBusyId(null);
    }
  }

  async function inspectVersion(companyId: string, versionId: string) {
    setHistoryLoadingId(versionId);
    setFeedback(null);
    try {
      setHistoryDetail(
        await apiFetch<GuidelineVersionDetail>(
          `/companies/${companyId}/guidelines/versions/${versionId}`,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load version';
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      setHistoryLoadingId(null);
    }
  }

  const activeVersionMeta = viewingVersions?.find(
    (version) => version.version === viewing?.currentVersion,
  );
  const pendingReplacement = viewingVersions?.find(
    (version) =>
      version.status === 'pending' || version.status === 'processing',
  );

  async function onUpload(companyId: string, file: File | undefined) {
    if (!file) return;
    setBusyId(companyId);
    setError(null);
    setFeedback({ tone: 'info', message: 'Uploading guideline and starting validation…' });
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
      setFeedback({ tone: 'success', message: 'Guideline uploaded successfully. It is pending validation; the current active guideline remains unchanged until validation passes.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      setFeedback({ tone: 'error', message });
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
    setFeedback({ tone: 'info', message: 'Clearing active guideline…' });
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
      setFeedback({ tone: 'success', message: 'Active guideline cleared. Version history was preserved.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Clear failed';
      setError(message);
      setFeedback({ tone: 'error', message });
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

      <FeedbackBanner
        feedback={feedback ?? (error ? { tone: 'error', message: error } : null)}
      />

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
                          onClick={() => {
                            setViewTab('replace');
                            void openGuidelines(company.id);
                          }}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <i className="fas fa-eye mr-1" aria-hidden="true" />
                          {viewLoading ? 'Loading…' : 'View'}
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
                            title={company.guidelineUpdatedAt ?? undefined}
                          >
                            {formatTimestamp(company.guidelineUpdatedAt)}
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
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
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
                  {viewing.currentVersion
                    ? ` · active version ${viewing.currentVersion}`
                    : ''}
                  {viewing.guidelineUpdatedAt
                    ? ` · updated ${formatTimestamp(viewing.guidelineUpdatedAt)}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewing(null);
                  setViewingVersions(null);
                  setHistoryDetail(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-sm font-medium"
              >
                Close
              </button>
            </div>
            <div className="flex border-b border-gray-200 px-4" role="tablist">
              {(['replace', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={viewTab === tab}
                  onClick={() => setViewTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 ${
                    viewTab === tab
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'replace' ? 'Current & Replace' : 'History'}
                </button>
              ))}
            </div>

            {viewTab === 'replace' ? (
              <div className="min-h-0 overflow-auto p-4 space-y-4">
                {pendingReplacement && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-3">
                    <div className="text-sm text-amber-900">
                      <p className="font-medium">
                        Replacement v{pendingReplacement.version}:{' '}
                        {validationStatusLabel(pendingReplacement.status)}
                      </p>
                      <p className="text-xs mt-1">
                        Current v{viewing.currentVersion ?? 'none'} remains active until validation succeeds.
                      </p>
                    </div>
                    {canManage && pendingReplacement.status === 'pending' && (
                      <button
                        type="button"
                        disabled={busyId === viewing.id}
                        onClick={() =>
                          void cancelPending(viewing.id, pendingReplacement.id)
                        }
                        className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-60"
                      >
                        Cancel pending
                      </button>
                    )}
                  </div>
                )}
                <div className="text-xs text-gray-600">
                  <span className="font-medium text-gray-700">Active:</span>{' '}
                  {viewing.currentVersion
                    ? `v${viewing.currentVersion} · ${shortHash(activeVersionMeta?.contentHash)}`
                    : 'None'}
                </div>
                <pre className="rounded-md bg-gray-50 border border-gray-200 p-4 text-sm text-gray-800 whitespace-pre-wrap">
                  {viewing.guidelineText?.trim()
                    ? viewing.guidelineText
                    : 'No validated guideline is active for this company.'}
                </pre>
              </div>
            ) : (
              <div className="min-h-0 overflow-hidden p-4 flex gap-4">
                {!viewingVersions?.length ? (
                  <p className="text-sm text-gray-500">No guideline history.</p>
                ) : (
                  <ul className="w-64 shrink-0 overflow-auto divide-y divide-gray-100 border border-gray-200 rounded-md">
                    {viewingVersions.map((version) => (
                      <li key={version.id}>
                        <button
                          type="button"
                          disabled={historyLoadingId === version.id}
                          onClick={() => void inspectVersion(viewing.id, version.id)}
                          className={`w-full p-3 text-left hover:bg-gray-50 ${
                            historyDetail?.id === version.id
                              ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200'
                              : ''
                          }`}
                        >
                          <span className="block font-medium text-gray-800">
                            {historyLoadingId === version.id
                              ? 'Loading…'
                              : `v${version.version} · ${validationStatusLabel(version.status)}`}
                          </span>
                          <span className="block text-xs text-gray-500 mt-1">
                            {version.fileName ?? 'guidelines.txt'}
                          </span>
                          <time
                            className="block text-xs text-gray-500 mt-1"
                            dateTime={version.createdAt}
                            title={version.createdAt}
                          >
                            Uploaded {formatTimestamp(version.createdAt)}
                          </time>
                          {version.validatedAt && (
                            <time
                              className="block text-xs text-gray-500 mt-1"
                              dateTime={version.validatedAt}
                              title={version.validatedAt}
                            >
                              Processed {formatTimestamp(version.validatedAt)}
                            </time>
                          )}
                          {version.validationReason && (
                            <span className="block truncate text-xs text-gray-500 mt-1">
                              {version.validationReason}
                            </span>
                          )}
                        </button>
                        {canManage && version.status === 'pending' && (
                          <button
                            type="button"
                            disabled={busyId === viewing.id}
                            onClick={() => void cancelPending(viewing.id, version.id)}
                            className="ml-3 mb-2 text-xs font-medium text-red-700 hover:text-red-900 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="min-w-0 flex-1 overflow-auto rounded-md border border-gray-200">
                  {historyDetail ? (
                    <div className="border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
                      <div>Version {historyDetail.version} snapshot</div>
                      <div className="mt-1 text-xs font-normal text-gray-500">
                        Created {formatTimestamp(historyDetail.createdAt)}
                        {historyDetail.validatedAt
                          ? ` · processed ${formatTimestamp(historyDetail.validatedAt)}`
                          : ''}
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap text-sm text-gray-800">
                        {historyDetail.content}
                      </pre>
                    </div>
                  ) : (
                    <p className="p-4 text-sm text-gray-500">
                      Select a version to inspect its guideline context.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
