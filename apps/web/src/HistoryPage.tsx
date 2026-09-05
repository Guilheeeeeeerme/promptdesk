import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from './api';
import { useAuth } from './auth';

type ConversationStatus =
  | 'open'
  | 'in_progress'
  | 'solved'
  | 'not_solved';

interface ConversationDto {
  id: string;
  companyId: string;
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
  in_progress: 'In progress',
  solved: 'Solved',
  not_solved: 'Not solved',
};

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function HistoryPage() {
  const { session } = useAuth();
  const companyId = session?.activeCompany?.id ?? null;
  const companyName = session?.activeCompany?.name ?? 'No company';

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

  function selectConversation(id: string) {
    setSelectedId(id);
    setSelectedForCompanyId(companyId);
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chat History</h1>
          <p className="mt-1 text-sm text-gray-600">
            Browse previous support interactions for{' '}
            <span className="font-medium text-gray-800">{companyName}</span>
          </p>
        </div>
        <div className="w-full sm:w-72">
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
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-white shadow rounded-lg overflow-hidden">
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
            <ul className="divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
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
                          <p className="mt-1 text-xs text-gray-500">
                            {companyName} · {STATUS_LABELS[item.status]}
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

        <section className="bg-white shadow rounded-lg overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Detail</h2>
          </div>
          {!activeSelectedId ? (
            <p className="px-4 py-8 text-sm text-gray-500">
              Select a conversation to view the full transcript.
            </p>
          ) : detailLoading ? (
            <p className="px-4 py-8 text-sm text-gray-500">Loading detail…</p>
          ) : detailError ? (
            <p role="alert" className="px-4 py-8 text-sm text-red-600">
              {detailError}
            </p>
          ) : detail ? (
            <div className="px-4 py-4 space-y-4">
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-gray-500">Title:</span>{' '}
                  <span className="text-gray-900">
                    {detail.title?.trim() || 'Untitled chat'}
                  </span>
                </p>
                <p>
                  <span className="text-gray-500">Company:</span>{' '}
                  <span className="text-gray-900">{companyName}</span>
                </p>
                <p>
                  <span className="text-gray-500">Status:</span>{' '}
                  <span className="text-gray-900">
                    {STATUS_LABELS[detail.status]}
                  </span>
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

              <div className="border-t border-gray-100 pt-4 space-y-3 max-h-[24rem] overflow-y-auto">
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
                        <time>{formatWhen(msg.createdAt)}</time>
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
