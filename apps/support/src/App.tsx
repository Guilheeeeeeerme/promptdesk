import { ChatPage } from './ChatPage';
import { LocaleProvider } from './locale';
import { useAuth } from './auth';

export default function App() {
  const { session } = useAuth();
  return <LocaleProvider initialLocale={session?.user.locale}><ChatPage /></LocaleProvider>;
}
