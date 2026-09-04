import { Navigate, Route, Routes } from 'react-router-dom';
import { appendTokenToReturnUrl, getToken } from '@shared/auth';
import { AddCompanyPage } from './AddCompanyPage';
import { AppShell } from './AppShell';
import { CompaniesPage } from './CompaniesPage';
import { SUPPORT_ORIGIN } from './api';
import { useAuth } from './auth';
import { I18nProvider, useI18n } from './i18n';
import { LoginPage } from './LoginPage';
import { PlaceholderPage } from './PlaceholderPage';
import { SessionHome } from './SessionHome';
import { SsoHandoffPage } from './SsoHandoffPage';

function ChatRedirect() {
  const token = getToken();
  const target = token
    ? appendTokenToReturnUrl(
        SUPPORT_ORIGIN.endsWith('/') ? SUPPORT_ORIGIN : `${SUPPORT_ORIGIN}/`,
        token,
      )
    : SUPPORT_ORIGIN;
  window.open(target, '_blank', 'noopener,noreferrer');
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  const { t } = useI18n();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sso/handoff" element={<SsoHandoffPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<SessionHome />} />
        <Route path="/chat" element={<ChatRedirect />} />
        <Route
          path="/history"
          element={
            <PlaceholderPage
              title={t('history.title')}
              description={t('history.description')}
            />
          }
        />
        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/companies/new" element={<AddCompanyPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { session } = useAuth();

  return (
    <I18nProvider companyDefault={session?.activeCompany?.defaultLanguage}>
      <AppRoutes />
    </I18nProvider>
  );
}
