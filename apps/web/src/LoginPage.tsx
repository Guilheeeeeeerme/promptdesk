import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  appendTokenToReturnUrl,
  getToken,
  isAllowedReturnUrl,
} from '@shared/auth';
import { Banner, Button, Input, Label, Panel } from '@shared/ui';
import { getAllowedReturnOrigins } from './api';
import { useAuth } from './auth';
import { useLocale } from './locale';

export function LoginPage() {
  const { session, loading, login, loginDemo } = useAuth();
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
        <div className="flex min-h-dvh items-center justify-center bg-surface-base text-14 text-ink-secondary">
          {t('Continuing…')}
        </div>
      );
    }
    return <Navigate to="/" replace />;
  }

  async function onDemo() {
    setError(null);

    if (returnUrl && !validReturnUrl) {
      setError(t('Invalid return URL'));
      return;
    }

    setSubmitting(true);
    try {
      await loginDemo();
      const token = getToken();
      if (validReturnUrl && token) {
        window.location.assign(appendTokenToReturnUrl(validReturnUrl, token));
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Demo sign-in failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (returnUrl && !validReturnUrl) {
      setError(t('Invalid return URL'));
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
      setError(err instanceof Error ? err.message : t('Login failed'));
    } finally {
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
          {validReturnUrl ? t('Sign in to continue') : t('Sign in to your account')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Panel>
          <form className="space-y-5" onSubmit={onSubmit}>
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <Banner tone="error">{t(error)}</Banner>}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? t('Signing in…') : t('Sign in')}
            </Button>

            <div className="flex items-center gap-3" role="separator" aria-label={t('Or try the demo')}>
              <span className="h-px flex-1 border-t border-line-subtle" />
              <span className="text-12 text-ink-tertiary">{t('or')}</span>
              <span className="h-px flex-1 border-t border-line-subtle" />
            </div>

            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              className="w-full"
              onClick={onDemo}
            >
              {t('Explore as a demo user')}
            </Button>
            <p className="text-center text-12 text-ink-tertiary">
              {t('Instant access to a sample workspace with an AI support assistant — no signup needed.')}
            </p>

            <p className="text-center text-14 text-ink-secondary">
              {t('Need a company account?')}{' '}
              <Link
                to={
                  validReturnUrl
                    ? `/register?returnUrl=${encodeURIComponent(validReturnUrl)}`
                    : '/register'
                }
                className="font-medium text-accent hover:text-accent-hover"
              >
                {t('Create a company account')}
              </Link>
            </p>
          </form>
        </Panel>
      </div>
    </div>
  );
}
