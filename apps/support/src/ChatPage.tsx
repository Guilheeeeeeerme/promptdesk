import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, getApiOrigin, getSocketPath, getToken, MAIN_ORIGIN } from './api';
import { useAuth } from './auth';

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  status: string;
  reply: null;
  message: {
    id: string;
    content: string;
    role: string;
    createdAt: string;
  };
}

export function ChatPage() {
  const { session, loading, logout } = useAuth();
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session) return;

    const token = getToken();
    if (!token) return;

    const socket = io(getApiOrigin(), {
      path: getSocketPath(),
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session]);

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
      const localId = `local-${Date.now()}`;
      setMessages((prev) => [...prev, { id: localId, role: 'user', content }]);

      try {
        const result = await apiFetch<ChatResponse>('/chat', {
          method: 'POST',
          body: JSON.stringify({ message: content }),
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === localId ? { ...m, id: result.message.id } : m,
          ),
        );
        socketRef.current?.emit('chat', { message: content });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Send failed');
        setMessages((prev) => prev.filter((m) => m.id !== localId));
      } finally {
        setSending(false);
      }
    },
    [input, sending],
  );

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
        Loading…
      </div>
    );
  }

  const companyName = session.activeCompany?.name ?? 'No company';

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
              {messages.map((msg) => (
                <div key={msg.id} className="flex items-end">
                  <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-xs text-indigo-700">
                    {session.user.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex flex-col space-y-2 text-sm max-w-xl mx-2 items-start">
                    <span className="px-4 py-2 rounded-lg inline-block rounded-bl-none bg-gray-100 text-gray-700 whitespace-pre-wrap">
                      {msg.content}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {error && (
            <div className="px-4 py-2 text-sm text-red-600 border-t border-red-50 bg-red-50">
              {error}
            </div>
          )}

          <div className="border-t border-gray-200 px-4 py-3">
            <form className="flex items-center" onSubmit={onSend}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Customer message"
                className="rounded-md border border-gray-300 flex-1 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 py-2 px-3 text-sm"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
