import { useAuth } from './auth';
import { useI18n } from './i18n';

export function SessionHome() {
  const { session } = useAuth();
  const { t } = useI18n();

  if (!session) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">{t('home.title')}</h1>
        <p className="mt-1 text-sm text-muted-strong">{t('home.signedInTo')}</p>
      </div>

      <div className="bg-surface shadow rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-sm font-medium text-muted">{t('home.user')}</h2>
          <p className="mt-1 text-text">{session.user.name}</p>
          <p className="text-sm text-muted-strong">{session.user.email}</p>
          <p className="mt-1 text-sm text-muted-strong capitalize">
            {t('home.role', { role: session.user.role })}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted">
            {t('home.activeCompany')}
          </h2>
          {session.activeCompany ? (
            <p className="mt-1 text-text">{session.activeCompany.name}</p>
          ) : (
            <p className="mt-1 text-muted">{t('home.noneSelected')}</p>
          )}
          {session.user.role === 'root' || session.user.role === 'admin' ? (
            <p className="mt-2 text-xs text-muted">{t('home.switcherHint')}</p>
          ) : (
            <p className="mt-2 text-xs text-muted">{t('home.fixedCompanyHint')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
