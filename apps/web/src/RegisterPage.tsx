import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ApiError,
  appendTokenToReturnUrl,
  getToken,
  isAllowedReturnUrl,
  setToken,
  type LoginResponse,
} from '@shared/auth';
import { apiFetch, getAllowedReturnOrigins } from './api';
import { useLocale } from './locale';

export function RegisterPage() {
  const { t } = useLocale();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allowedOrigins = getAllowedReturnOrigins();
  const validReturnUrl =
    returnUrl && isAllowedReturnUrl(returnUrl, allowedOrigins)
      ? returnUrl
      : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (returnUrl && !validReturnUrl) {
      setError(t('Invalid return URL'));
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch<LoginResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ companyName: companyName.trim(), email, password }),
      });
      setToken(data.token);
      const token = getToken();
      if (validReturnUrl && token) {
        window.location.assign(appendTokenToReturnUrl(validReturnUrl, token));
        return;
      }
      window.location.assign('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t('This e-mail already belongs to an account.'));
      } else {
        setError(err instanceof Error ? t(err.message) : t('Registration failed'));
      }
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
          {t('Create your company account to get started')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={onSubmit}>
            <div>
              <label
                htmlFor="company-name"
                className="block text-sm font-medium text-gray-700"
              >
                {t('Company name')}
              </label>
              <input
                id="company-name"
                type="text"
                autoComplete="organization"
                required
                minLength={2}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              />
            </div>

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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {submitting ? t('Registering…') : t('Sign up')}
            </button>

            <p className="text-center text-sm text-gray-600">
              {t('Already have an account?')}{' '}
              <Link
                to={validReturnUrl ? `/login?returnUrl=${encodeURIComponent(validReturnUrl)}` : '/login'}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                {t('Sign in')}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
