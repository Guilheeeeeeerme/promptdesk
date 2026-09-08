import { PageHeader, Panel } from '@shared/ui';
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
      <PageHeader
        title={t('Home')}
        description={t('Signed in to the AI Support Assistant')}
      />

      <Panel className="space-y-6">
        <div>
          <h2 className="text-12 font-medium uppercase tracking-wide text-ink-tertiary">
            {t('User')}
          </h2>
          <p className="mt-1.25 text-16 text-ink-primary">{session.user.name}</p>
          <p className="text-14 text-ink-secondary">{session.user.email}</p>
          <p className="mt-1 text-14 text-ink-secondary capitalize">
            {t('Role')}: {t(session.user.role)}
          </p>
        </div>

        <div className="border-t border-line-subtle pt-5">
          <h2 className="text-12 font-medium uppercase tracking-wide text-ink-tertiary">
            {t('Active company')}
          </h2>
          {session.activeCompany ? (
            <p className="mt-1.25 text-16 text-ink-primary">
              {session.activeCompany.name}
            </p>
          ) : (
            <p className="mt-1.25 text-14 text-ink-tertiary">{t('None selected')}</p>
          )}
          {session.user.role === 'root' || session.user.role === 'admin' ? (
            <p className="mt-2 text-pretty text-13 text-ink-tertiary">
              {t(
                'Use the company switcher in the header to change tenant context. Open Chat to work in Support under the same session.',
              )}
            </p>
          ) : (
            <p className="mt-2 text-pretty text-13 text-ink-tertiary">
              {t(
                'Your company is fixed for this account. Open Chat to continue in Support.',
              )}
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
