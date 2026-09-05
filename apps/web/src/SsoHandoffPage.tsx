import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  appendTokenToReturnUrl,
  buildLoginRedirectUrl,
  isAllowedReturnUrl,
} from '@shared/auth';
import { apiFetch, clearToken, getAllowedReturnOrigins, getToken } from './api';

/**
 * Silent SSO bridge for MFEs on other origins.
 * Passes the main app's current session token to an allowlisted returnUrl.
 */
export function SsoHandoffPage() {
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const [message, setMessage] = useState('Continuing…');

  useEffect(() => {
    const allowed = getAllowedReturnOrigins();
    if (!returnUrl || !isAllowedReturnUrl(returnUrl, allowed)) {
      setMessage('Invalid return URL for SSO');
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
      {message}
    </div>
  );
}
