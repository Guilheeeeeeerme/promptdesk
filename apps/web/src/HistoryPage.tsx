import { useCallback, useEffect, useRef, useState } from 'react';
import { isPlatformRole } from '@shared/auth';
import { apiFetch } from './api';
import { useAuth } from './auth';

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

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function HistoryPage() {
  const { session } = useAuth();
  const companyId = session?.activeCompany?.id ?? null;
  const companyName = session?.activeCompany?.name ?? 'No company';
  const isPlatform = isPlatformRole(session?.user.role ?? 'agent');

  const [items, setItems] = useState<ConversationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      if (requestId === listRequestRef.current) {
        setLoading(false);
      }
    }
  }, [companyId, search]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

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
          err instanceof Error ? err.message : 'Failed to load conversation',
        );
      } finally {
        if (requestId === detailRequestRef.current) {
          setDetailLoading(false);
        }
      }
    })();
  }, [activeSelectedId, companyId]);

  const patchConversation = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      setError(null);
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
      }
    },
    [loadList],
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
      <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Chat History
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Browse previous support interactions for{' '}
            <span className="font-medium text-gray-800">{companyName}</span>
          </p>
        </div>
        <div
          className={`w-full sm:w-72 ${showMobileDetail ? 'hidden lg:block' : ''}`}
        >
          <label htmlFor="history-search" className="sr-only">
            Search history
          </label>
          <input
            id="history-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search messages or titles…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 break-words"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className={`bg-white shadow rounded-lg overflow-hidden min-w-0 ${
            showMobileDetail ? 'hidden lg:block' : ''
          }`}
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Conversations</h2>
          </div>
          {loading ? (
            <p className="px-4 py-8 text-sm text-gray-500">Loading history…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-500">
              No conversations for this company yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-[min(32rem,70dvh)] overflow-y-auto">
              {items.map((item) => {
                const active = item.id === activeSelectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(item.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 focus:outline-none focus:bg-indigo-50 ${
                        active ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.title?.trim() || 'Untitled chat'}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 truncate">
                            {isPlatform && item.ownerName
                              ? `${item.ownerName} · `
                              : ''}
                            {companyName} · {statusLabel(item.status)}
                          </p>
                        </div>
                        <time className="shrink-0 text-xs text-gray-400">
                          {formatWhen(item.lastMessageAt ?? item.createdAt)}
                        </time>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          className={`bg-white shadow rounded-lg overflow-hidden min-w-0 ${
            showMobileDetail ? '' : 'hidden lg:block'
          }`}
        >
          <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Detail</h2>
            {showMobileDetail && (
              <button
                type="button"
                onClick={clearSelection}
                className="lg:hidden text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                Back to list
              </button>
            )}
          </div>
          {!activeSelectedId ? (
            <p className="px-4 py-8 text-sm text-gray-500">
              Select a conversation to view the full transcript.
            </p>
          ) : detailLoading ? (
            <p className="px-4 py-8 text-sm text-gray-500">Loading detail…</p>
          ) : detailError ? (
            <p role="alert" className="px-4 py-8 text-sm text-red-600 break-words">
              {detailError}
            </p>
          ) : detail ? (
            <div className="px-4 py-4 space-y-4">
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-gray-500">Title:</span>{' '}
                  <span className="text-gray-900 break-words">
                    {detail.title?.trim() || 'Untitled chat'}
                  </span>
                </p>
                {isPlatform && (detail.ownerName || detail.ownerEmail) && (
                  <p>
                    <span className="text-gray-500">Agent:</span>{' '}
                    <span className="text-gray-900 break-words">
                      {[detail.ownerName, detail.ownerEmail]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </p>
                )}
                <p>
                  <span className="text-gray-500">Company:</span>{' '}
                  <span className="text-gray-900">{companyName}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Status:</span>
                  {isPlatform ? (
                    <select
                      value={detail.status}
                      onChange={(e) =>
                        void patchConversation(detail.id, {
                          status: e.target.value,
                        })
                      }
                      className="rounded-md border border-gray-300 px-2 py-0.5 text-xs bg-white text-gray-900 focus:border-indigo-500 focus:ring-indigo-500"
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
                    </select>
                  ) : (
                    <span className="text-gray-900">{statusLabel(detail.status)}</span>
                  )}
                </div>
                <p>
                  <span className="text-gray-500">Rating:</span>{' '}
                  {isFinal(detail.status) ? (
                    <span className="text-gray-900">
                      {detail.rating
                        ? `${'★'.repeat(detail.rating)}${'☆'.repeat(5 - detail.rating)} (${detail.rating}/5)`
                        : 'Not rated yet'}
                    </span>
                  ) : (
                    <span className="text-gray-400">
                      available once finished
                    </span>
                  )}
                </p>
                <p>
                  <span className="text-gray-500">Last activity:</span>{' '}
                  <span className="text-gray-900">
                    {formatWhen(detail.lastMessageAt ?? detail.createdAt)}
                  </span>
                </p>
                {detail.guidelineSnapshotHash && (
                  <p className="break-all">
                    <span className="text-gray-500">Guideline snapshot:</span>{' '}
                    <span className="font-mono text-xs text-gray-700">
                      {detail.guidelineSnapshotHash.slice(0, 16)}…
                    </span>
                  </p>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3 max-h-[min(24rem,55dvh)] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-500">No messages.</p>
                ) : (
                  messages.map((msg) => (
                    <article
                      key={msg.id}
                      className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                        msg.role === 'assistant'
                          ? 'bg-indigo-50 text-gray-900'
                          : 'bg-gray-50 text-gray-900'
                      }`}
                    >
                      <header className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-500">
                        <span className="font-medium capitalize">
                          {msg.role === 'assistant' ? 'Guidance' : 'Customer'}
                        </span>
                        <time className="shrink-0">
                          {formatWhen(msg.createdAt)}
                        </time>
                      </header>
                      <p>{msg.content || '(pending)'}</p>
                    </article>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
