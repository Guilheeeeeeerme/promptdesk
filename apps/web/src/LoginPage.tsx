import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  appendTokenToReturnUrl,
  getToken,
  isAllowedReturnUrl,
} from '@shared/auth';
import { getAllowedReturnOrigins } from './api';
import { useAuth } from './auth';
import { useLocale } from './locale';

export function LoginPage() {
  const { session, loading, login } = useAuth();
  const { t } = useLocale();
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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
          {t('Continuing…')}
        </div>
      );
    }
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (returnUrl && !validReturnUrl) {
      setError('Invalid return URL');
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
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold text-indigo-600">
          {t('AI Support Assistant')}
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          {validReturnUrl ? t('Sign in to continue') : t('Sign in to your account')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={onSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                {t('Email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                {t('Password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {t(error)}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {submitting ? t('Signing in…') : t('Sign in')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
