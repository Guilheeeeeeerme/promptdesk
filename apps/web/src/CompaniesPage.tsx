import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
  AlertDialog,
  Badge,
  BuildingIcon,
  Button,
  ChatIcon,
  cn,
  EmptyState,
  EyeIcon,
  FileIcon,
  PageHeader,
  PageSkeleton,
  Panel,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from '@shared/ui';
import {
  apiFetch,
  getApiOrigin,
  getSocketPath,
  getToken,
} from './api';
import { useAuth } from './auth';
import { useLocale } from './locale';
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

function formatTimestamp(
  value: string | null | undefined,
  neverLabel: string,
): string {
  if (!value) return neverLabel;
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
  return VALIDATION_STATUS_LABELS[status as GuidelineValidationStatus] ?? status;
}

function validationBadgeTone(
  status: string,
): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'valid':
      return 'success';
    case 'invalid':
    case 'provider_error':
      return 'danger';
    case 'processing':
      return 'info';
    case 'pending':
      return 'warning';
    default:
      return 'neutral';
  }
}

function shortHash(value: string | null | undefined): string {
  return value ? `${value.slice(0, 12)}…` : '—';
}

function accentFor(name: string): { bg: string; icon: string } {
  const palette = [
    { bg: 'bg-accent-muted', icon: 'text-accent' },
    { bg: 'bg-info-muted', icon: 'text-info-foreground' },
    { bg: 'bg-success-muted', icon: 'text-success-foreground' },
    { bg: 'bg-warning-muted', icon: 'text-warning-foreground' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i)) % palette.length;
  }
  return palette[hash] ?? palette[0];
}

export function CompaniesPage() {
  const { session, refreshCompanies } = useAuth();
  const { t } = useLocale();
  const location = useLocation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingClearCompanyId, setPendingClearCompanyId] = useState<
    string | null
  >(null);
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
        const message = err instanceof Error ? err.message : t('Failed to load companies');
        setError(message);
        setFeedback({ tone: 'error', message });
      } finally {
        setLoading(false);
      }
    })();
  }, [load, t]);

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
      const message = err instanceof Error ? err.message : t('Failed to load guidelines');
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      setViewLoading(false);
    }
  }, [t]);

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
            message: t('Guideline v{n} is being validated…').replace('{n}', String(event.version)),
          });
        } else if (event.status === 'valid') {
          setFeedback({
            tone: 'success',
            message: t('Guideline v{n} passed validation and is now active.').replace('{n}', String(event.version)),
          });
        } else if (event.status === 'invalid') {
          setFeedback({
            tone: 'error',
            message: t('Guideline v{n} was rejected: {reason}').replace('{n}', String(event.version)).replace('{reason}', event.reason ?? 'validation failed'),
          });
        } else if (event.status === 'provider_error') {
          setFeedback({
            tone: 'error',
            message: t('Guideline v{n} could not be validated: {reason}').replace('{n}', String(event.version)).replace('{reason}', event.reason ?? 'validation service unavailable'),
          });
        } else if (event.status === 'cancelled') {
          setFeedback({
            tone: 'info',
            message: t('Guideline v{n} validation was cancelled.').replace('{n}', String(event.version)),
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
  }, [load, openGuidelines, refreshCompanies, t]);

  useEffect(() => {
    if (!socketRef.current?.connected) return;
    for (const company of companies) {
      socketRef.current.emit('guideline:subscribe', { companyId: company.id });
    }
  }, [companies]);

  async function cancelPending(companyId: string, versionId: string) {
    setBusyId(companyId);
    setError(null);
    setFeedback({ tone: 'info', message: t('Cancelling guideline validation…') });
    try {
      await apiFetch(`/companies/${companyId}/guidelines/versions/${versionId}`, {
        method: 'DELETE',
      });
      await openGuidelines(companyId);
      setFeedback({ tone: 'success', message: t('Guideline validation cancelled. The active guideline was unchanged.') });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Cancellation failed');
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
      const message = err instanceof Error ? err.message : t('Failed to load version');
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
    setFeedback({ tone: 'info', message: t('Uploading guideline and starting validation…') });
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
      setFeedback({ tone: 'success', message: t('Guideline uploaded successfully. It is pending validation; the current active guideline remains unchanged until validation passes.') });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Upload failed');
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      setBusyId(null);
      const input = fileInputs.current[companyId];
      if (input) input.value = '';
    }
  }

  async function confirmClear() {
    const companyId = pendingClearCompanyId;
    if (!companyId) return;
    setBusyId(companyId);
    setError(null);
    setFeedback({ tone: 'info', message: t('Clearing active guideline…') });
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
      setFeedback({ tone: 'success', message: t('Active guideline cleared. Version history was preserved.') });
      setPendingClearCompanyId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Clear failed');
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div>
      <PageHeader
        title={t('Companies')}
        description={t('Manage company information and guidelines')}
        actions={
          canCreate ? (
            <Link to="/companies/new">
              <Button>
                <PlusIcon className="size-4 shrink-0" />
                {t('Add Company')}
              </Button>
            </Link>
          ) : undefined
        }
      />

      <FeedbackBanner
        feedback={feedback ?? (error ? { tone: 'error', message: error } : null)}
      />

      <Panel padded={false}>
        {companies.length === 0 ? (
          <EmptyState title={t('No companies available for your account.')} />
        ) : (
          <ul className="divide-y divide-line-subtle">
            {companies.map((company) => {
              const accent = accentFor(company.name);
              const busy = busyId === company.id;
              return (
                <li key={company.id}>
                  <div className="px-4 py-4 transition-colors duration-150 hover:bg-surface-hover sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center">
                        <div
                          className={cn(
                            'flex size-12 shrink-0 items-center justify-center rounded-full',
                            accent.bg,
                          )}
                        >
                          <BuildingIcon
                            className={cn('size-5', accent.icon)}
                          />
                        </div>
                        <div className="ms-4 min-w-0">
                          <div className="truncate text-14 font-semibold text-ink-primary">
                            {company.name}
                          </div>
                          <div className="truncate text-13 text-ink-secondary">
                            {company.guidelineFileName
                              ? company.guidelineFileName
                              : t('No guidelines uploaded')}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={viewLoading}
                          onClick={() => {
                            setViewTab('replace');
                            void openGuidelines(company.id);
                          }}
                        >
                          <EyeIcon className="size-3.5 shrink-0" />
                          {viewLoading ? t('Loading…') : t('View')}
                        </Button>
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
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => fileInputs.current[company.id]?.click()}
                            >
                              <UploadIcon className="size-3.5 shrink-0" />
                              {company.hasGuidelines
                                ? t('Replace Guidelines')
                                : t('Upload Guidelines')}
                            </Button>
                            {company.hasGuidelines && (
                              <Button
                                type="button"
                                variant="danger-soft"
                                size="sm"
                                disabled={busy}
                                onClick={() => setPendingClearCompanyId(company.id)}
                              >
                                <TrashIcon className="size-3.5 shrink-0" />
                                {t('Clear')}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-13 text-ink-tertiary">
                        <FileIcon className="size-3.5 shrink-0 text-ink-tertiary" />
                        <p>
                          {company.currentVersion
                            ? t('Version {n} · updated on ').replace('{n}', String(company.currentVersion))
                            : t('Guidelines last updated on ')}
                          <time
                            dateTime={company.guidelineUpdatedAt ?? undefined}
                            title={company.guidelineUpdatedAt ?? undefined}
                          >
                            {formatTimestamp(company.guidelineUpdatedAt, t('Never'))}
                          </time>
                        </p>
                        {company.latestValidVersion && (
                          <p className="text-12 text-ink-tertiary">
                            {t('Latest valid: v{n}').replace('{n}', String(company.latestValidVersion))}
                            {company.latestValidVersionHash
                              ? ` · ${shortHash(company.latestValidVersionHash)}`
                              : ''}
                          </p>
                        )}
                      </div>
                      <div className="mt-2 flex items-center text-13 text-ink-tertiary sm:mt-0">
                        <ChatIcon className="me-1.5 size-3.5 shrink-0 text-ink-tertiary" />
                        <p>
                          {t('{n} support conversations').replace('{n}', String(company.messageCount ?? 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <AlertDialog
        open={pendingClearCompanyId !== null}
        title={t('Clear')}
        description={t('Clear guidelines for this company?')}
        confirmLabel={t('Clear')}
        cancelLabel={t('Cancel')}
        tone="danger"
        busy={Boolean(
          pendingClearCompanyId && busyId === pendingClearCompanyId,
        )}
        onCancel={() => setPendingClearCompanyId(null)}
        onConfirm={() => void confirmClear()}
      />

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            aria-label={t('Close')}
            className="absolute inset-0 bg-scrim"
            onClick={() => {
              setViewing(null);
              setViewingVersions(null);
              setHistoryDetail(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guidelines-title"
            className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col rounded-md border border-line bg-surface-overlay shadow-overlay"
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2
                  id="guidelines-title"
                  className="text-balance text-16 font-semibold text-ink-primary"
                >
                  {t('{name} guidelines').replace('{name}', viewing.name)}
                </h2>
                <p className="mt-1 text-pretty text-13 text-ink-secondary">
                  {viewing.guidelineFileName ?? t('No file uploaded')}
                  {viewing.currentVersion
                    ? ` · ${t('active version {n}').replace('{n}', String(viewing.currentVersion))}`
                    : ''}
                  {viewing.guidelineUpdatedAt
                    ? ` · ${t('Updated {when}').replace('{when}', formatTimestamp(viewing.guidelineUpdatedAt, t('Never')))}`
                    : ''}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setViewing(null);
                  setViewingVersions(null);
                  setHistoryDetail(null);
                }}
              >
                {t('Close')}
              </Button>
            </div>
            <div className="flex border-b border-line px-4 sm:px-5" role="tablist">
              {(['replace', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={viewTab === tab}
                  onClick={() => setViewTab(tab)}
                  className={cn(
                    'border-b-2 px-4 py-3 text-13 font-medium transition-colors',
                    viewTab === tab
                      ? 'border-accent text-accent'
                      : 'border-transparent text-ink-tertiary hover:text-ink-secondary',
                  )}
                >
                  {tab === 'replace' ? t('Current & Replace') : t('History')}
                </button>
              ))}
            </div>

            {viewTab === 'replace' ? (
              <div className="min-h-0 space-y-4 overflow-auto p-4 sm:p-5">
                {pendingReplacement && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-warning-muted p-3">
                    <div className="text-13 text-warning-foreground">
                      <p className="font-medium">
                        {t('Replacement v{n}').replace('{n}', String(pendingReplacement.version))}:
                        {' '}
                        {t(validationStatusLabel(pendingReplacement.status))}
                      </p>
                      <p className="mt-1 text-12">
                        {t('Current {v} remains active until validation succeeds.').replace('{v}', viewing.currentVersion ? `v${viewing.currentVersion}` : t('None'))}
                      </p>
                    </div>
                    {canManage && pendingReplacement.status === 'pending' && (
                      <Button
                        type="button"
                        variant="danger-soft"
                        size="sm"
                        disabled={busyId === viewing.id}
                        onClick={() =>
                          void cancelPending(viewing.id, pendingReplacement.id)
                        }
                      >
                        {t('Cancel pending')}
                      </Button>
                    )}
                  </div>
                )}
                <div className="text-12 text-ink-secondary">
                  <span className="font-medium text-ink-primary">{t('Active:')}</span>{' '}
                  {viewing.currentVersion
                    ? `v${viewing.currentVersion} · ${shortHash(activeVersionMeta?.contentHash)}`
                    : t('None')}
                </div>
                <pre className="whitespace-pre-wrap rounded-md border border-line bg-surface-sunken p-4 text-13 text-ink-primary">
                  {viewing.guidelineText?.trim()
                    ? viewing.guidelineText
                    : t('No validated guideline is active for this company.')}
                </pre>
              </div>
            ) : (
              <div className="flex min-h-0 gap-4 overflow-hidden p-4 sm:p-5">
                {!viewingVersions?.length ? (
                  <p className="text-13 text-ink-secondary">{t('No guideline history.')}</p>
                ) : (
                  <ul className="w-64 shrink-0 divide-y divide-line-subtle overflow-auto rounded-md border border-line">
                    {viewingVersions.map((version) => (
                      <li key={version.id}>
                        <button
                          type="button"
                          disabled={historyLoadingId === version.id}
                          onClick={() => void inspectVersion(viewing.id, version.id)}
                          className={cn(
                            'w-full p-3 text-start transition-colors',
                            historyDetail?.id === version.id
                              ? 'bg-accent-muted ring-1 ring-inset ring-accent/30'
                              : 'hover:bg-surface-hover',
                          )}
                        >
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-13 font-medium text-ink-primary">
                              {historyLoadingId === version.id
                                ? t('Loading…')
                                : `v${version.version}`}
                            </span>
                            {historyLoadingId !== version.id && (
                              <Badge tone={validationBadgeTone(version.status)}>
                                {t(validationStatusLabel(version.status))}
                              </Badge>
                            )}
                          </span>
                          <span className="mt-1 block truncate text-12 text-ink-tertiary">
                            {version.fileName ?? 'guidelines.txt'}
                          </span>
                          <time
                            className="mt-1 block text-12 text-ink-tertiary"
                            dateTime={version.createdAt}
                            title={version.createdAt}
                          >
                            {t('Uploaded {when}').replace('{when}', formatTimestamp(version.createdAt, t('Never')))}
                          </time>
                          {version.validatedAt && (
                            <time
                              className="mt-1 block text-12 text-ink-tertiary"
                              dateTime={version.validatedAt}
                              title={version.validatedAt}
                            >
                              {t('Processed {when}').replace('{when}', formatTimestamp(version.validatedAt, t('Never')))}
                            </time>
                          )}
                          {version.validationReason && (
                            <span className="mt-1 block truncate text-12 text-ink-tertiary">
                              {version.validationReason}
                            </span>
                          )}
                        </button>
                        {canManage && version.status === 'pending' && (
                          <Button
                            type="button"
                            variant="danger-soft"
                            size="sm"
                            disabled={busyId === viewing.id}
                            onClick={() => void cancelPending(viewing.id, version.id)}
                            className="ms-3 mb-2"
                          >
                            {t('Cancel')}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="min-w-0 flex-1 overflow-auto rounded-md border border-line">
                  {historyDetail ? (
                    <div className="border-b border-line px-3 py-2 text-13 font-medium text-ink-primary">
                      <div>{t('Version {n} snapshot').replace('{n}', String(historyDetail.version))}</div>
                      <div className="mt-1 text-12 font-normal text-ink-tertiary">
                        {t('Created {when}').replace('{when}', formatTimestamp(historyDetail.createdAt, t('Never')))}
                        {historyDetail.validatedAt
                          ? ` · ${t('Processed {when}').replace('{when}', formatTimestamp(historyDetail.validatedAt, t('Never')))}`
                          : ''}
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap text-13 text-ink-primary">
                        {historyDetail.content}
                      </pre>
                    </div>
                  ) : (
                    <p className="p-4 text-13 text-ink-secondary">
                      {t('Select a version to inspect its guideline context.')}
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
