import { useAuth } from './auth';

export function SessionHome() {
  const { session } = useAuth();

  if (!session) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Home</h1>
        <p className="mt-1 text-sm text-muted-strong">
          Signed in to the AI Support Assistant
        </p>
      </div>

      <div className="bg-surface shadow rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-sm font-medium text-muted">User</h2>
          <p className="mt-1 text-text">{session.user.name}</p>
          <p className="text-sm text-muted-strong">{session.user.email}</p>
          <p className="mt-1 text-sm text-muted-strong capitalize">
            Role: {session.user.role}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted">Active company</h2>
          {session.activeCompany ? (
            <p className="mt-1 text-text">{session.activeCompany.name}</p>
          ) : (
            <p className="mt-1 text-muted">None selected</p>
          )}
          {session.user.role === 'root' || session.user.role === 'admin' ? (
            <p className="mt-2 text-xs text-muted">
              Use the company switcher in the header to change tenant context.
              Open Chat to work in Support under the same session.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Your company is fixed for this account. Open Chat to continue in
              Support.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
