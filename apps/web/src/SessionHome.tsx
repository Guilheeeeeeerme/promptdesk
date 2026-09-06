import { useAuth } from './auth';
import { useLocale } from './locale';

export function SessionHome() {
  const { session } = useAuth();
  const { t } = useLocale();

  if (!session) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('Home')}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {t('Signed in to the AI Support Assistant')}
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-sm font-medium text-gray-500">{t('User')}</h2>
          <p className="mt-1 text-gray-900">{session.user.name}</p>
          <p className="text-sm text-gray-600">{session.user.email}</p>
          <p className="mt-1 text-sm text-gray-600 capitalize">
            {t('Role')}: {t(session.user.role)}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-500">{t('Active company')}</h2>
          {session.activeCompany ? (
            <p className="mt-1 text-gray-900">{session.activeCompany.name}</p>
          ) : (
            <p className="mt-1 text-gray-500">{t('None selected')}</p>
          )}
          {session.user.role === 'root' || session.user.role === 'admin' ? (
            <p className="mt-2 text-xs text-gray-500">
              Use the company switcher in the header to change tenant context.
              Open Chat to work in Support under the same session.
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-500">
              Your company is fixed for this account. Open Chat to continue in
              Support.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
