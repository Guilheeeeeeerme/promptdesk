import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, getApiOrigin, getSocketPath, getToken, MAIN_ORIGIN } from './api';
import { useAuth } from './auth';

type MessageStatus =
  | 'completed'
  | 'pending'
  | 'processing'
  | 'failed'
  | 'cancelled';

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
  createdAt: string;
}

interface ChatResponse {
  status: string;
  reply: null;
  message: ChatMessageDto;
  assistantMessage: ChatMessageDto;
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

export function ChatPage() {
  const { session, loading, logout } = useAuth();
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    void (async () => {
      try {
        const history = await apiFetch<ChatMessageDto[]>('/chat/messages?limit=50');
        if (cancelled) return;
        const bubbles: ChatBubble[] = history.map((m) => ({
          id: m.id,
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
          status: m.status,
          lastError: m.lastError,
          parentMessageId: m.parentMessageId,
        }));
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
        // History is optional; chat still works without hydrate
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user.id, session?.activeCompany?.id, ensureSocket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onSend = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const content = input.trim();
      if (!content || sending) return;

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Send failed');
        setMessages((prev) =>
          prev.filter((m) => m.id !== localUserId && m.id !== localAssistantId),
        );
      } finally {
        setSending(false);
      }
    },
    [input, sending, trackPending],
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-indigo-600">
                AI Support Assistant
              </h1>
              <span className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                Chat
              </span>
              <a
                href={MAIN_ORIGIN}
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Main app
              </a>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 hidden sm:inline">
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Support Chat</h1>
          <p className="mt-1 text-sm text-gray-600">
            Recommend replies using your company guidelines
          </p>
        </div>

        <div className="bg-white shadow rounded-lg flex flex-col h-[600px]">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center">
              <div className="bg-indigo-100 rounded-full h-10 w-10 flex items-center justify-center text-indigo-600 font-semibold">
                {companyName.slice(0, 1).toUpperCase()}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{companyName}</p>
                <p className="text-xs text-gray-500">Active company</p>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            <div className="flex flex-col space-y-4">
              {messages.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  Enter a customer message to get started.
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
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                        isAssistant
                          ? 'bg-emerald-200 text-emerald-800'
                          : 'bg-indigo-200 text-indigo-700'
                      }`}
                    >
                      {label}
                    </div>
                    <div className="flex flex-col space-y-2 text-sm max-w-xl mx-2 items-start">
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
                          <span className="px-4 py-2 rounded-lg inline-block rounded-bl-none bg-red-50 text-red-700">
                            {msg.lastError || 'Generation failed'}
                          </span>
                          <button
                            type="button"
                            onClick={() => void onRetry(msg.id)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            Retry
                          </button>
                        </div>
                      ) : msg.status === 'cancelled' ? (
                        <span className="px-4 py-2 rounded-lg inline-block rounded-bl-none bg-gray-50 text-gray-400 italic">
                          Stopped
                        </span>
                      ) : (
                        <span
                          className={`px-4 py-2 rounded-lg inline-block rounded-bl-none whitespace-pre-wrap ${
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
            <div className="px-4 py-2 text-sm text-red-600 border-t border-red-50 bg-red-50">
              {error}
            </div>
          )}

          <div className="border-t border-gray-200 px-4 py-3">
            <form className="flex items-end gap-3" onSubmit={onSend}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={3}
                placeholder={
                  hasInFlight
                    ? 'Send to cancel current reply and ask again'
                    : 'Customer message (Shift+Enter for new line)'
                }
                className="rounded-md border border-gray-300 flex-1 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 py-2 px-3 text-sm resize-y min-h-[4.5rem]"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
              >
                {sending ? 'Sending…' : hasInFlight ? 'Send (take over)' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
