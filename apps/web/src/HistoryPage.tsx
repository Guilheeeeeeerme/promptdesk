import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { isPlatformRole } from '@shared/auth';
import {
  Badge,
  Button,
  cn,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Panel,
  Select,
  Textarea,
} from '@shared/ui';
import { apiFetch } from './api';
import { useAuth } from './auth';
import { useLocale } from './locale';
import { FeedbackBanner, type Feedback } from './FeedbackBanner';

type ConversationStatus =
  | 'open'
  | 'solved'
  | 'not_solved'
  | 'wont_solve';

/** Platform (root/admin) may pick every state; agents reopen via open. */
const PLATFORM_STATUSES: ConversationStatus[] = [
  'open',
  'solved',
  'not_solved',
  'wont_solve',
];

const FINAL_STATUSES: ConversationStatus[] = [
  'solved',
  'not_solved',
  'wont_solve',
];

interface ConversationDto {
  id: string;
  companyId: string;
  userId: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  title: string | null;
  status: ConversationStatus;
  pinned: boolean;
  archived: boolean;
  rating: number | null;
  guidelineSnapshotHash: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

interface ChatMessageDto {
  id: string;
  content: string;
  role: string;
  status: string;
  createdAt: string;
  conversationId: string | null;
}

interface SummaryDto {
  windowDays: number;
  total: number;
  open: number;
  solved: number;
  notSolved: number;
  wontSolve: number;
  resolutionRate: number | null;
  avgResolveSeconds: number | null;
  avgRating: number | null;
  ratedCount: number;
}

const STATUS_LABELS: Record<ConversationStatus, string> = {
  open: 'Open',
  solved: 'Solved',
  not_solved: 'Not solved',
  wont_solve: "Won't solve",
};

function statusLabel(status: ConversationStatus): string {
  return STATUS_LABELS[status] ?? 'Open';
}

function isFinal(status: ConversationStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

function humanizeSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function messageIdentity(role: string, translate: (v: string) => string): {
  label: string;
  bubbleClass: string;
} {
  if (role === 'agent') {
    return {
      label: translate('Support (human)'),
      bubbleClass: 'bg-warning-muted text-ink-primary',
    };
  }
  if (role === 'assistant') {
    return {
      label: translate('AI'),
      bubbleClass: 'bg-accent-muted text-ink-primary',
    };
  }
  return {
    label: translate('Customer'),
    bubbleClass: 'bg-surface-sunken text-ink-primary',
  };
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function HistoryPage() {
  const { session } = useAuth();
  const { t } = useLocale();
  const companyId = session?.activeCompany?.id ?? null;
  const companyName = session?.activeCompany?.name ?? t('No company');
  const isPlatform = isPlatformRole(session?.user.role ?? 'agent');

  const [items, setItems] = useState<ConversationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedForCompanyId, setSelectedForCompanyId] = useState<
    string | null
  >(null);
  const [detail, setDetail] = useState<ConversationDto | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryDto | null>(null);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingConversationId, setUpdatingConversationId] = useState<string | null>(null);

  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  // Drop selection immediately when tenant changes (avoid cross-company detail fetches).
  const activeSelectedId =
    selectedId && selectedForCompanyId === companyId ? selectedId : null;

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    if (selectedForCompanyId && selectedForCompanyId !== companyId) {
      setSelectedId(null);
      setSelectedForCompanyId(null);
      setDetail(null);
      setMessages([]);
      setDetailError(null);
      detailRequestRef.current += 1;
    }
  }, [companyId, selectedForCompanyId]);

  const loadList = useCallback(async () => {
    if (!companyId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const requestId = ++listRequestRef.current;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('archived', 'false');
      if (search) params.set('q', search);
      const list = await apiFetch<ConversationDto[]>(
        `/chat/conversations?${params.toString()}`,
      );
      if (requestId !== listRequestRef.current) return;
      setItems(list);
    } catch (err) {
      if (requestId !== listRequestRef.current) return;
      setItems([]);
      const message = err instanceof Error ? err.message : t('Failed to load history');
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      if (requestId === listRequestRef.current) {
        setLoading(false);
      }
    }
  }, [companyId, search, t]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!isPlatform || !companyId) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<SummaryDto>('/chat/conversations/summary');
        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setSummary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlatform, companyId, loadList]);

  useEffect(() => {
    if (!activeSelectedId || !companyId) {
      setDetail(null);
      setMessages([]);
      return;
    }

    const requestId = ++detailRequestRef.current;
    const companyAtStart = companyId;
    setDetailLoading(true);
    setDetailError(null);

    void (async () => {
      try {
        const [conversation, transcript] = await Promise.all([
          apiFetch<ConversationDto>(
            `/chat/conversations/${activeSelectedId}`,
          ),
          apiFetch<ChatMessageDto[]>(
            `/chat/conversations/${activeSelectedId}/messages`,
          ),
        ]);
        if (
          requestId !== detailRequestRef.current ||
          companyAtStart !== companyId
        ) {
          return;
        }
        setDetail(conversation);
        setMessages(transcript);
      } catch (err) {
        if (
          requestId !== detailRequestRef.current ||
          companyAtStart !== companyId
        ) {
          return;
        }
        setDetail(null);
        setMessages([]);
        setDetailError(
          err instanceof Error ? err.message : t('Failed to load conversation'),
        );
        setFeedback({
          tone: 'error',
          message: err instanceof Error ? err.message : t('Failed to load conversation'),
        });
      } finally {
        if (requestId === detailRequestRef.current) {
          setDetailLoading(false);
        }
      }
    })();
  }, [activeSelectedId, companyId, t]);

  const patchConversation = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      setError(null);
      setUpdatingConversationId(id);
      setFeedback({ tone: 'info', message: t('Saving conversation changes…') });
      try {
        const updated = await apiFetch<ConversationDto>(
          `/chat/conversations/${id}`,
          {
            method: 'PATCH',
            body: JSON.stringify(patch),
          },
        );
        // Merge locally: the PATCH response omits platform owner fields.
        setDetail((prev) => (prev && prev.id === id ? { ...prev, ...updated } : prev));
        await loadList();
        setFeedback({ tone: 'success', message: t('Conversation changes saved.') });
      } catch (err) {
        const message = err instanceof Error ? err.message : t('Update failed');
        setError(message);
        setFeedback({ tone: 'error', message });
      } finally {
        setUpdatingConversationId(null);
      }
    },
    [loadList, t],
  );

  const sendReply = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const content = reply.trim();
      if (!content || !activeSelectedId || sendingReply) return;

      setError(null);
      setSendingReply(true);
      setFeedback({ tone: 'info', message: t('Sending reply…') });
      try {
        const message = await apiFetch<ChatMessageDto>(
          `/chat/conversations/${activeSelectedId}/messages`,
          {
            method: 'POST',
            body: JSON.stringify({ content }),
          },
        );
        setMessages((prev) => [...prev, message]);
        setReply('');
        setFeedback({ tone: 'success', message: t('Reply sent.') });
      } catch (err) {
        const message = err instanceof Error ? err.message : t('Reply failed');
        setError(message);
        setFeedback({ tone: 'error', message });
      } finally {
        setSendingReply(false);
      }
    },
    [reply, activeSelectedId, sendingReply, t],
  );

  function selectConversation(id: string) {
    setSelectedId(id);
    setSelectedForCompanyId(companyId);
  }

  function clearSelection() {
    setSelectedId(null);
    setSelectedForCompanyId(null);
    setDetail(null);
    setMessages([]);
    setDetailError(null);
  }

  const showMobileDetail = Boolean(activeSelectedId);

  return (
    <div className="min-w-0">
      <PageHeader
        title={t('Chat History')}
        description={t('Browse previous support interactions for {company}').replace(
          '{company}',
          companyName,
        )}
        actions={
          <div
            className={cn(
              'w-full sm:w-72',
              showMobileDetail && 'hidden lg:block',
            )}
          >
            <label htmlFor="history-search" className="sr-only">
              {t('Search history')}
            </label>
            <Input
              id="history-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('Search messages or titles…')}
            />
          </div>
        }
      />

      {isPlatform && summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Panel>
            <p className="text-12 font-medium uppercase tracking-wide text-ink-tertiary">
              {t('Threads · {n}d').replace('{n}', String(summary.windowDays))}
            </p>
            <p className="mt-1.25 text-[28px] font-bold leading-8 text-ink-primary tabular-nums">
              {summary.total}
            </p>
            <p className="mt-0.5 text-12 text-ink-tertiary">
              {t('Still open: {n}').replace('{n}', String(summary.open))}
            </p>
          </Panel>
          <Panel>
            <p className="text-12 font-medium uppercase tracking-wide text-ink-tertiary">
              {t('Resolution rate')}
            </p>
            <p className="mt-1.25 text-[28px] font-bold leading-8 text-ink-primary tabular-nums">
              {summary.resolutionRate != null ? `${summary.resolutionRate}%` : '—'}
            </p>
            <p className="mt-0.5 text-12 text-ink-tertiary">
              {t("{solved} solved · {not} not solved · {wont} won't solve")
                .replace('{solved}', String(summary.solved))
                .replace('{not}', String(summary.notSolved))
                .replace('{wont}', String(summary.wontSolve))}
            </p>
          </Panel>
          <Panel>
            <p className="text-12 font-medium uppercase tracking-wide text-ink-tertiary">
              {t('Avg time to resolve')}
            </p>
            <p className="mt-1.25 text-[28px] font-bold leading-8 text-ink-primary tabular-nums">
              {summary.avgResolveSeconds != null
                ? humanizeSeconds(summary.avgResolveSeconds)
                : '—'}
            </p>
            <p className="mt-0.5 text-12 text-ink-tertiary">
              {t('first finish → open timestamp')}
            </p>
          </Panel>
          <Panel>
            <p className="text-12 font-medium uppercase tracking-wide text-ink-tertiary">
              {t('Rating average')}
            </p>
            <p className="mt-1.25 text-[28px] font-bold leading-8 text-ink-primary tabular-nums">
              {summary.avgRating != null ? `${summary.avgRating} / 5` : '—'}
            </p>
            <p className="mt-0.5 text-12 text-ink-tertiary">
              {t('{n} conversations rated').replace('{n}', String(summary.ratedCount))}
            </p>
          </Panel>
        </div>
      )}

      <FeedbackBanner
        feedback={feedback ?? (error ? { tone: 'error', message: error } : null)}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          padded={false}
          className={cn(
            'min-w-0 overflow-hidden',
            showMobileDetail && 'hidden lg:block',
          )}
        >
          <div className="border-b border-line-subtle px-4 py-3">
            <h2 className="text-14 font-semibold text-ink-primary">
              {t('Conversations')}
            </h2>
          </div>
          {loading ? (
            <p className="px-4 py-8 text-14 text-ink-tertiary">
              {t('Loading history…')}
            </p>
          ) : items.length === 0 ? (
            <EmptyState title={t('No conversations for this company yet.')} />
          ) : (
            <ul className="max-h-[min(32rem,70dvh)] divide-y divide-line-subtle overflow-y-auto">
              {items.map((item) => {
                const active = item.id === activeSelectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(item.id)}
                      className={cn(
                        'w-full px-4 py-3 text-left transition-colors duration-150',
                        'hover:bg-surface-hover',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                        active && 'bg-accent-muted',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-14 font-medium text-ink-primary">
                            {item.title?.trim() || t('Untitled chat')}
                          </p>
                          <p className="mt-1 truncate text-12 text-ink-secondary">
                            {isPlatform && item.ownerName
                              ? `${item.ownerName} · `
                              : ''}
                            {companyName} · {t(statusLabel(item.status))}
                          </p>
                        </div>
                        <time className="shrink-0 text-12 text-ink-tertiary tabular-nums">
                          {formatWhen(item.lastMessageAt ?? item.createdAt)}
                        </time>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          padded={false}
          className={cn(
            'min-w-0 overflow-hidden',
            !showMobileDetail && 'hidden lg:block',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3">
            <h2 className="text-14 font-semibold text-ink-primary">
              {t('Detail')}
            </h2>
            {showMobileDetail && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="lg:hidden"
              >
                {t('Back to list')}
              </Button>
            )}
          </div>
          {!activeSelectedId ? (
            <EmptyState
              title={t('Select a conversation to view the full transcript.')}
            />
          ) : detailLoading ? (
            <p className="px-4 py-8 text-14 text-ink-tertiary">
              {t('Loading detail…')}
            </p>
          ) : detailError ? (
            <p
              role="alert"
              className="break-words px-4 py-8 text-14 text-danger-foreground"
            >
              {detailError}
            </p>
          ) : detail ? (
            <div className="space-y-4 px-4 py-4">
              <div className="space-y-1.25 text-14">
                <p>
                  <span className="text-ink-secondary">{t('Title:')}</span>{' '}
                  <span className="break-words text-ink-primary">
                    {detail.title?.trim() || t('Untitled chat')}
                  </span>
                </p>
                {isPlatform && (detail.ownerName || detail.ownerEmail) && (
                  <p>
                    <span className="text-ink-secondary">{t('Agent:')}</span>{' '}
                    <span className="break-words text-ink-primary">
                      {[detail.ownerName, detail.ownerEmail]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </p>
                )}
                <p>
                  <span className="text-ink-secondary">{t('Company:')}</span>{' '}
                  <span className="text-ink-primary">{companyName}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-ink-secondary">{t('Status:')}</span>
                  {isPlatform ? (
                    <Select
                      value={detail.status}
                      disabled={updatingConversationId === detail.id}
                      onChange={(e) =>
                        void patchConversation(detail.id, {
                          status: e.target.value,
                        })
                      }
                      className="h-auto w-auto py-0.5 text-12"
                    >
                      {!PLATFORM_STATUSES.includes(detail.status) && (
                        <option value={detail.status} disabled>
                          {statusLabel(detail.status)}
                        </option>
                      )}
                      {PLATFORM_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Badge tone="neutral">{statusLabel(detail.status)}</Badge>
                  )}
                </div>
                <p>
                  <span className="text-ink-secondary">{t('Rating:')}</span>{' '}
                  {isFinal(detail.status) ? (
                    <span className="text-ink-primary">
                      {detail.rating
                        ? `${'★'.repeat(detail.rating)}${'☆'.repeat(5 - detail.rating)} (${detail.rating}/5)`
                        : t('Not rated yet')}
                    </span>
                  ) : (
                    <span className="text-ink-tertiary">
                      {t('available once finished')}
                    </span>
                  )}
                </p>
                <p>
                  <span className="text-ink-secondary">{t('Last activity:')}</span>{' '}
                  <span className="text-ink-primary tabular-nums">
                    {formatWhen(detail.lastMessageAt ?? detail.createdAt)}
                  </span>
                </p>
                {detail.guidelineSnapshotHash && (
                  <p className="break-all">
                    <span className="text-ink-secondary">
                      {t('Guideline snapshot:')}
                    </span>{' '}
                    <span className="font-mono text-12 text-ink-secondary">
                      {detail.guidelineSnapshotHash.slice(0, 16)}…
                    </span>
                  </p>
                )}
              </div>

              <div className="max-h-[min(24rem,55dvh)] space-y-3 overflow-y-auto border-t border-line-subtle pt-4">
                {messages.length === 0 ? (
                  <p className="text-14 text-ink-tertiary">{t('No messages.')}</p>
                ) : (
                  messages.map((msg) => {
                    const identity = messageIdentity(msg.role, t);
                    return (
                      <article
                        key={msg.id}
                        className={cn(
                          'whitespace-pre-wrap break-words rounded-md px-3 py-2 text-14',
                          identity.bubbleClass,
                        )}
                      >
                        <header className="mb-1 flex items-center justify-between gap-2 text-12 text-ink-tertiary">
                          <span className="font-medium">{identity.label}</span>
                          <time className="shrink-0 tabular-nums">
                            {formatWhen(msg.createdAt)}
                          </time>
                        </header>
                        <p>{msg.content || t('Pending')}</p>
                      </article>
                    );
                  })
                )}
              </div>

              {isPlatform && (
                <div className="border-t border-line-subtle pt-4">
                  {isFinal(detail.status) ? (
                    <p className="text-12 text-ink-tertiary">
                      {t('Reopen the conversation to reply manually.')}
                    </p>
                  ) : (
                    <form className="flex flex-col gap-2" onSubmit={sendReply}>
                      <Label htmlFor="manual-reply">
                        {t("Reply as support human (visible to the agent's chat)")}
                      </Label>
                      <Textarea
                        id="manual-reply"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            e.currentTarget.form?.requestSubmit();
                          }
                        }}
                        rows={2}
                        placeholder={t(
                          'Type a manual reply… (Shift+Enter for new line)',
                        )}
                        className="min-h-[2.5rem] max-h-[8rem]"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={sendingReply || !reply.trim()}
                        className="self-start"
                      >
                        {sendingReply ? t('Sending…') : t('Send reply')}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
