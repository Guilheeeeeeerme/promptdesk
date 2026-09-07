import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch } from './api';
import { useAuth } from './auth';
import { useLocale } from './locale';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserView,
} from './types';
import type { Role } from '@shared/auth';
import { FeedbackBanner, type Feedback } from './FeedbackBanner';

const allRoles: Role[] = ['root', 'admin', 'owner', 'manager', 'agent'];

function rolesFor(actor: Role): Role[] {
  if (actor === 'root') return allRoles;
  if (actor === 'admin') return ['admin', 'manager', 'agent'];
  if (actor === 'owner') return ['manager', 'agent'];
  if (actor === 'manager') return ['agent'];
  return [];
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function roleLabel(role: Role): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

interface UserFormProps {
  actorRole: Role;
  user: UserView | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateUserInput | UpdateUserInput) => Promise<void>;
}

function UserForm({ actorRole, user, busy, onCancel, onSubmit }: UserFormProps) {
  const { t } = useLocale();
  const assignableRoles = rolesFor(actorRole);
  const allowedRoles =
    user && !assignableRoles.includes(user.role)
      ? [...assignableRoles, user.role]
      : assignableRoles;
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<Role>(
    user?.role ?? assignableRoles[0] ?? 'agent',
  );
  const [password, setPassword] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = user
      ? {
          name,
          email,
          role,
          ...(password ? { password } : {}),
        }
      : { name, email, role, password };
    await onSubmit(input);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="rounded-lg bg-white p-4 shadow sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {user ? t('Edit user') : t('Create user')}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {user ? t('Update account details or reset the password.') : t('Add a user to the active company.')}
          </p>
        </div>
        <button type="button" disabled={busy} onClick={onCancel} className="text-sm font-medium text-gray-500 hover:text-gray-900 disabled:opacity-60">
          {t('Cancel')}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-gray-700">
          {t('Name')}
          <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm" />
        </label>
        <label className="text-sm font-medium text-gray-700">
          {t('Email')}
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm" />
        </label>
        <label className="text-sm font-medium text-gray-700">
          {t('Role')}
          <select value={role} onChange={(event) => setRole(event.target.value as Role)} className="mt-1 block w-full rounded-md border-gray-300 bg-white text-sm shadow-sm">
            {allowedRoles.map((option) => (
              <option key={option} value={option} disabled={!assignableRoles.includes(option)}>
                {roleLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          {t(user ? 'Password (optional)' : 'Password')}
          <input required={!user} minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm" />
        </label>
      </div>
      <button type="submit" disabled={busy} className="mt-5 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
        {busy ? t('Saving…') : user ? t('Save changes') : t('Create user')}
      </button>
    </form>
  );
}

export function UsersPage() {
  const { session } = useAuth();
  const { t } = useLocale();
  const [users, setUsers] = useState<UserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [editing, setEditing] = useState<UserView | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const canManage = Boolean(
    session && ['root', 'admin', 'manager', 'owner'].includes(session.user.role),
  );
  const load = useCallback(async () => {
    setError(null);
    setUsers(await apiFetch<UserView[]>('/users'));
  }, []);

  useEffect(() => {
    if (!canManage) return;
    void load().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : t('Failed to load users');
      setError(message);
      setFeedback({ tone: 'error', message });
    }).finally(() => setLoading(false));
  }, [canManage, load, t]);

  const companyName = session?.activeCompany?.name ?? t('No active company');
  const formUser = editing === undefined ? null : editing;
  const emptyMessage = useMemo(
    () => session?.user.role === 'manager'
      ? t('No agent users are assigned to this company.')
      : t('No users are assigned to this company.'),
    [session?.user.role, t],
  );

  if (!session || !canManage) return <Navigate to="/" replace />;
  if (loading) return <p className="text-sm text-gray-600">{t('Loading users…')}</p>;

  async function createOrUpdate(input: CreateUserInput | UpdateUserInput) {
    setBusy(true);
    setError(null);
    setFeedback({ tone: 'info', message: formUser ? t('Saving user changes…') : t('Creating user…') });
    try {
      if (formUser) {
        await apiFetch<UserView>(`/users/${formUser.id}`, { method: 'PATCH', body: JSON.stringify(input) });
      } else {
        await apiFetch<UserView>('/users', { method: 'POST', body: JSON.stringify(input) });
      }
      await load();
      setEditing(undefined);
      setFeedback({ tone: 'success', message: formUser ? t('User changes saved.') : t('User created successfully.') });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Unable to save user');
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(user: UserView) {
    if (!window.confirm(t('Delete {name}? This cannot be undone.').replace('{name}', user.name))) return;
    setBusy(true);
    setError(null);
    setFeedback({ tone: 'info', message: t('Deleting {name}…').replace('{name}', user.name) });
    try {
      await apiFetch(`/users/${user.id}`, { method: 'DELETE' });
      await load();
      if (formUser?.id === user.id) setEditing(undefined);
      setFeedback({ tone: 'success', message: t('{name} was deleted.').replace('{name}', user.name) });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Unable to delete user');
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Users')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('Manage users in {company}.').replace('{company}', companyName)}</p>
        </div>
        {editing === undefined && (
          <button type="button" onClick={() => setEditing(null)} className="inline-flex self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {t('Add user')}
          </button>
        )}
      </div>
      <FeedbackBanner
        feedback={feedback ?? (error ? { tone: 'error', message: error } : null)}
      />
      {editing !== undefined && <div className="mb-6"><UserForm actorRole={session.user.role} user={formUser} busy={busy} onCancel={() => setEditing(undefined)} onSubmit={createOrUpdate} /></div>}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        {users.length === 0 ? <p className="px-4 py-10 text-center text-sm text-gray-500">{emptyMessage}</p> : (
          <div className="divide-y divide-gray-200">
            {users.map((user) => (
              <div key={user.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
                  <p className="truncate text-sm text-gray-500">{user.email}</p>
                  <p className="mt-1 text-xs text-gray-400">{t('Joined {date}').replace('{date}', formatDate(user.createdAt))}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{roleLabel(user.role)}</span>
                  <button type="button" disabled={busy} onClick={() => setEditing(user)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">{t('Edit')}</button>
                  <button type="button" disabled={busy} onClick={() => void remove(user)} className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">{t('Delete')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
