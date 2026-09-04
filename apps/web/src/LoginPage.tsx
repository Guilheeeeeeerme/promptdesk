import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  appendTokenToReturnUrl,
  getToken,
  isAllowedReturnUrl,
} from '@shared/auth';
import { getAllowedReturnOrigins } from './api';
import { useAuth } from './auth';
import { useI18n } from './i18n';

export function LoginPage() {
  const { session, loading, login } = useAuth();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allowedOrigins = getAllowedReturnOrigins();
  const validReturnUrl =
    returnUrl && isAllowedReturnUrl(returnUrl, allowedOrigins)
      ? returnUrl
      : null;

  if (!loading && session) {
    const token = getToken();
    if (validReturnUrl && token) {
      window.location.assign(appendTokenToReturnUrl(validReturnUrl, token));
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center text-muted-strong">
          {t('common.continuing')}
        </div>
      );
    }
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (returnUrl && !validReturnUrl) {
      setError(t('login.invalidReturnUrl'));
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      const token = getToken();
      if (validReturnUrl && token) {
        window.location.assign(appendTokenToReturnUrl(validReturnUrl, token));
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold text-primary">
          {t('common.appName')}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-strong">
          {validReturnUrl
            ? t('login.signInToContinue')
            : t('login.signInToAccount')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={onSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-muted-strong"
              >
                {t('login.email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-border-strong px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-muted-strong"
              >
                {t('login.password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-border-strong px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center rounded-md border border-transparent bg-primary py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60"
            >
              {submitting ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
