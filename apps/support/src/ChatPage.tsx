import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  AlertDialog,
  Badge,
  Banner,
  Button,
  cn,
  EmptyState,
  IconButton,
  Input,
  MenuIcon,
  PlusIcon,
  Select,
  Textarea,
  ThemeToggle,
} from '@shared/ui';
import { LOCALE_LABELS, SUPPORTED_LOCALES } from '@shared/auth';
import { apiFetch, getApiOrigin, getSocketPath, getToken } from './api';
import { useAuth } from './auth';
import { useLocale } from './locale';

type MessageStatus =
  | 'completed'
  | 'pending'
  | 'processing'
  | 'failed'
  | 'cancelled';

type ConversationStatus =
  | 'open'
  | 'solved'
  | 'not_solved'
  | 'wont_solve';

/** Agents (owners) may pick only these; wont_solve is a platform decision. */
const CONVERSATION_STATUSES: ConversationStatus[] = [
  'open',
  'solved',
  'not_solved',
];

const ALL_CONVERSATION_STATUSES: ConversationStatus[] = [
  'open',
  'solved',
  'not_solved',
  'wont_solve',
];

/** solved / not_solved / wont_solve are final: view-only transcript until reopened. */
const FINAL_STATUSES: ConversationStatus[] = [
  'solved',
  'not_solved',
  'wont_solve',
];

function isConversationFinal(status: ConversationStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

const STATUS_LABELS: Record<ConversationStatus, string> = {
  open: 'Open',
  solved: 'Solved',
  not_solved: 'Not solved',
  wont_solve: "Won't solve",
};

const STATUS_BADGE_TONES: Record<
  ConversationStatus,
  'neutral' | 'success' | 'danger' | 'warning'
> = {
  open: 'neutral',
  solved: 'success',
  not_solved: 'danger',
  wont_solve: 'warning',
};

/** Full sentences so the status word can be declined per language. */
const VIEW_ONLY_COPY: Record<ConversationStatus, string> = {
  open: '',
  solved: 'This conversation is solved — reopen to continue.',
  not_solved: 'This conversation is not solved — reopen to continue.',
  wont_solve: "This conversation won't be solved — reopen to continue.",
};

/** End users never see provider internals (credits, quotas, HTTP codes). */
const ASSISTANT_FAILURE_COPY =
  "The assistant couldn't finish this reply. You can retry, or ask a platform admin to step in manually.";

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant' | 'agent';
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

interface AgentMessageEvent {
  type: 'agent_message';
  ownerId: string;
  conversationId: string;
  message: {
    id: string;
    conversationId: string | null;
    role: string;
    status: string;
    content: string;
    createdAt: string;
  };
}

interface ConversationUpdateEvent {
  type: 'conversation_update';
  ownerId: string;
  conversationId: string;
  status: string;
  lastMessageAt: string | null;
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

function toBubble(m: {
  id: string;
  role: string;
  content: string;
  status: string;
  lastError?: string | null;
  parentMessageId?: string | null;
}): ChatBubble {
  return {
    id: m.id,
    role: m.role === 'user' ? 'user' : m.role === 'agent' ? 'agent' : 'assistant',
    content: m.content,
    status: m.status as MessageStatus,
    lastError: m.lastError,
    parentMessageId: m.parentMessageId,
  };
}

export function ChatPage() {
  const { session, loading, logout } = useAuth();
  const { locale, setLocale, t, formatDate } = useLocale();
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const activeIdRef = useRef<string | null>(null);
  const activeCompanyIdRef = useRef<string | null>(
    session?.activeCompany?.id ?? null,
  );
  const listGenerationRef = useRef(0);
  activeCompanyIdRef.current = session?.activeCompany?.id ?? null;
  activeIdRef.current = activeId;

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const viewOnly =
    activeConversation !== null && isConversationFinal(activeConversation.status);

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
      } else if (isInFlight(event.status)) {
        pendingIdsRef.current.add(event.assistantMessageId);
      }
    });

    // Human in the loop: a platform admin replied manually in this thread.
    socket.on('agent:message', (event: AgentMessageEvent) => {
      if (event.conversationId !== activeIdRef.current) return;
      setMessages((prev) =>
        prev.some((m) => m.id === event.message.id)
          ? prev
          : [...prev, toBubble(event.message)],
      );
    });

    // Man-in-the-middle state calls sync live into the owner's chat.
    socket.on('conversation:update', (event: ConversationUpdateEvent) => {
      setConversations((prev) =>
        prev.some((c) => c.id === event.conversationId)
          ? prev.map((c) =>
              c.id === event.conversationId
                ? { ...c, status: event.status as ConversationStatus }
                : c,
            )
          : prev,
      );
    });

    socketRef.current = socket;
    return socket;
  }, []);

  const trackPending = useCallback(
    (assistantId: string) => {
      pendingIdsRef.current.add(assistantId);
      ensureSocket();
    },
    [ensureSocket],
  );

  useEffect(() => {
    // Stay connected for the whole chat session: job streaming, manual human
    // replies and platform state calls all arrive live.
    ensureSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      pendingIdsRef.current.clear();
    };
  }, [ensureSocket]);

  // Search is debounced so typing does not spam the API.
  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const loadConversations = useCallback(async () => {
    const activeCompanyId = session?.activeCompany?.id ?? null;
    if (!activeCompanyId) return;
    const generation = ++listGenerationRef.current;
    const companyAtStart = activeCompanyId;
    const params = new URLSearchParams();
    // Support is an individual workspace, even when the logged-in user has a
    // platform role. The main app intentionally omits this scope.
    params.set('scope', 'mine');
    if (statusFilter) params.set('status', statusFilter);
    if (pinnedOnly) params.set('pinned', 'true');
    params.set('archived', showArchived ? 'true' : 'false');
    if (search) params.set('q', search);
    const qs = params.toString();
    const list = await apiFetch<ConversationDto[]>(
      `/chat/conversations${qs ? `?${qs}` : ''}`,
    );
    // Drop late responses after a company switch so Alpha never overwrites Beta.
    if (
      generation !== listGenerationRef.current ||
      activeCompanyIdRef.current !== companyAtStart
    ) {
      return;
    }
    setConversations(
      [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    );
  }, [session?.activeCompany?.id, statusFilter, pinnedOnly, showArchived, search]);

  useEffect(() => {
    listGenerationRef.current += 1;
    setActiveId(null);
    setMessages([]);
    setConversations([]);
    setError(null);
  }, [session?.activeCompany?.id]);

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

  useEffect(() => {
    if (!userMenuOpen) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
        userMenuButtonRef.current?.focus();
      }
    }

    function onPointer(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (userMenuRef.current?.contains(target)) return;
      setUserMenuOpen(false);
    }

    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [userMenuOpen]);

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
        setError(err instanceof Error ? err.message : t("Couldn't update — try again."));
      }
    },
    [loadConversations, t],
  );

  const confirmDelete = useCallback(
    async () => {
      const id = deleteTargetId;
      if (!id) return;
      setError(null);
      setDeleting(true);
      try {
        await apiFetch(`/chat/conversations/${id}`, { method: 'DELETE' });
        if (id === activeId) {
          setActiveId(null);
          setMessages([]);
        }
        setDeleteTargetId(null);
        await loadConversations();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("Couldn't delete — try again."));
      } finally {
        setDeleting(false);
      }
    },
    [deleteTargetId, activeId, loadConversations, t],
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
            locale,
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
        setError(err instanceof Error ? err.message : t("Couldn't send — try again."));
        setMessages((prev) =>
          prev.filter((m) => m.id !== localUserId && m.id !== localAssistantId),
        );
      } finally {
        setSending(false);
      }
    },
    [input, sending, viewOnly, activeId, locale, trackPending, loadConversations, t],
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
        setError(err instanceof Error ? err.message : t("Couldn't stop — try again."));
      } finally {
        setStoppingIds((prev) => {
          const next = new Set(prev);
          next.delete(assistantId);
          return next;
        });
      }
    },
    [t],
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
          { method: 'POST', body: JSON.stringify({ locale }) },
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
        setError(err instanceof Error ? err.message : t("Couldn't retry — try again."));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, status: 'failed' } : m,
          ),
        );
      }
    },
    [locale, trackPending, t],
  );

  if (loading || !session) {
    return (
      <div className="flex h-dvh items-center justify-center bg-surface-base text-14 text-ink-secondary">
        {t('Loading…')}
      </div>
    );
  }

  const companyName = session.activeCompany?.name ?? t('No company');
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
    <div className="flex h-dvh flex-col overflow-hidden bg-surface-base">
      <header className="sticky top-0 z-40 border-b border-line bg-surface-base supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-[var(--header-height)] max-w-content items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <p className="hidden text-12 font-medium uppercase tracking-wide text-ink-tertiary sm:block">
              PromptDesk
            </p>
            <h1 className="truncate text-15 font-semibold text-ink-primary">
              {t('AI Support Assistant')}
            </h1>
            <span className="hidden text-13 font-medium text-ink-secondary sm:inline">
              {t('Chat')}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle
              labelDark={t('Dark mode')}
              labelLight={t('Light mode')}
            />
            <div className="relative" ref={userMenuRef}>
              <Button
                ref={userMenuButtonRef}
                variant="ghost"
                size="sm"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-controls="support-account-menu"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="max-w-[9rem] truncate"
              >
                {session.user.name}
              </Button>
              {userMenuOpen && (
                <div
                  id="support-account-menu"
                  role="menu"
                  className="absolute end-0 mt-1.25 w-56 rounded-md border border-line bg-surface-overlay py-1 shadow-overlay"
                >
                  <div className="border-b border-line-subtle px-3 py-2 text-12 text-ink-tertiary">
                    {session.user.email}
                  </div>
                  <div className="border-b border-line-subtle px-3 py-2">
                    <label
                      className="mb-1.25 block text-12 font-medium text-ink-tertiary"
                      htmlFor="support-language-select"
                    >
                      {t('Language')}
                    </label>
                    <Select
                      id="support-language-select"
                      value={locale}
                      onChange={(e) =>
                        void setLocale(e.target.value as typeof locale)
                      }
                      className="py-1.5 text-13"
                    >
                      {SUPPORTED_LOCALES.map((supported) => (
                        <option key={supported} value={supported}>
                          {LOCALE_LABELS[supported]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      void logout();
                    }}
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

      <main className="mx-auto flex min-h-0 w-full max-w-content flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5 sm:py-6">
        <div className="mb-4 shrink-0 sm:mb-5">
          <h2 className="text-balance text-[28px] font-bold leading-8 text-ink-primary sm:text-[32px] sm:leading-9">
            {t('Support Chat')}
          </h2>
          <p className="mt-1.25 text-pretty text-14 text-ink-secondary">
            {t('Recommend replies using your company guidelines')}
          </p>
        </div>

        <div className="relative flex min-h-0 flex-1 gap-4 overflow-hidden">
          {sidebarOpen && (
            <button
              type="button"
              aria-label={t('Close conversations menu')}
              className="fixed inset-0 z-40 bg-scrim md:hidden"
              onClick={closeSidebar}
            />
          )}

          <aside
            ref={sidebarRef}
            id="conversations-drawer"
            aria-label={t('Conversations')}
            className={cn(
              'fixed inset-y-0 start-0 z-50 flex w-[min(18rem,88vw)] min-h-0 flex-col border-e border-line bg-surface-raised transition-transform duration-200 ease-out',
              'supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]',
              'md:static md:z-auto md:w-72 md:shrink-0 md:translate-x-0 md:rounded-md md:border md:shadow-overlay',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-3 py-3 md:hidden">
              <p className="text-14 font-semibold text-ink-primary">
                {t('Conversations')}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeSidebar}
                aria-label={t('Close conversations menu')}
              >
                {t('Close')}
              </Button>
            </div>
            <div className="px-3 pt-3">
              <Button
                type="button"
                onClick={startNewChat}
                className="w-full"
                size="sm"
              >
                <PlusIcon className="size-3.5" />
                {t('New chat')}
              </Button>
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('Search chats…')}
                className="mt-3 py-1.5 text-13"
              />
              <div className="mt-2 flex items-center gap-2">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="min-w-0 flex-1 py-1.5 text-13"
                >
                  <option value="">{t('All statuses')}</option>
                  {ALL_CONVERSATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(STATUS_LABELS[s])}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-12 text-ink-secondary">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={pinnedOnly}
                    onChange={(e) => setPinnedOnly(e.target.checked)}
                    className="rounded-sm border-line text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  />
                  {t('Pinned')}
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="rounded-sm border-line text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  />
                  {t('Archived')}
                </label>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-t border-line-subtle">
              {conversations.length === 0 && (
                <EmptyState
                  title={t('No conversations yet.')}
                  className="py-6"
                />
              )}
              <ul className="divide-y divide-line-subtle">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(c.id)}
                      className={cn(
                        'w-full px-3 py-2.5 text-start transition-colors hover:bg-surface-hover',
                        c.id === activeId && 'bg-accent-muted',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-14 font-medium text-ink-primary">
                          {c.title || t('Untitled chat')}
                        </span>
                        {c.pinned && (
                          <Badge tone="accent" className="shrink-0 text-[10px]">
                            {t('Pinned')}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <Badge tone={STATUS_BADGE_TONES[c.status]} className="text-[10px]">
                          {t(STATUS_LABELS[c.status])}
                        </Badge>
                        <span className="truncate text-[10px] text-ink-tertiary">
                          {formatDate(c.lastMessageAt ?? c.createdAt)}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col rounded-md border border-line bg-surface-raised shadow-overlay">
            <div className="shrink-0 border-b border-line-subtle px-3 py-3 sm:px-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <IconButton
                    ref={menuButtonRef}
                    label={t('Open conversations menu')}
                    aria-expanded={sidebarOpen}
                    aria-controls="conversations-drawer"
                    className="md:hidden"
                    onClick={openSidebar}
                  >
                    <MenuIcon className="size-4" />
                  </IconButton>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-muted text-14 font-semibold text-accent sm:size-10">
                    {companyName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-14 font-medium text-ink-primary">
                      {activeConversation?.title || t('New chat')}
                    </p>
                    <p className="truncate text-12 text-ink-tertiary">
                      {companyName}
                    </p>
                  </div>
                </div>
                {activeConversation && (
                  <div className="flex max-w-[55%] shrink-0 flex-wrap items-center justify-end gap-x-1 gap-y-1">
                    <Select
                      value={activeConversation.status}
                      onChange={(e) =>
                        void patchConversation(activeConversation.id, {
                          status: e.target.value,
                        })
                      }
                      className="max-w-full py-1 text-12"
                    >
                      {!CONVERSATION_STATUSES.includes(
                        activeConversation.status,
                      ) && (
                        <option value={activeConversation.status} disabled>
                          {t(STATUS_LABELS[activeConversation.status])} ({t('platform')})
                        </option>
                      )}
                      {CONVERSATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s === 'open' && isConversationFinal(activeConversation.status)
                            ? t('Reopen')
                            : t(STATUS_LABELS[s])}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void patchConversation(activeConversation.id, {
                          pinned: !activeConversation.pinned,
                        })
                      }
                      className="text-12"
                    >
                      {t(activeConversation.pinned ? 'Unpin' : 'Pin')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void patchConversation(activeConversation.id, {
                          archived: !activeConversation.archived,
                        })
                      }
                      className="text-12"
                    >
                      {t(activeConversation.archived ? 'Unarchive' : 'Archive')}
                    </Button>
                    <Button
                      type="button"
                      variant="danger-soft"
                      size="sm"
                      onClick={() => setDeleteTargetId(activeConversation.id)}
                      className="text-12"
                    >
                      {t('Delete')}
                    </Button>
                  </div>
                )}
              </div>
              {activeConversation && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  {isConversationFinal(activeConversation.status) ? (
                    <div
                      className="flex items-center gap-1"
                      role="group"
                      aria-label={t('Rate this conversation')}
                    >
                      <span className="me-1 text-[10px] text-ink-tertiary">
                        {t('Rate')}
                      </span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          title={`${t('Rate')} ${star}/5${
                            activeConversation.rating === star ? ` (${t('clear')})` : ''
                          }`}
                          onClick={() =>
                            void patchConversation(activeConversation.id, {
                              rating:
                                activeConversation.rating === star ? null : star,
                            })
                          }
                          className={cn(
                            'text-lg leading-none transition-colors',
                            (activeConversation.rating ?? 0) >= star
                              ? 'text-warning-foreground'
                              : 'text-ink-tertiary hover:text-warning-foreground',
                          )}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-ink-tertiary">
                      {t('Rate once the chat is solved / not solved')}
                    </span>
                  )}
                  <span className="truncate text-[10px] text-ink-tertiary">
                    {activeConversation.guidelineSnapshotHash
                      ? `${t('Guidance bound')}: ${activeConversation.guidelineSnapshotHash.slice(0, 12)}…`
                      : t('No guidance bound')}
                  </span>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="flex flex-col space-y-4">
                {messages.length === 0 && (
                  <EmptyState
                    title={
                      activeId
                        ? t('No messages in this conversation yet.')
                        : t('Type a question to get started.')
                    }
                    className="py-8"
                  />
                )}
                {messages.map((msg) => {
                  const isAssistant = msg.role === 'assistant';
                  const isAgent = msg.role === 'agent';
                  const label = isAssistant
                    ? t('AI')
                    : isAgent
                      ? 'S'
                      : session.user.name.slice(0, 1).toUpperCase();

                  return (
                    <div key={msg.id} className="flex items-end">
                      <div
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-full text-12',
                          isAgent
                            ? 'bg-warning-muted text-warning-foreground'
                            : isAssistant
                              ? 'bg-success-muted text-success-foreground'
                              : 'bg-accent-muted text-info-foreground',
                        )}
                      >
                        {label}
                      </div>
                      <div className="mx-2 flex min-w-0 max-w-[min(36rem,calc(100%-2.5rem))] flex-col items-start space-y-2 text-14">
                        {isInFlight(msg.status) ? (
                          <div className="space-y-2">
                            <span className="inline-block rounded-md rounded-bl-none bg-surface-hover px-4 py-2 italic text-ink-tertiary">
                              {t('Thinking…')}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void onStop(msg.id)}
                              disabled={stoppingIds.has(msg.id)}
                              className="text-12"
                            >
                              {stoppingIds.has(msg.id) ? t('Stopping…') : t('Stop')}
                            </Button>
                          </div>
                        ) : msg.status === 'failed' ? (
                          <div className="space-y-2">
                            <span className="inline-block break-words rounded-md rounded-bl-none bg-danger-muted px-4 py-2 text-danger-foreground">
                              {t(ASSISTANT_FAILURE_COPY)}
                            </span>
                            {!viewOnly && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void onRetry(msg.id)}
                                className="text-12"
                              >
                                {t('Retry')}
                              </Button>
                            )}
                          </div>
                        ) : msg.status === 'cancelled' ? (
                          <span className="inline-block rounded-md rounded-bl-none bg-surface-sunken px-4 py-2 italic text-ink-tertiary">
                            {t('Stopped')}
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'inline-block break-words whitespace-pre-wrap rounded-md rounded-bl-none px-4 py-2',
                              isAgent
                                ? 'bg-warning-muted text-ink-primary'
                                : isAssistant
                                  ? 'bg-success-muted text-ink-primary'
                                  : 'bg-surface-hover text-ink-primary',
                            )}
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
              <Banner
                tone="error"
                className="shrink-0 rounded-none border-x-0 border-b-0"
              >
                {error}
              </Banner>
            )}

            {viewOnly && activeConversation && (
              <Banner
                tone="warning"
                className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-none border-x-0 border-b-0"
              >
                <span>{t(VIEW_ONLY_COPY[activeConversation.status])}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void patchConversation(activeConversation.id, {
                      status: 'open',
                    })
                  }
                  className="shrink-0 text-12 underline hover:no-underline"
                >
                  {t('Reopen')}
                </Button>
              </Banner>
            )}

            <div className="shrink-0 border-t border-line-subtle px-3 py-3 sm:px-4">
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3"
                onSubmit={onSend}
              >
                <Textarea
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
                      ? t('This chat is marked as finished — reopen to continue')
                      : hasInFlight
                        ? t('The assistant is thinking — send to redirect it')
                        : t('Type your question… (Shift+Enter for new line)')
                  }
                  className="min-h-[3rem] max-h-[8rem] w-full flex-1 py-2 text-13"
                />
                <Button
                  type="submit"
                  disabled={sending || viewOnly || !input.trim()}
                  className="w-full shrink-0 sm:w-auto"
                  size="sm"
                >
                  {sending ? t('Sending…') : t('Send')}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </main>

      <AlertDialog
        open={deleteTargetId !== null}
        title={t('Delete this conversation?')}
        tone="danger"
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
