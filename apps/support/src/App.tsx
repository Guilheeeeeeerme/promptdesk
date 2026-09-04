import { useAuth } from './auth';
import { ChatPage } from './ChatPage';
import { I18nProvider } from './i18n';

function I18nRoot() {
  const { session } = useAuth();

  return (
    <I18nProvider companyDefault={session?.activeCompany?.defaultLanguage}>
      <ChatPage />
    </I18nProvider>
  );
}

export default function App() {
  return <I18nRoot />;
}
