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
import { Banner, Button, Input, Label, Panel } from '@shared/ui';
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
        body: JSON.stringify({
          companyName: companyName.trim(),
          email,
          password,
        }),
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
        setError(
          err instanceof Error ? t(err.message) : t('Registration failed'),
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col justify-center overflow-x-hidden bg-surface-base px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <p className="text-center text-12 font-medium uppercase text-ink-tertiary">
          PromptDesk
        </p>
        <h1 className="mt-1.25 text-balance text-center text-display text-ink-primary">
          {t('AI Support Assistant')}
        </h1>
        <p className="mt-1.25 text-pretty text-center text-17 font-normal text-ink-secondary">
          {t('Create your company account to get started')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Panel>
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-1.25">
              <Label htmlFor="company-name">{t('Company name')}</Label>
              <Input
                id="company-name"
                type="text"
                autoComplete="organization"
                required
                minLength={2}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div className="space-y-1.25">
              <Label htmlFor="email">{t('Email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.25">
              <Label htmlFor="password">{t('Password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <Banner tone="error">{error}</Banner>}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? t('Registering…') : t('Sign up')}
            </Button>

            <p className="text-center text-14 text-ink-secondary">
              {t('Already have an account?')}{' '}
              <Link
                to={
                  validReturnUrl
                    ? `/login?returnUrl=${encodeURIComponent(validReturnUrl)}`
                    : '/login'
                }
                className="font-medium text-accent hover:text-accent-hover"
              >
                {t('Sign in')}
              </Link>
            </p>
          </form>
        </Panel>
      </div>
    </div>
  );
}
