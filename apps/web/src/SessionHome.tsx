import { getToken } from './api';
import { useAuth } from './auth';

export function SessionHome() {
  const { session } = useAuth();
  const token = getToken();

  if (!session) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Session</h1>
        <p className="mt-1 text-sm text-gray-600">
          Server-side Redis session context (source of truth for tenant)
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-gray-500">User</h2>
          <p className="mt-1 text-gray-900">
            {session.user.name} &lt;{session.user.email}&gt;
          </p>
          <p className="text-sm text-gray-600">Role: {session.user.role}</p>
          <p className="text-sm text-gray-600">ID: {session.user.id}</p>
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-500">Active company</h2>
          {session.activeCompany ? (
            <>
              <p className="mt-1 text-gray-900">{session.activeCompany.name}</p>
              <p className="text-sm text-gray-600">
                ID: {session.activeCompany.id}
              </p>
            </>
          ) : (
            <p className="mt-1 text-gray-900">None selected</p>
          )}
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-500">Session token</h2>
          <p className="mt-1 text-xs font-mono break-all text-gray-700 bg-gray-50 p-3 rounded">
            {token}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Stored in localStorage. Switching company updates Redis only — this
            token stays the same.
          </p>
        </div>
      </div>
    </div>
  );
}
