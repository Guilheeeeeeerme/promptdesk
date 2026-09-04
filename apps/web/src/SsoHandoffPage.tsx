import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  appendTokenToReturnUrl,
  buildLoginRedirectUrl,
  isAllowedReturnUrl,
} from '@shared/auth';
import { apiFetch, clearToken, getAllowedReturnOrigins, getToken } from './api';
import { useI18n } from './i18n';

/**
 * Silent SSO bridge for MFEs on other origins.
 * Passes the main app's current session token to an allowlisted returnUrl.
 */
export function SsoHandoffPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const [message, setMessage] = useState(() => t('common.continuing'));

  useEffect(() => {
    const allowed = getAllowedReturnOrigins();
    if (!returnUrl || !isAllowedReturnUrl(returnUrl, allowed)) {
      setMessage(t('sso.invalidReturnUrl'));
      return;
    }

    const token = getToken();
    if (!token) {
      window.location.assign(
        buildLoginRedirectUrl(window.location.origin, returnUrl),
      );
      return;
    }

    (async () => {
      try {
        await apiFetch('/auth/me');
        window.location.assign(appendTokenToReturnUrl(returnUrl, token));
      } catch {
        clearToken();
        window.location.assign(
          buildLoginRedirectUrl(window.location.origin, returnUrl),
        );
      }
    })();
  }, [returnUrl]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center text-muted-strong">
      {message}
    </div>
  );
}
