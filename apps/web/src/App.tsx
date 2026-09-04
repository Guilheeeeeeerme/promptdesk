import { Navigate, Route, Routes } from 'react-router-dom';
import { appendTokenToReturnUrl, getToken } from '@shared/auth';
import { AppShell } from './AppShell';
import { SUPPORT_ORIGIN } from './api';
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

export default function App() {
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
              title="Chat History"
              description="Browse previous support interactions"
            />
          }
        />
        <Route
          path="/companies"
          element={
            <PlaceholderPage
              title="Companies"
              description="Manage companies and guideline files"
            />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
