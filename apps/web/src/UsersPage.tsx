import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertDialog,
  Badge,
  Button,
  EmptyState,
  Input,
  Label,
  PageHeader,
  PageSkeleton,
  Panel,
  Select,
} from '@shared/ui';
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
    <Panel>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-16 font-semibold text-ink-primary">
              {user ? t('Edit user') : t('Create user')}
            </h2>
            <p className="mt-1 text-pretty text-14 text-ink-secondary">
              {user
                ? t('Update account details or reset the password.')
                : t('Add a user to the active company.')}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onCancel}
          >
            {t('Cancel')}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.25">
            <Label htmlFor="user-name">{t('Name')}</Label>
            <Input
              id="user-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.25">
            <Label htmlFor="user-email">{t('Email')}</Label>
            <Input
              id="user-email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.25">
            <Label htmlFor="user-role">{t('Role')}</Label>
            <Select
              id="user-role"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {allowedRoles.map((option) => (
                <option
                  key={option}
                  value={option}
                  disabled={!assignableRoles.includes(option)}
                >
                  {roleLabel(option)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.25">
            <Label htmlFor="user-password">
              {t(user ? 'Password (optional)' : 'Password')}
            </Label>
            <Input
              id="user-password"
              required={!user}
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={busy} className="mt-5">
          {busy ? t('Saving…') : user ? t('Save changes') : t('Create user')}
        </Button>
      </form>
    </Panel>
  );
}

export function UsersPage() {
  const { session } = useAuth();
  const { t } = useLocale();
  const [users, setUsers] = useState<UserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [editing, setEditing] = useState<UserView | null | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<UserView | null>(null);

  const canManage = Boolean(
    session &&
      ['root', 'admin', 'manager', 'owner'].includes(session.user.role),
  );
  const load = useCallback(async () => {
    setError(null);
    setUsers(await apiFetch<UserView[]>('/users'));
  }, []);

  useEffect(() => {
    if (!canManage) return;
    void load()
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : t('Failed to load users');
        setError(message);
        setFeedback({ tone: 'error', message });
      })
      .finally(() => setLoading(false));
  }, [canManage, load, t]);

  const companyName = session?.activeCompany?.name ?? t('No active company');
  const formUser = editing === undefined ? null : editing;
  const emptyMessage = useMemo(
    () =>
      session?.user.role === 'manager'
        ? t('No agent users are assigned to this company.')
        : t('No users are assigned to this company.'),
    [session?.user.role, t],
  );

  if (!session || !canManage) return <Navigate to="/" replace />;
  if (loading) return <PageSkeleton />;

  async function createOrUpdate(input: CreateUserInput | UpdateUserInput) {
    setBusy(true);
    setError(null);
    setFeedback({
      tone: 'info',
      message: formUser ? t('Saving user changes…') : t('Creating user…'),
    });
    try {
      if (formUser) {
        await apiFetch<UserView>(`/users/${formUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        });
      } else {
        await apiFetch<UserView>('/users', {
          method: 'POST',
          body: JSON.stringify(input),
        });
      }
      await load();
      setEditing(undefined);
      setFeedback({
        tone: 'success',
        message: formUser
          ? t('User changes saved.')
          : t('User created successfully.'),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('Unable to save user');
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    const user = pendingDelete;
    if (!user) return;
    setBusy(true);
    setError(null);
    setFeedback({
      tone: 'info',
      message: t('Deleting {name}…').replace('{name}', user.name),
    });
    try {
      await apiFetch(`/users/${user.id}`, { method: 'DELETE' });
      await load();
      if (formUser?.id === user.id) setEditing(undefined);
      setFeedback({
        tone: 'success',
        message: t('{name} was deleted.').replace('{name}', user.name),
      });
      setPendingDelete(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('Unable to delete user');
      setError(message);
      setFeedback({ tone: 'error', message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('Users')}
        description={t('Manage users in {company}.').replace(
          '{company}',
          companyName,
        )}
        actions={
          editing === undefined ? (
            <Button type="button" onClick={() => setEditing(null)}>
              {t('Add user')}
            </Button>
          ) : undefined
        }
      />
      <FeedbackBanner
        feedback={
          feedback ?? (error ? { tone: 'error', message: error } : null)
        }
      />
      {editing !== undefined && (
        <div className="mb-5">
          <UserForm
            actorRole={session.user.role}
            user={formUser}
            busy={busy}
            onCancel={() => setEditing(undefined)}
            onSubmit={createOrUpdate}
          />
        </div>
      )}
      <Panel padded={false}>
        {users.length === 0 ? (
          <EmptyState title={emptyMessage} />
        ) : (
          <div className="divide-y divide-line-subtle">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 px-4 py-4 hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-14 font-semibold text-ink-primary">
                    {user.name}
                  </p>
                  <p className="truncate text-14 text-ink-secondary">
                    {user.email}
                  </p>
                  <p className="mt-1 text-12 text-ink-tertiary">
                    {t('Joined {date}').replace(
                      '{date}',
                      formatDate(user.createdAt),
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{roleLabel(user.role)}</Badge>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => setEditing(user)}
                  >
                    {t('Edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="danger-soft"
                    size="sm"
                    disabled={busy}
                    onClick={() => setPendingDelete(user)}
                  >
                    {t('Delete')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <AlertDialog
        open={pendingDelete !== null}
        title={t('Delete user')}
        description={
          pendingDelete
            ? t('Delete {name}? This cannot be undone.').replace(
                '{name}',
                pendingDelete.name,
              )
            : undefined
        }
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        tone="danger"
        busy={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  );
}
