import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { LoginPage } from './LoginPage';
import { PlaceholderPage } from './PlaceholderPage';
import { SessionHome } from './SessionHome';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<SessionHome />} />
        <Route
          path="/chat"
          element={
            <PlaceholderPage
              title="Support Chat"
              description="Get AI-powered responses based on company guidelines"
            />
          }
        />
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
