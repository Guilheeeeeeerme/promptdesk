import { Navigate, Route, Routes } from 'react-router-dom';
import { appendTokenToReturnUrl, getToken } from '@shared/auth';
import { AddCompanyPage } from './AddCompanyPage';
import { AppShell } from './AppShell';
import { CompaniesPage } from './CompaniesPage';
import { SUPPORT_ORIGIN } from './api';
import { LoginPage } from './LoginPage';
import { HistoryPage } from './HistoryPage';
import { SessionHome } from './SessionHome';
import { SsoHandoffPage } from './SsoHandoffPage';
import { UsersPage } from './UsersPage';

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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sso/handoff" element={<SsoHandoffPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<SessionHome />} />
        <Route path="/chat" element={<ChatRedirect />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/companies/new" element={<AddCompanyPage />} />
        <Route path="/users" element={<UsersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
