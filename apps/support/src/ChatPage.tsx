import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, getApiOrigin, getSocketPath, getToken } from './api';
import { useAuth } from './auth';

type MessageStatus =
  | 'completed'
  | 'pending'
  | 'processing'
  | 'failed'
  | 'cancelled';

type ConversationStatus =
  | 'open'
  | 'in_progress'
  | 'solved'
  | 'not_solved';

const CONVERSATION_STATUSES: ConversationStatus[] = [
  'open',
  'in_progress',
  'solved',
  'not_solved',
];

/** solved / not_solved are final: view-only transcript until reopened. */
const FINAL_STATUSES: ConversationStatus[] = ['solved', 'not_solved'];

function isConversationFinal(status: ConversationStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

const STATUS_LABELS: Record<ConversationStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  solved: 'Solved',
  not_solved: 'Not solved',
};

const STATUS_BADGES: Record<ConversationStatus, string> = {
  open: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  solved: 'bg-emerald-100 text-emerald-700',
  not_solved: 'bg-rose-100 text-rose-700',
};

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: MessageStatus;
  lastError?: string | null;
  parentMessageId?: string | null;
}

interface ChatMessageDto {
  id: string;
  content: string;
  role: string;
  status: MessageStatus;
  parentMessageId: string | null;
  attemptCount: number;
  lastError: string | null;
  model: string | null;
  conversationId: string | null;
  createdAt: string;
}

interface ConversationDto {
  id: string;
  title: string | null;
  pinned: boolean;
  archived: boolean;
  status: ConversationStatus;
  rating: number | null;
  guidelineSnapshotHash: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

interface ChatResponse {
  status: string;
  reply: null;
  message: ChatMessageDto;
  assistantMessage: ChatMessageDto;
  conversationId: string;
}

interface RetryResponse {
  status: string;
  assistantMessage: ChatMessageDto;
}

interface StopResponse {
  status: string;
  assistantMessage: ChatMessageDto;
}

interface JobUpdateEvent {
  userId: string;
  assistantMessageId: string;
  userMessageId: string;
  status: MessageStatus;
  content?: string;
  error?: string;
  model?: string;
}

function isInFlight(status: MessageStatus): boolean {
  return status === 'pending' || status === 'processing';
}

function isTerminalJobStatus(status: MessageStatus): boolean {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled'
  );
}

function toBubble(m: ChatMessageDto): ChatBubble {
  return {
    id: m.id,
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
    status: m.status,
    lastError: m.lastError,
    parentMessageId: m.parentMessageId,
  };
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function ChatPage() {
  const { session, loading, logout } = useAuth();
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const viewOnly =
    activeConversation !== null && isConversationFinal(activeConversation.status);

  const disconnectSocketIfIdle = useCallback(() => {
    if (pendingIdsRef.current.size > 0) return;
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const ensureSocket = useCallback(() => {
    const token = getToken();
    if (!token) return null;

    if (socketRef.current?.connected) {
      return socketRef.current;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(getApiOrigin(), {
      path: getSocketPath(),
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('job:update', (event: JobUpdateEvent) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== event.assistantMessageId) return m;
          return {
            ...m,
            status: event.status,
            content:
              event.status === 'completed'
                ? (event.content ?? m.content)
                : m.content,
            lastError: event.status === 'failed' ? (event.error ?? m.lastError) : null,
          };
        }),
      );

      if (isTerminalJobStatus(event.status)) {
        pendingIdsRef.current.delete(event.assistantMessageId);
        disconnectSocketIfIdle();
      } else if (isInFlight(event.status)) {
        pendingIdsRef.current.add(event.assistantMessageId);
      }
    });

    socketRef.current = socket;
    return socket;
  }, [disconnectSocketIfIdle]);

  const trackPending = useCallback(
    (assistantId: string) => {
      pendingIdsRef.current.add(assistantId);
      ensureSocket();
    },
    [ensureSocket],
  );

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      pendingIdsRef.current.clear();
    };
  }, []);

  // Search is debounced so typing does not spam the API.
  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const loadConversations = useCallback(async () => {
    if (!session) return;
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (pinnedOnly) params.set('pinned', 'true');
    params.set('archived', showArchived ? 'true' : 'false');
    if (search) params.set('q', search);
    const qs = params.toString();
    const list = await apiFetch<ConversationDto[]>(
      `/chat/conversations${qs ? `?${qs}` : ''}`,
    );
    // Server orders by lastMessageAt; pinned float to the top client-side.
    setConversations(
      [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    );
  }, [session, statusFilter, pinnedOnly, showArchived, search]);

  useEffect(() => {
    void loadConversations().catch(() => {
      // Sidebar is optional; the composer still works without it.
    });
  }, [loadConversations, session?.activeCompany?.id]);

  useEffect(() => {
    if (!session || !activeId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const history = await apiFetch<ChatMessageDto[]>(
          `/chat/conversations/${activeId}/messages`,
        );
        if (cancelled) return;
        const bubbles = history.map(toBubble);
        setMessages(bubbles);

        const pending = bubbles.filter(
          (m) => m.role === 'assistant' && isInFlight(m.status),
        );
        if (pending.length > 0) {
          for (const m of pending) {
            pendingIdsRef.current.add(m.id);
          }
          ensureSocket();
        }
      } catch {
        if (!cancelled) {
          setMessages([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, activeId, ensureSocket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = sidebarRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      (previouslyFocused ?? menuButtonRef.current)?.focus?.();
    };
  }, [sidebarOpen]);

  const patchConversation = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      setError(null);
      try {
        await apiFetch<ConversationDto>(`/chat/conversations/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
        await loadConversations();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
      }
    },
    [loadConversations],
  );

  const onDelete = useCallback(
    async (id: string) => {
      setError(null);
      if (!window.confirm('Delete this conversation?')) return;
      try {
        await apiFetch(`/chat/conversations/${id}`, { method: 'DELETE' });
        if (id === activeId) {
          setActiveId(null);
          setMessages([]);
        }
        await loadConversations();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    },
    [activeId, loadConversations],
  );

  const onSend = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const content = input.trim();
      if (!content || sending || viewOnly) return;

      setError(null);
      setSending(true);
      setInput('');

      // Optimistic takeover: mark local in-flight assistants cancelled.
      setMessages((prev) =>
        prev.map((m) =>
          m.role === 'assistant' && isInFlight(m.status)
            ? { ...m, status: 'cancelled' as const }
            : m,
        ),
      );
      for (const id of [...pendingIdsRef.current]) {
        pendingIdsRef.current.delete(id);
      }

      const localUserId = `local-user-${Date.now()}`;
      const localAssistantId = `local-assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: localUserId, role: 'user', content, status: 'completed' },
        {
          id: localAssistantId,
          role: 'assistant',
          content: '',
          status: 'pending',
        },
      ]);

      try {
        const result = await apiFetch<ChatResponse>('/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: content,
            idempotencyKey: crypto.randomUUID(),
            ...(activeId ? { conversationId: activeId } : {}),
          }),
        });
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === localUserId) {
              return {
                ...m,
                id: result.message.id,
                status: result.message.status,
              };
            }
            if (m.id === localAssistantId) {
              return {
                ...m,
                id: result.assistantMessage.id,
                status: result.assistantMessage.status,
                parentMessageId: result.assistantMessage.parentMessageId,
              };
            }
            return m;
          }),
        );
        trackPending(result.assistantMessage.id);

        if (result.conversationId !== activeId) {
          // Fresh conversation was created server-side; select it.
          setActiveId(result.conversationId);
        }
        void loadConversations().catch(() => undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Send failed');
        setMessages((prev) =>
          prev.filter((m) => m.id !== localUserId && m.id !== localAssistantId),
        );
      } finally {
        setSending(false);
      }
    },
    [input, sending, viewOnly, activeId, trackPending, loadConversations],
  );

  const onStop = useCallback(
    async (assistantId: string) => {
      setError(null);
      setStoppingIds((prev) => new Set(prev).add(assistantId));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, status: 'cancelled' as const } : m,
        ),
      );
      pendingIdsRef.current.delete(assistantId);
      disconnectSocketIfIdle();

      // Optimistic local bubbles have no server row yet.
      if (assistantId.startsWith('local-')) {
        setStoppingIds((prev) => {
          const next = new Set(prev);
          next.delete(assistantId);
          return next;
        });
        return;
      }

      try {
        await apiFetch<StopResponse>(`/chat/messages/${assistantId}/stop`, {
          method: 'POST',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Stop failed');
      } finally {
        setStoppingIds((prev) => {
          const next = new Set(prev);
          next.delete(assistantId);
          return next;
        });
      }
    },
    [disconnectSocketIfIdle],
  );

  const onRetry = useCallback(
    async (assistantId: string) => {
      setError(null);
      try {
        trackPending(assistantId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, status: 'pending', lastError: null, content: '' }
              : m,
          ),
        );
        const result = await apiFetch<RetryResponse>(
          `/chat/messages/${assistantId}/retry`,
          { method: 'POST' },
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  status: result.assistantMessage.status,
                  lastError: result.assistantMessage.lastError,
                }
              : m,
          ),
        );
      } catch (err) {
        pendingIdsRef.current.delete(assistantId);
        disconnectSocketIfIdle();
        setError(err instanceof Error ? err.message : 'Retry failed');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, status: 'failed' } : m,
          ),
        );
      }
    },
    [trackPending, disconnectSocketIfIdle],
  );

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Loading…
      </div>
    );
  }

  const companyName = session.activeCompany?.name ?? 'No company';
  const hasInFlight = messages.some(
    (m) => m.role === 'assistant' && isInFlight(m.status),
  );

  function closeSidebar() {
    setSidebarOpen(false);
  }

  function openSidebar() {
    setSidebarOpen(true);
  }

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setError(null);
    closeSidebar();
  }

  function selectConversation(id: string) {
    setActiveId(id);
    setError(null);
    closeSidebar();
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 overflow-x-hidden">
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-indigo-600 truncate">
                AI Support Assistant
              </h1>
              <span className="hidden sm:inline-flex border-indigo-500 text-gray-900 items-center px-1 pt-1 border-b-2 text-sm font-medium">
                Chat
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-gray-600 hidden md:inline">
                {session.user.name}
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

      <main className="flex-1 flex flex-col min-h-0 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
        <div className="mb-3 sm:mb-4 shrink-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Support Chat
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Recommend replies using your company guidelines
          </p>
        </div>

        <div className="relative flex-1 flex gap-4 min-h-0 h-[min(40rem,calc(100dvh-9.5rem))] sm:h-[min(42rem,calc(100dvh-10.5rem))]">
          {sidebarOpen && (
            <button
              type="button"
              aria-label="Close conversations menu"
              className="fixed inset-0 z-40 bg-gray-900/40 md:hidden"
              onClick={closeSidebar}
            />
          )}

          <aside
            ref={sidebarRef}
            id="conversations-drawer"
            aria-label="Conversations"
            className={`fixed inset-y-0 start-0 z-50 w-[min(18rem,88vw)] bg-white shadow-lg flex flex-col transition-transform duration-200 ease-out md:static md:z-auto md:w-72 md:shrink-0 md:translate-x-0 md:shadow md:rounded-lg ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}
          >
            <div className="px-3 pt-3 flex items-center justify-between gap-2 md:hidden">
              <p className="text-sm font-semibold text-gray-900">Conversations</p>
              <button
                type="button"
                onClick={closeSidebar}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 px-2 py-1"
                aria-label="Close conversations menu"
              >
                Close
              </button>
            </div>
            <div className="px-3 pt-3">
              <button
                type="button"
                onClick={startNewChat}
                className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                New chat
              </button>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search chats…"
                className="mt-3 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 min-w-0 rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">All statuses</option>
                  {CONVERSATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-xs text-gray-600">
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={pinnedOnly}
                    onChange={(e) => setPinnedOnly(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Pinned
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Archived
                </label>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border-t border-gray-200 min-h-0">
              {conversations.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6 px-3">
                  No conversations yet.
                </p>
              )}
              <ul className="divide-y divide-gray-100">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(c.id)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 ${
                        c.id === activeId ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {c.title || 'Untitled chat'}
                        </span>
                        {c.pinned && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 shrink-0">
                            Pinned
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGES[c.status]}`}
                        >
                          {STATUS_LABELS[c.status]}
                        </span>
                        <span className="text-[10px] text-gray-400 truncate">
                          {formatWhen(c.lastMessageAt ?? c.createdAt)}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="flex-1 bg-white shadow rounded-lg flex flex-col min-w-0 min-h-0 w-full">
            <div className="px-3 sm:px-4 py-3 border-b border-gray-200 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center min-w-0 gap-2">
                  <button
                    ref={menuButtonRef}
                    type="button"
                    className="md:hidden inline-flex items-center justify-center rounded-md border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50 shrink-0"
                    aria-label="Open conversations menu"
                    aria-expanded={sidebarOpen}
                    aria-controls="conversations-drawer"
                    onClick={openSidebar}
                  >
                    <span aria-hidden="true" className="block w-4 space-y-1">
                      <span className="block h-px bg-current" />
                      <span className="block h-px bg-current" />
                      <span className="block h-px bg-current" />
                    </span>
                  </button>
                  <div className="bg-indigo-100 rounded-full h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center text-indigo-600 font-semibold shrink-0">
                    {companyName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activeConversation?.title || 'New chat'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{companyName}</p>
                  </div>
                </div>
                {activeConversation && (
                  <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 shrink-0 max-w-[55%]">
                    <select
                      value={activeConversation.status}
                      onChange={(e) =>
                        void patchConversation(activeConversation.id, {
                          status: e.target.value,
                        })
                      }
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs bg-white focus:border-indigo-500 focus:ring-indigo-500 max-w-full"
                    >
                      {CONVERSATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        void patchConversation(activeConversation.id, {
                          pinned: !activeConversation.pinned,
                        })
                      }
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      {activeConversation.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void patchConversation(activeConversation.id, {
                          archived: !activeConversation.archived,
                        })
                      }
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      {activeConversation.archived ? 'Unarchive' : 'Archive'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(activeConversation.id)}
                      className="text-xs font-medium text-rose-600 hover:text-rose-800"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              {activeConversation && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        title={`Rate ${star} star${star > 1 ? 's' : ''}${
                          activeConversation.rating === star ? ' (clear)' : ''
                        }`}
                        onClick={() =>
                          void patchConversation(activeConversation.id, {
                            rating:
                              activeConversation.rating === star ? null : star,
                          })
                        }
                        className={`text-lg leading-none ${
                          (activeConversation.rating ?? 0) >= star
                            ? 'text-yellow-500'
                            : 'text-gray-300 hover:text-yellow-400'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-400 truncate">
                    {activeConversation.guidelineSnapshotHash
                      ? `Guidance bound: ${activeConversation.guidelineSnapshotHash.slice(0, 12)}…`
                      : 'No guidance bound'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 p-3 sm:p-4 overflow-y-auto min-h-0">
              <div className="flex flex-col space-y-4">
                {messages.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">
                    {activeId
                      ? 'No messages in this conversation yet.'
                      : 'Enter a customer message to get started.'}
                  </p>
                )}
                {messages.map((msg) => {
                  const isAssistant = msg.role === 'assistant';
                  const label = isAssistant
                    ? 'AI'
                    : session.user.name.slice(0, 1).toUpperCase();

                  return (
                    <div key={msg.id} className="flex items-end">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${
                          isAssistant
                            ? 'bg-emerald-200 text-emerald-800'
                            : 'bg-indigo-200 text-indigo-700'
                        }`}
                      >
                        {label}
                      </div>
                      <div className="flex flex-col space-y-2 text-sm max-w-[min(36rem,calc(100%-2.5rem))] mx-2 items-start min-w-0">
                        {isInFlight(msg.status) ? (
                          <div className="space-y-2">
                            <span className="px-4 py-2 rounded-lg inline-block rounded-bl-none bg-gray-100 text-gray-500 italic">
                              {msg.status === 'processing'
                                ? 'Generating reply…'
                                : 'Queued…'}
                            </span>
                            <button
                              type="button"
                              onClick={() => void onStop(msg.id)}
                              disabled={stoppingIds.has(msg.id)}
                              className="text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-60"
                            >
                              {stoppingIds.has(msg.id) ? 'Stopping…' : 'Stop'}
                            </button>
                          </div>
                        ) : msg.status === 'failed' ? (
                          <div className="space-y-2">
                            <span className="px-4 py-2 rounded-lg inline-block rounded-bl-none bg-red-50 text-red-700 break-words">
                              {msg.lastError || 'Generation failed'}
                            </span>
                            {!viewOnly && (
                              <button
                                type="button"
                                onClick={() => void onRetry(msg.id)}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                              >
                                Retry
                              </button>
                            )}
                          </div>
                        ) : msg.status === 'cancelled' ? (
                          <span className="px-4 py-2 rounded-lg inline-block rounded-bl-none bg-gray-50 text-gray-400 italic">
                            Stopped
                          </span>
                        ) : (
                          <span
                            className={`px-4 py-2 rounded-lg inline-block rounded-bl-none whitespace-pre-wrap break-words ${
                              isAssistant
                                ? 'bg-emerald-50 text-gray-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {msg.content}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </div>

            {error && (
              <div className="px-4 py-2 text-sm text-red-600 border-t border-red-50 bg-red-50 shrink-0 break-words">
                {error}
              </div>
            )}

            {viewOnly && activeConversation && (
              <div className="px-3 sm:px-4 py-2 text-sm text-amber-800 bg-amber-50 border-t border-amber-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <span>
                  This conversation is{' '}
                  {STATUS_LABELS[activeConversation.status].toLowerCase()} —
                  view-only transcript.
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void patchConversation(activeConversation.id, {
                      status: 'open',
                    })
                  }
                  className="text-xs font-semibold text-amber-900 underline hover:no-underline shrink-0"
                >
                  Reopen
                </button>
              </div>
            )}

            <div className="border-t border-gray-200 px-3 sm:px-4 py-3 shrink-0">
              <form
                className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3"
                onSubmit={onSend}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={2}
                  disabled={viewOnly}
                  placeholder={
                    viewOnly
                      ? 'This conversation is closed — reopen to send messages'
                      : hasInFlight
                        ? 'Send to cancel current reply and ask again'
                        : 'Customer message (Shift+Enter for new line)'
                  }
                  className="rounded-md border border-gray-300 flex-1 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 py-2 px-3 text-sm resize-y min-h-[3rem] max-h-[8rem] disabled:bg-gray-100 disabled:text-gray-400 w-full"
                />
                <button
                  type="submit"
                  disabled={sending || viewOnly || !input.trim()}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 shrink-0 w-full sm:w-auto"
                >
                  {sending ? 'Sending…' : hasInFlight ? 'Send (take over)' : 'Send'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
