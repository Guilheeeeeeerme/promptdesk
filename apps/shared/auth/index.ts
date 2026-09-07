export const TOKEN_KEY = 'session_token';

/** The 10 most spoken languages in the world (by total speakers). */
export const SUPPORTED_LOCALES = [
  'en-US', // English
  'zh-CN', // Mandarin Chinese
  'hi-IN', // Hindi
  'es-ES', // Spanish
  'fr-FR', // French
  'ar-SA', // Arabic
  'bn-BD', // Bengali
  'pt-BR', // Portuguese
  'ru-RU', // Russian
  'ur-PK', // Urdu
] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en-US';

/** Native label for the language selector (shown untranslated). */
export const LOCALE_LABELS: Record<Locale, string> = {
  'en-US': 'English',
  'zh-CN': '简体中文',
  'hi-IN': 'हिन्दी',
  'es-ES': 'Español',
  'fr-FR': 'Français',
  'ar-SA': 'العربية',
  'bn-BD': 'বাংলা',
  'pt-BR': 'Português (Brasil)',
  'ru-RU': 'Русский',
  'ur-PK': 'اردو',
};

const LOCALE_LANGUAGE: Record<Locale, string> = {
  'en-US': 'en',
  'zh-CN': 'zh',
  'hi-IN': 'hi',
  'es-ES': 'es',
  'fr-FR': 'fr',
  'ar-SA': 'ar',
  'bn-BD': 'bn',
  'pt-BR': 'pt',
  'ru-RU': 'ru',
  'ur-PK': 'ur',
};

export function isLocale(value: unknown): value is Locale {
  return (SUPPORTED_LOCALES as readonly unknown[]).includes(value);
}

/** Writing direction per locale (Arabic and Urdu are right-to-left). */
export function localeDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar-SA' || locale === 'ur-PK' ? 'rtl' : 'ltr';
}

/**
 * Pick the first supported locale from `navigator.languages` (priority order).
 * Matches exact tags first (`pt-BR`), then the primary language subtag
 * (`pt-PT` → `pt-BR`, `es-MX` → `es-ES`); falls back to English.
 */
export function detectLocale(
  languages: readonly string[] =
    typeof navigator === 'undefined' ? [] : navigator.languages,
): Locale {
  for (const language of languages) {
    if (!language) continue;
    const tag = language.toLowerCase();
    const exact = SUPPORTED_LOCALES.find(
      (locale) => locale.toLowerCase() === tag,
    );
    if (exact) return exact;
    const primary = tag.split('-')[0];
    const partial = SUPPORTED_LOCALES.find(
      (locale) => LOCALE_LANGUAGE[locale] === primary,
    );
    if (partial) return partial;
  }
  return DEFAULT_LOCALE;
}

const PT_BR: Record<string, string> = {
  Home: 'Início', History: 'Histórico', Companies: 'Empresas', Users: 'Usuários',
  Chat: 'Chat', Company: 'Empresa', Menu: 'Menu', Close: 'Fechar', 'Log out': 'Sair',
  'AI Support Assistant': 'Assistente de Suporte com IA', Loading: 'Carregando',
  'Loading session…': 'Carregando sessão…', 'Signed in to the AI Support Assistant': 'Sessão iniciada no Assistente de Suporte com IA',
  User: 'Usuário', Role: 'Função', 'Active company': 'Empresa ativa', None: 'Nenhuma',
  'None selected': 'Nenhuma selecionada', 'No company': 'Nenhuma empresa',
  'New chat': 'Novo chat', Conversations: 'Conversas',
  'No messages in this conversation yet.': 'Ainda não há mensagens nesta conversa.',
  'Type a question to get started.': 'Digite uma pergunta para começar.',
  'All statuses': 'Todos os status', Open: 'Aberta', Solved: 'Resolvida',
  'Not solved': 'Não resolvida', "Won't solve": 'Não será resolvida',
  Reopen: 'Reabrir', Pin: 'Fixar', Unpin: 'Desafixar', Archive: 'Arquivar',
  Unarchive: 'Desarquivar', Delete: 'Excluir', Rate: 'Avaliar', clear: 'limpar',
  'Rate once the chat is solved / not solved': 'Avalie quando o chat for resolvido / não resolvido',
  'Rate this conversation': 'Avalie esta conversa', platform: 'plataforma',
  'Guidance bound': 'Orientação vinculada', 'No guidance bound': 'Nenhuma orientação vinculada',
  'Thinking…': 'Pensando…', Stop: 'Parar', 'Stopping…': 'Parando…',
  Retry: 'Tentar novamente', Stopped: 'Interrompida', Send: 'Enviar', 'Sending…': 'Enviando…',
  'This chat is marked as finished — reopen to continue': 'Este chat foi marcado como finalizado — reabra para continuar',
  'The assistant is thinking — send to redirect it': 'O assistente está pensando — envie para redirecioná-lo',
  'Type your question… (Shift+Enter for new line)': 'Digite sua pergunta… (Shift+Enter para nova linha)',
  'This conversation is solved — reopen to continue.': 'Esta conversa está resolvida — reabra para continuar.',
  'This conversation is not solved — reopen to continue.': 'Esta conversa não está resolvida — reabra para continuar.',
  "This conversation won't be solved — reopen to continue.": 'Esta conversa não será resolvida — reabra para continuar.',
  "The assistant couldn't finish this reply. You can retry, or ask a platform admin to step in manually.": 'O assistente não conseguiu concluir esta resposta. Você pode tentar novamente ou pedir a um administrador da plataforma para intervir manualmente.',
  'Close conversations menu': 'Fechar menu de conversas', 'Open conversations menu': 'Abrir menu de conversas',
  'Language': 'Idioma',
  'Sign in to continue': 'Entre para continuar', 'Sign in to your account': 'Entre na sua conta',
  Email: 'E-mail', Password: 'Senha', 'Sign in': 'Entrar', 'Signing in…': 'Entrando…',
  'Login failed': 'Falha no login', 'Invalid return URL': 'URL de retorno inválida',
  'Continuing…': 'Continuando…', 'Invalid email or password': 'E-mail ou senha inválidos',
  'Support Chat': 'Chat de Suporte', 'Recommend replies using your company guidelines': 'Recomende respostas usando as diretrizes da sua empresa',
  'Search chats…': 'Pesquisar conversas…', 'Pinned': 'Fixada', 'Archived': 'Arquivadas',
  'No conversations yet.': 'Nenhuma conversa ainda.', 'Untitled chat': 'Conversa sem título',
  'Main navigation': 'Navegação principal', 'Chat (opens in new tab)': 'Chat (abre em nova aba)',
  agent: 'agente', admin: 'administrador', manager: 'gerente', root: 'raiz',
  owner: 'proprietário',
  'Sign up': 'Criar conta', 'Registering…': 'Criando conta…',
  'Registration failed': 'Falha no cadastro',
  'This e-mail already belongs to an account.': 'Este e-mail já pertence a uma conta.',
  'Create a company account': 'Criar conta de empresa',
  'Company name': 'Nome da empresa',
  'Create your company account to get started': 'Crie a conta da sua empresa para começar',
  'Open navigation menu': 'Abrir menu de navegação',
  'Close navigation menu': 'Fechar menu de navegação',
  'Switch failed': 'Falha na troca',
  'This section is not available yet.': 'Esta seção ainda não está disponível.',
  'Add New Company': 'Adicionar nova empresa',
  'Add a new company and upload its support guidelines': 'Adicione uma nova empresa e envie suas diretrizes de suporte',
  'Company Name': 'Nome da empresa', 'Enter company name': 'Digite o nome da empresa',
  'Guidelines File': 'Arquivo de diretrizes', 'Upload a file': 'Enviar um arquivo',
  'or drag and drop': 'ou arraste e solte', 'TXT file up to 10MB': 'Arquivo TXT de até 10MB',
  'Selected: {name}': 'Selecionado: {name}',
  'Only .txt guideline files are supported': 'Apenas arquivos de diretrizes .txt são suportados',
  'Only .txt guideline files are supported.': 'Apenas arquivos de diretrizes .txt são suportados.',
  'Creating company…': 'Criando empresa…',
  'Company created. Its guideline is active and ready to use.': 'Empresa criada. Sua diretriz está ativa e pronta para uso.',
  'Company created successfully.': 'Empresa criada com sucesso.',
  'Failed to create company': 'Falha ao criar empresa',
  'Saving…': 'Salvando…', Cancel: 'Cancelar', Name: 'Nome', Edit: 'Editar',
  'Edit user': 'Editar usuário', 'Create user': 'Criar usuário',
  'Update account details or reset the password.': 'Atualize os detalhes da conta ou redefina a senha.',
  'Add a user to the active company.': 'Adicionar um usuário à empresa ativa.',
  'Password (optional)': 'Senha (opcional)', 'Save changes': 'Salvar alterações',
  'Add user': 'Adicionar usuário', 'No active company': 'Nenhuma empresa ativa',
  'Failed to load users': 'Falha ao carregar usuários',
  'No agent users are assigned to this company.': 'Nenhum usuário agente está atribuído a esta empresa.',
  'No users are assigned to this company.': 'Nenhum usuário está atribuído a esta empresa.',
  'Loading users…': 'Carregando usuários…',
  'Saving user changes…': 'Salvando alterações do usuário…', 'Creating user…': 'Criando usuário…',
  'User changes saved.': 'Alterações do usuário salvas.', 'User created successfully.': 'Usuário criado com sucesso.',
  'Unable to save user': 'Não foi possível salvar o usuário',
  'Unable to delete user': 'Não foi possível excluir o usuário',
  'Delete {name}? This cannot be undone.': 'Excluir {name}? Isso não pode ser desfeito.',
  'Deleting {name}…': 'Excluindo {name}…',
  '{name} was deleted.': '{name} foi excluído.',
  'Failed to load companies': 'Falha ao carregar empresas',
  'Joined {date}': 'Ingressou em {date}',
  'Manage users in {company}.': 'Gerencie usuários em {company}.',
  'Use the company switcher in the header to change tenant context. Open Chat to work in Support under the same session.': 'Use o seletor de empresas no cabeçalho para mudar o contexto de tenant. Abra o Chat para trabalhar no Suporte na mesma sessão.',
  'Your company is fixed for this account. Open Chat to continue in Support.': 'A empresa desta conta é fixa. Abra o Chat para continuar no Suporte.',
  'Invalid return URL for SSO': 'URL de retorno inválida para SSO',
  'AI': 'IA', 'Customer': 'Cliente', 'Support (human)': 'Suporte (humano)',
  'Chat History': 'Histórico de conversas',
  'Browse previous support interactions for {company}': 'Navegue pelas interações de suporte anteriores de {company}',
  'Search history': 'Pesquisar histórico', 'Search messages or titles…': 'Pesquisar mensagens ou títulos…',
  'Loading history…': 'Carregando histórico…',
  'No conversations for this company yet.': 'Ainda não há conversas para esta empresa.',
  'Detail': 'Detalhe', Pending: 'Pendente', 'Back to list': 'Voltar à lista',
  'Select a conversation to view the full transcript.': 'Selecione uma conversa para ver a transcrição completa.',
  'Loading detail…': 'Carregando detalhe…',
  'Title:': 'Título:', 'Agent:': 'Agente:', 'Company:': 'Empresa:', 'Status:': 'Status:',
  'Rating:': 'Avaliação:', 'Not rated yet': 'Ainda sem avaliação',
  'available once finished': 'disponível quando finalizada',
  'Last activity:': 'Última atividade:', 'Guideline snapshot:': 'Instantâneo da diretriz:',
  'No messages.': 'Nenhuma mensagem.',
  "Reopen the conversation to reply manually.": 'Reabra a conversa para responder manualmente.',
  "Reply as support human (visible to the agent's chat)": 'Responder como humano do suporte (visível no chat do agente)',
  'Type a manual reply… (Shift+Enter for new line)': 'Digite uma resposta manual… (Shift+Enter para nova linha)',
  'Send reply': 'Enviar resposta',
  'Failed to load history': 'Falha ao carregar histórico',
  'Failed to load conversation': 'Falha ao carregar conversa',
  'Saving conversation changes…': 'Salvando alterações da conversa…',
  'Conversation changes saved.': 'Alterações da conversa salvas.',
  'Update failed': 'Falha na atualização', 'Sending reply…': 'Enviando resposta…',
  'Reply sent.': 'Resposta enviada.', 'Reply failed': 'Falha na resposta',
  'Threads · {n}d': 'Conversas · {n}d', 'Resolution rate': 'Taxa de resolução',
  'Avg time to resolve': 'Tempo médio de resolução', 'Rating average': 'Avaliação média',
  "Still open: {n}": 'Ainda abertas: {n}',
  "{solved} solved · {not} not solved · {wont} won't solve": '{solved} resolvidas · {not} não resolvidas · {wont} não serão resolvidas',
  'first finish → open timestamp': 'primeira finalização → timestamp de abertura',
  '{n} conversations rated': '{n} conversas avaliadas',
  Never: 'Nunca', 'Pending validation': 'Validação pendente', 'Validating': 'Validando',
  Valid: 'Válida', Invalid: 'Inválida', 'Provider error': 'Erro do provedor',
  'Cancelled': 'Cancelada',
  'Failed to load guidelines': 'Falha ao carregar diretrizes', 'Failed to load version': 'Falha ao carregar versão',
  'Cancellation failed': 'Falha no cancelamento', 'Upload failed': 'Falha no upload', 'Clear failed': 'Falha ao limpar',
  'Cancelling guideline validation…': 'Cancelando validação da diretriz…',
  'Guideline validation cancelled. The active guideline was unchanged.': 'Validação da diretriz cancelada. A diretriz ativa permaneceu inalterada.',
  'Uploading guideline and starting validation…': 'Enviando diretriz e iniciando validação…',
  'Guideline uploaded successfully. It is pending validation; the current active guideline remains unchanged until validation passes.': 'Diretriz enviada com sucesso. Está com validação pendente; a diretriz ativa atual permanece inalterada até a validação passar.',
  'Clear guidelines for this company?': 'Limpar diretrizes desta empresa?',
  'Clearing active guideline…': 'Limpando diretriz ativa…',
  'Active guideline cleared. Version history was preserved.': 'Diretriz ativa limpa. O histórico de versões foi preservado.',
  'Guideline v{n} is being validated…': 'A diretriz v{n} está sendo validada…',
  'Guideline v{n} passed validation and is now active.': 'A diretriz v{n} passou na validação e agora está ativa.',
  'Guideline v{n} was rejected: {reason}': 'A diretriz v{n} foi rejeitada: {reason}',
  'Guideline v{n} could not be validated: {reason}': 'A diretriz v{n} não pôde ser validada: {reason}',
  'Guideline v{n} validation was cancelled.': 'A validação da diretriz v{n} foi cancelada.',
  'Loading companies…': 'Carregando empresas…',
  'Manage company information and guidelines': 'Gerencie informações e diretrizes das empresas',
  'Add Company': 'Adicionar empresa',
  'No companies available for your account.': 'Nenhuma empresa disponível para sua conta.',
  'No guidelines uploaded': 'Nenhuma diretriz enviada',
  View: 'Ver', 'Clear': 'Limpar',
  'Replace Guidelines': 'Substituir diretrizes', 'Upload Guidelines': 'Enviar diretrizes',
  'Loading…': 'Carregando…',
  'Version {n} · updated on ': 'Versão {n} · atualizada em ',
  'Guidelines last updated on ': 'Diretrizes atualizadas em ',
  'Latest valid: v{n}': 'Última válida: v{n}',
  '{n} support conversations': '{n} conversas de suporte',
  '{name} guidelines': 'diretrizes de {name}',
  'No file uploaded': 'Nenhum arquivo enviado',
  'active version {n}': 'versão ativa {n}',
  'Updated {when}': 'Atualizada em {when}',
  'Current & Replace': 'Atual e substituir',
  'Replacement v{n}': 'Substituição v{n}',
  'Current {v} remains active until validation succeeds.': 'A atual {v} permanece ativa até a validação ser bem-sucedida.',
  'Cancel pending': 'Cancelar pendente', 'Active:': 'Ativa:',
  'No validated guideline is active for this company.': 'Não há diretriz válida ativa para esta empresa.',
  'No guideline history.': 'Sem histórico de diretrizes.',
  'Uploaded {when}': 'Enviada em {when}', 'Processed {when}': 'Processada em {when}',
  'Version {n} snapshot': 'Snapshot da versão {n}', 'Created {when}': 'Criada em {when}',
  'Select a version to inspect its guideline context.': 'Selecione uma versão para inspecionar o contexto da diretriz.',
  "Couldn't update — try again.": 'Não foi possível atualizar — tente novamente.',
  'Delete this conversation?': 'Excluir esta conversa?',
  "Couldn't delete — try again.": 'Não foi possível excluir — tente novamente.',
  "Couldn't send — try again.": 'Não foi possível enviar — tente novamente.',
  "Couldn't stop — try again.": 'Não foi possível parar — tente novamente.',
  "Couldn't retry — try again.": 'Não foi possível tentar novamente — tente novamente.',
  'Already have an account?': 'Já tem uma conta?',
  'Need a company account?': 'Precisa de uma conta de empresa?',
};

const ZH_CN: Record<string, string> = {
  Home: '首页', History: '历史', Companies: '公司', Users: '用户',
  Chat: '聊天', Company: '公司', Menu: '菜单', Close: '关闭', 'Log out': '退出登录',
  'AI Support Assistant': 'AI 支持助手', Loading: '加载中',
  'Loading session…': '正在加载会话…', 'Signed in to the AI Support Assistant': '已登录 AI 支持助手',
  User: '用户', Role: '角色', 'Active company': '当前公司', None: '无',
  'None selected': '未选择', 'No company': '无公司',
  'New chat': '新聊天', Conversations: '对话',
  'No messages in this conversation yet.': '此对话中还没有消息。',
  'Type a question to get started.': '输入问题即可开始。',
  'All statuses': '全部状态', Open: '进行中', Solved: '已解决',
  'Not solved': '未解决', "Won't solve": '不予解决',
  Reopen: '重新打开', Pin: '置顶', Unpin: '取消置顶', Archive: '归档',
  Unarchive: '取消归档', Delete: '删除', Rate: '评分', clear: '清除',
  'Rate once the chat is solved / not solved': '聊天解决 / 未解决后可评分',
  'Rate this conversation': '为此对话评分', platform: '平台',
  'Guidance bound': '已绑定准则', 'No guidance bound': '未绑定准则',
  'Thinking…': '思考中…', Stop: '停止', 'Stopping…': '正在停止…',
  Retry: '重试', Stopped: '已停止', Send: '发送', 'Sending…': '发送中…',
  'This chat is marked as finished — reopen to continue': '此聊天已标记为结束 — 重新打开以继续',
  'The assistant is thinking — send to redirect it': '助手正在思考 — 发送以调整方向',
  'Type your question… (Shift+Enter for new line)': '输入您的问题…（Shift+Enter 换行）',
  'This conversation is solved — reopen to continue.': '此对话已解决 — 重新打开以继续。',
  'This conversation is not solved — reopen to continue.': '此对话未解决 — 重新打开以继续。',
  "This conversation won't be solved — reopen to continue.": '此对话将不予解决 — 重新打开以继续。',
  "The assistant couldn't finish this reply. You can retry, or ask a platform admin to step in manually.": '助手未能完成此回复。您可以重试，或请平台管理员手动处理。',
  'Close conversations menu': '关闭对话菜单', 'Open conversations menu': '打开对话菜单',
  'Language': '语言',
  'Sign in to continue': '登录以继续', 'Sign in to your account': '登录您的账户',
  Email: '邮箱', Password: '密码', 'Sign in': '登录', 'Signing in…': '登录中…',
  'Login failed': '登录失败', 'Invalid return URL': '无效的返回 URL',
  'Continuing…': '正在继续…', 'Invalid email or password': '邮箱或密码错误',
  'Support Chat': '支持聊天', 'Recommend replies using your company guidelines': '根据公司准则推荐回复',
  'Search chats…': '搜索聊天…', 'Pinned': '已置顶', 'Archived': '已归档',
  'No conversations yet.': '暂无对话。', 'Untitled chat': '未命名聊天',
  'Main navigation': '主导航', 'Chat (opens in new tab)': '聊天（在新标签页中打开）',
  agent: '客服', admin: '管理员', manager: '经理', root: '超级管理员',
};

const HI_IN: Record<string, string> = {
  Home: 'होम', History: 'इतिहास', Companies: 'कंपनियाँ', Users: 'उपयोगकर्ता',
  Chat: 'चैट', Company: 'कंपनी', Menu: 'मेनू', Close: 'बंद करें', 'Log out': 'लॉग आउट',
  'AI Support Assistant': 'एआई सपोर्ट असिस्टेंट', Loading: 'लोड हो रहा है',
  'Loading session…': 'सेशन लोड हो रहा है…', 'Signed in to the AI Support Assistant': 'एआई सपोर्ट असिस्टेंट में साइन इन किया',
  User: 'उपयोगकर्ता', Role: 'भूमिका', 'Active company': 'सक्रिय कंपनी', None: 'कोई नहीं',
  'None selected': 'कोई चयन नहीं', 'No company': 'कोई कंपनी नहीं',
  'New chat': 'नई चैट', Conversations: 'बातचीत',
  'No messages in this conversation yet.': 'इस बातचीत में अभी कोई संदेश नहीं।',
  'Type a question to get started.': 'शुरू करने के लिए एक प्रश्न लिखें।',
  'All statuses': 'सभी स्थितियाँ', Open: 'खुला', Solved: 'हल',
  'Not solved': 'अनसुलझा', "Won't solve": 'हल नहीं होगा',
  Reopen: 'पुनः खोलें', Pin: 'पिन करें', Unpin: 'अनपिन करें', Archive: 'संग्रहित करें',
  Unarchive: 'असंग्रहित करें', Delete: 'हटाएँ', Rate: 'रेटिंग दें', clear: 'साफ़ करें',
  'Rate once the chat is solved / not solved': 'चैट हल / अनसुलझा होने पर रेटिंग दें',
  'Rate this conversation': 'इस बातचीत की रेटिंग दें', platform: 'प्लेटफ़ॉर्म',
  'Guidance bound': 'दिशानिर्देश बंधित', 'No guidance bound': 'कोई दिशानिर्देश बंधित नहीं',
  'Thinking…': 'सोच रहा है…', Stop: 'रोकें', 'Stopping…': 'रोका जा रहा है…',
  Retry: 'पुनः प्रयास', Stopped: 'रोका गया', Send: 'भेजें', 'Sending…': 'भेजा जा रहा है…',
  'This chat is marked as finished — reopen to continue': 'यह चैट समाप्त चिह्नित है — जारी रखने के लिए पुनः खोलें',
  'The assistant is thinking — send to redirect it': 'सहायक सोच रहा है — उसे पुनर्निर्देशित करने के लिए भेजें',
  'Type your question… (Shift+Enter for new line)': 'अपना प्रश्न लिखें… (नई पंक्ति के लिए Shift+Enter)',
  'This conversation is solved — reopen to continue.': 'यह बातचीत हल हो गई है — जारी रखने के लिए पुनः खोलें।',
  'This conversation is not solved — reopen to continue.': 'यह बातचीत अनसुलझी है — जारी रखने के लिए पुनः खोलें।',
  "This conversation won't be solved — reopen to continue.": 'यह बातचीत हल नहीं होगी — जारी रखने के लिए पुनः खोलें।',
  "The assistant couldn't finish this reply. You can retry, or ask a platform admin to step in manually.": 'सहायक यह उत्तर पूरा नहीं कर सका। आप पुनः प्रयास कर सकते हैं या प्लेटफ़ॉर्म व्यवस्थापक से हस्तक्षेप का अनुरोध कर सकते हैं।',
  'Close conversations menu': 'बातचीत मेनू बंद करें', 'Open conversations menu': 'बातचीत मेनू खोलें',
  'Language': 'भाषा',
  'Sign in to continue': 'जारी रखने के लिए साइन इन करें', 'Sign in to your account': 'अपने खाते में साइन इन करें',
  Email: 'ईमेल', Password: 'पासवर्ड', 'Sign in': 'साइन इन', 'Signing in…': 'साइन इन हो रहा है…',
  'Login failed': 'लॉगिन विफल', 'Invalid return URL': 'अमान्य रिटर्न URL',
  'Continuing…': 'जारी रखा जा रहा है…', 'Invalid email or password': 'ईमेल या पासवर्ड गलत है',
  'Support Chat': 'सपोर्ट चैट', 'Recommend replies using your company guidelines': 'अपनी कंपनी के दिशानिर्देशों का उपयोग करके उत्तर सुझाएँ',
  'Search chats…': 'चैट खोजें…', 'Pinned': 'पिन किया गया', 'Archived': 'संग्रहीत',
  'No conversations yet.': 'अभी कोई बातचीत नहीं।', 'Untitled chat': 'शीर्षकहीन चैट',
  'Main navigation': 'मुख्य नेविगेशन', 'Chat (opens in new tab)': 'चैट (नए टैब में खुलता है)',
  agent: 'एजेंट', admin: 'व्यवस्थापक', manager: 'प्रबंधक', root: 'रूट',
};

const ES_ES: Record<string, string> = {
  Home: 'Inicio', History: 'Historial', Companies: 'Empresas', Users: 'Usuarios',
  Chat: 'Chat', Company: 'Empresa', Menu: 'Menú', Close: 'Cerrar', 'Log out': 'Cerrar sesión',
  'AI Support Assistant': 'Asistente de Soporte con IA', Loading: 'Cargando',
  'Loading session…': 'Cargando sesión…', 'Signed in to the AI Support Assistant': 'Sesión iniciada en el Asistente de Soporte con IA',
  User: 'Usuario', Role: 'Rol', 'Active company': 'Empresa activa', None: 'Ninguna',
  'None selected': 'Ninguna seleccionada', 'No company': 'Sin empresa',
  'New chat': 'Nuevo chat', Conversations: 'Conversaciones',
  'No messages in this conversation yet.': 'Aún no hay mensajes en esta conversación.',
  'Type a question to get started.': 'Escribe una pregunta para empezar.',
  'All statuses': 'Todos los estados', Open: 'Abierta', Solved: 'Resuelta',
  'Not solved': 'No resuelta', "Won't solve": 'No se resolverá',
  Reopen: 'Reabrir', Pin: 'Fijar', Unpin: 'Dejar de fijar', Archive: 'Archivar',
  Unarchive: 'Desarchivar', Delete: 'Eliminar', Rate: 'Valorar', clear: 'borrar',
  'Rate once the chat is solved / not solved': 'Valora cuando el chat esté resuelto / no resuelto',
  'Rate this conversation': 'Valora esta conversa', platform: 'plataforma',
  'Guidance bound': 'Guía vinculada', 'No guidance bound': 'Sin guía vinculada',
  'Thinking…': 'Pensando…', Stop: 'Detener', 'Stopping…': 'Deteniendo…',
  Retry: 'Reintentar', Stopped: 'Detenida', Send: 'Enviar', 'Sending…': 'Enviando…',
  'This chat is marked as finished — reopen to continue': 'Este chat está marcado como finalizado — reábrelo para continuar',
  'The assistant is thinking — send to redirect it': 'El asistente está pensando — envía para redirigirlo',
  'Type your question… (Shift+Enter for new line)': 'Escribe tu pregunta… (Shift+Enter para nueva línea)',
  'This conversation is solved — reopen to continue.': 'Esta conversación está resuelta — reábrela para continuar.',
  'This conversation is not solved — reopen to continue.': 'Esta conversación no está resuelta — reábrela para continuar.',
  "This conversation won't be solved — reopen to continue.": 'Esta conversación no se resolverá — reábrela para continuar.',
  "The assistant couldn't finish this reply. You can retry, or ask a platform admin to step in manually.": 'El asistente no pudo terminar esta respuesta. Puedes reintentarlo o pedir a un administrador de la plataforma que intervenga manualmente.',
  'Close conversations menu': 'Cerrar menú de conversaciones', 'Open conversations menu': 'Abrir menú de conversaciones',
  'Language': 'Idioma',
  'Sign in to continue': 'Inicia sesión para continuar', 'Sign in to your account': 'Inicia sesión en tu cuenta',
  Email: 'Correo electrónico', Password: 'Contraseña', 'Sign in': 'Iniciar sesión', 'Signing in…': 'Iniciando sesión…',
  'Login failed': 'Error al iniciar sesión', 'Invalid return URL': 'URL de retorno no válida',
  'Continuing…': 'Continuando…', 'Invalid email or password': 'Correo electrónico o contraseña incorrectos',
  'Support Chat': 'Chat de Soporte', 'Recommend replies using your company guidelines': 'Recomienda respuestas usando las directrices de tu empresa',
  'Search chats…': 'Buscar chats…', 'Pinned': 'Fijado', 'Archived': 'Archivado',
  'No conversations yet.': 'Aún no hay conversaciones.', 'Untitled chat': 'Chat sin título',
  'Main navigation': 'Navegación principal', 'Chat (opens in new tab)': 'Chat (se abre en una pestaña nueva)',
  agent: 'agente', admin: 'administrador', manager: 'gerente', root: 'raíz',
};

const FR_FR: Record<string, string> = {
  Home: 'Accueil', History: 'Historique', Companies: 'Entreprises', Users: 'Utilisateurs',
  Chat: 'Chat', Company: 'Entreprise', Menu: 'Menu', Close: 'Fermer', 'Log out': 'Se déconnecter',
  'AI Support Assistant': 'Assistant de Support IA', Loading: 'Chargement',
  'Loading session…': 'Chargement de la session…', 'Signed in to the AI Support Assistant': 'Connecté à l’Assistant de Support IA',
  User: 'Utilisateur', Role: 'Rôle', 'Active company': 'Entreprise active', None: 'Aucune',
  'None selected': 'Aucune sélectionnée', 'No company': 'Aucune entreprise',
  'New chat': 'Nouveau chat', Conversations: 'Conversations',
  'No messages in this conversation yet.': 'Aucun message dans cette conversation pour le moment.',
  'Type a question to get started.': 'Saisissez une question pour commencer.',
  'All statuses': 'Tous les statuts', Open: 'Ouverte', Solved: 'Résolue',
  'Not solved': 'Non résolue', "Won't solve": 'Ne sera pas résolue',
  Reopen: 'Rouvrir', Pin: 'Épingler', Unpin: 'Désépingler', Archive: 'Archiver',
  Unarchive: 'Désarchiver', Delete: 'Supprimer', Rate: 'Noter', clear: 'effacer',
  'Rate once the chat is solved / not solved': 'Notez lorsque le chat est résolu / non résolu',
  'Rate this conversation': 'Notez cette conversation', platform: 'plateforme',
  'Guidance bound': 'Directives liées', 'No guidance bound': 'Aucune directive liée',
  'Thinking…': 'Réflexion…', Stop: 'Arrêter', 'Stopping…': 'Arrêt…',
  Retry: 'Réessayer', Stopped: 'Arrêté', Send: 'Envoyer', 'Sending…': 'Envoi…',
  'This chat is marked as finished — reopen to continue': 'Ce chat est marqué comme terminé — rouvrez-le pour continuer',
  'The assistant is thinking — send to redirect it': 'L’assistant réfléchit — envoyez pour le rediriger',
  'Type your question… (Shift+Enter for new line)': 'Saisissez votre question… (Maj+Entrée pour un saut de ligne)',
  'This conversation is solved — reopen to continue.': 'Cette conversation est résolue — rouvrez-la pour continuer.',
  'This conversation is not solved — reopen to continue.': 'Cette conversation n’est pas résolue — rouvrez-la pour continuer.',
  "This conversation won't be solved — reopen to continue.": 'Cette conversation ne sera pas résolue — rouvrez-la pour continuer.',
  "The assistant couldn't finish this reply. You can retry, or ask a platform admin to step in manually.": 'L’assistant n’a pas pu terminer cette réponse. Vous pouvez réessayer ou demander à un administrateur de la plateforme d’intervenir manuellement.',
  'Close conversations menu': 'Fermer le menu des conversations', 'Open conversations menu': 'Ouvrir le menu des conversations',
  'Language': 'Langue',
  'Sign in to continue': 'Connectez-vous pour continuer', 'Sign in to your account': 'Connectez-vous à votre compte',
  Email: 'E-mail', Password: 'Mot de passe', 'Sign in': 'Se connecter', 'Signing in…': 'Connexion…',
  'Login failed': 'Échec de la connexion', 'Invalid return URL': 'URL de retour invalide',
  'Continuing…': 'Continuation…', 'Invalid email or password': 'E-mail ou mot de passe incorrect',
  'Support Chat': 'Chat de Support', 'Recommend replies using your company guidelines': 'Recommandez des réponses à partir des directives de votre entreprise',
  'Search chats…': 'Rechercher des chats…', 'Pinned': 'Épinglé', 'Archived': 'Archivé',
  'No conversations yet.': 'Aucune conversation pour le moment.', 'Untitled chat': 'Chat sans titre',
  'Main navigation': 'Navigation principale', 'Chat (opens in new tab)': 'Chat (ouvre dans un nouvel onglet)',
  agent: 'agent', admin: 'administrateur', manager: 'responsable', root: 'racine',
};

const AR_SA: Record<string, string> = {
  Home: 'الرئيسية', History: 'السجل', Companies: 'الشركات', Users: 'المستخدمون',
  Chat: 'محادثة', Company: 'الشركة', Menu: 'القائمة', Close: 'إغلاق', 'Log out': 'تسجيل الخروج',
  'AI Support Assistant': 'مساعد الدعم الذكي', Loading: 'جارٍ التحميل',
  'Loading session…': 'جارٍ تحميل الجلسة…', 'Signed in to the AI Support Assistant': 'تم تسجيل الدخول إلى مساعد الدعم الذكي',
  User: 'المستخدم', Role: 'الدور', 'Active company': 'الشركة النشطة', None: 'لا شيء',
  'None selected': 'لم يتم التحديد', 'No company': 'لا توجد شركة',
  'New chat': 'محادثة جديدة', Conversations: 'المحادثات',
  'No messages in this conversation yet.': 'لا توجد رسائل في هذه المحادثة بعد.',
  'Type a question to get started.': 'اكتب سؤالاً للبدء.',
  'All statuses': 'جميع الحالات', Open: 'مفتوحة', Solved: 'تم الحل',
  'Not solved': 'لم يتم الحل', "Won't solve": 'لن يتم الحل',
  Reopen: 'إعادة الفتح', Pin: 'تثبيت', Unpin: 'إلغاء التثبيت', Archive: 'أرشفة',
  Unarchive: 'إلغاء الأرشفة', Delete: 'حذف', Rate: 'تقييم', clear: 'مسح',
  'Rate once the chat is solved / not solved': 'قيّم بعد حل المحادثة أو عدم حله',
  'Rate this conversation': 'قيّم هذه المحادثة', platform: 'منصة',
  'Guidance bound': 'مرتبط بالإرشادات', 'No guidance bound': 'غير مرتبط بالإرشادات',
  'Thinking…': 'جارٍ التفكير…', Stop: 'إيقاف', 'Stopping…': 'جارٍ الإيقاف…',
  Retry: 'إعادة المحاولة', Stopped: 'تم الإيقاف', Send: 'إرسال', 'Sending…': 'جارٍ الإرسال…',
  'This chat is marked as finished — reopen to continue': 'تم وضع علامة انتهاء على هذه المحادثة — أعد فتحها للمتابعة',
  'The assistant is thinking — send to redirect it': 'المساعد يفكر — أرسل لإعادة توجيهه',
  'Type your question… (Shift+Enter for new line)': 'اكتب سؤالك… (Shift+Enter لسطر جديد)',
  'This conversation is solved — reopen to continue.': 'تم حل هذه المحادثة — أعد فتحها للمتابعة.',
  'This conversation is not solved — reopen to continue.': 'لم يتم حل هذه المحادثة — أعد فتحها للمتابعة.',
  "This conversation won't be solved — reopen to continue.": 'لن يتم حل هذه المحادثة — أعد فتحها للمتابعة.',
  "The assistant couldn't finish this reply. You can retry, or ask a platform admin to step in manually.": 'لم يتمكن المساعد من إكمال هذا الرد. يمكنك إعادة المحاولة أو مطالبة مسؤول المنصة بالتدخل يدويًا.',
  'Close conversations menu': 'إغلاق قائمة المحادثات', 'Open conversations menu': 'فتح قائمة المحادثات',
  'Language': 'اللغة',
  'Sign in to continue': 'سجّل الدخول للمتابعة', 'Sign in to your account': 'سجّل الدخول إلى حسابك',
  Email: 'البريد الإلكتروني', Password: 'كلمة المرور', 'Sign in': 'تسجيل الدخول', 'Signing in…': 'جارٍ تسجيل الدخول…',
  'Login failed': 'فشل تسجيل الدخول', 'Invalid return URL': 'عنوان URL للعودة غير صالح',
  'Continuing…': 'جارٍ المتابعة…', 'Invalid email or password': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  'Support Chat': 'محادثة الدعم', 'Recommend replies using your company guidelines': 'اقترح الردود باستخدام إرشادات شركتك',
  'Search chats…': 'ابحث في المحادثات…', 'Pinned': 'مثبت', 'Archived': 'مؤرشف',
  'No conversations yet.': 'لا توجد محادثات بعد.', 'Untitled chat': 'محادثة بدون عنوان',
  'Main navigation': 'التنقل الرئيسي', 'Chat (opens in new tab)': 'المحادثة (تُفتح في تبويب جديد)',
  agent: 'مندوب', admin: 'مدير النظام', manager: 'مدير', root: 'الجذر',
};

const BN_BD: Record<string, string> = {
  Home: 'হোম', History: 'ইতিহাস', Companies: 'কোম্পানিগুলো', Users: 'ব্যবহারকারীরা',
  Chat: 'চ্যাট', Company: 'কোম্পানি', Menu: 'মেনু', Close: 'বন্ধ করুন', 'Log out': 'লগ আউট',
  'AI Support Assistant': 'এআই সাপোর্ট সহকারী', Loading: 'লোড হচ্ছে',
  'Loading session…': 'সেশন লোড হচ্ছে…', 'Signed in to the AI Support Assistant': 'এআই সাপোর্ট সহকারীতে সাইন ইন করেছেন',
  User: 'ব্যবহারকারী', Role: 'ভূমিকা', 'Active company': 'সক্রিয় কোম্পানি', None: 'কিছু নেই',
  'None selected': 'কিছু নির্বাচিত নয়', 'No company': 'কোনো কোম্পানি নেই',
  'New chat': 'নতুন চ্যাট', Conversations: 'কথোপকথন',
  'No messages in this conversation yet.': 'এই কথোপকথনে এখনও কোনো বার্তা নেই।',
  'Type a question to get started.': 'শুরু করতে একটি প্রশ্ন লিখুন।',
  'All statuses': 'সব স্ট্যাটাস', Open: 'খোলা', Solved: 'সমাধান হয়েছে',
  'Not solved': 'সমাধান হয়নি', "Won't solve": 'সমাধান হবে না',
  Reopen: 'পুনরায় খুলুন', Pin: 'পিন করুন', Unpin: 'আনপিন করুন', Archive: 'আর্কাইভ করুন',
  Unarchive: 'আনআর্কাইভ করুন', Delete: 'মুছুন', Rate: 'রেটিং দিন', clear: 'বাতিল',
  'Rate once the chat is solved / not solved': 'চ্যাট সমাধান / অসমাধান হলে রেটিং দিন',
  'Rate this conversation': 'এই কথোপকথনের রেটিং দিন', platform: 'প্ল্যাটফর্ম',
  'Guidance bound': 'নির্দেশিকা যুক্ত', 'No guidance bound': 'কোনো নির্দেশিকা যুক্ত নেই',
  'Thinking…': 'ভাবছে…', Stop: 'থামান', 'Stopping…': 'থামানো হচ্ছে…',
  Retry: 'আবার চেষ্টা', Stopped: 'থামানো হয়েছে', Send: 'পাঠান', 'Sending…': 'পাঠানো হচ্ছে…',
  'This chat is marked as finished — reopen to continue': 'এই চ্যাট সমাপ্ত হিসেবে চিহ্নিত — চালিয়ে যেতে পুনরায় খুলুন',
  'The assistant is thinking — send to redirect it': 'সহকারী ভাবছে — পুনর্নির্দেশ করতে পাঠান',
  'Type your question… (Shift+Enter for new line)': 'আপনার প্রশ্ন লিখুন… (নতুন লাইনের জন্য Shift+Enter)',
  'This conversation is solved — reopen to continue.': 'এই কথোপকথনের সমাধান হয়েছে — চালিয়ে যেতে পুনরায় খুলুন।',
  'This conversation is not solved — reopen to continue.': 'এই কথোপকথনের সমাধান হয়নি — চালিয়ে যেতে পুনরায় খুলুন।',
  "This conversation won't be solved — reopen to continue.": 'এই কথোপকথনের সমাধান হবে না — চালিয়ে যেতে পুনরায় খুলুন।',
  "The assistant couldn't finish this reply. You can retry, or ask a platform admin to step in manually.": 'সহকারী এই উত্তরটি সম্পূর্ণ করতে পারেনি। আপনি আবার চেষ্টা করতে পারেন বা প্ল্যাটফর্ম প্রশাসককে হস্তক্ষেপ করতে বলতে পারেন।',
  'Close conversations menu': 'কথোপকথন মেনু বন্ধ করুন', 'Open conversations menu': 'কথোপকথন মেনু খুলুন',
  'Language': 'ভাষা',
  'Sign in to continue': 'চালিয়ে যেতে সাইন ইন করুন', 'Sign in to your account': 'আপনার অ্যাকাউন্টে সাইন ইন করুন',
  Email: 'ইমেইল', Password: 'পাসওয়ার্ড', 'Sign in': 'সাইন ইন', 'Signing in…': 'সাইন ইন হচ্ছে…',
  'Login failed': 'লগইন ব্যর্থ', 'Invalid return URL': 'অবৈধ রিটার্ন URL',
  'Continuing…': 'চালিয়ে যাওয়া হচ্ছে…', 'Invalid email or password': 'ইমেইল বা পাসওয়ার্ড ভুল',
  'Support Chat': 'সাপোর্ট চ্যাট', 'Recommend replies using your company guidelines': 'আপনার কোম্পানির নির্দেশিকা ব্যবহার করে উত্তর সুপারিশ করুন',
  'Search chats…': 'চ্যাট খুঁজুন…', 'Pinned': 'পিন করা', 'Archived': 'আর্কাইভ করা',
  'No conversations yet.': 'এখনও কোনো কথোপকথন নেই।', 'Untitled chat': 'শিরোনামহীন চ্যাট',
  'Main navigation': 'প্রধান নেভিগেশন', 'Chat (opens in new tab)': 'চ্যাট (নতুন ট্যাবে খোলে)',
  agent: 'এজেন্ট', admin: 'প্রশাসক', manager: 'ম্যানেজার', root: 'রুট',
};

const RU_RU: Record<string, string> = {
  Home: 'Главная', History: 'История', Companies: 'Компании', Users: 'Пользователи',
  Chat: 'Чат', Company: 'Компания', Menu: 'Меню', Close: 'Закрыть', 'Log out': 'Выйти',
  'AI Support Assistant': 'ИИ-ассистент поддержки', Loading: 'Загрузка',
  'Loading session…': 'Загрузка сессии…', 'Signed in to the AI Support Assistant': 'Вы вошли в ИИ-ассистент поддержки',
  User: 'Пользователь', Role: 'Роль', 'Active company': 'Активная компания', None: 'Нет',
  'None selected': 'Ничего не выбрано', 'No company': 'Без компании',
  'New chat': 'Новый чат', Conversations: 'Диалоги',
  'No messages in this conversation yet.': 'В этом диалоге пока нет сообщений.',
  'Type a question to get started.': 'Задайте вопрос, чтобы начать.',
  'All statuses': 'Все статусы', Open: 'Открыт', Solved: 'Решён',
  'Not solved': 'Не решён', "Won't solve": 'Не будет решён',
  Reopen: 'Переоткрыть', Pin: 'Закрепить', Unpin: 'Открепить', Archive: 'В архив',
  Unarchive: 'Из архива', Delete: 'Удалить', Rate: 'Оценить', clear: 'сбросить',
  'Rate once the chat is solved / not solved': 'Оцените, когда чат будет решён / не решён',
  'Rate this conversation': 'Оцените этот диалог', platform: 'платформа',
  'Guidance bound': 'Привязано к правилам', 'No guidance bound': 'Без привязки к правилам',
  'Thinking…': 'Думает…', Stop: 'Остановить', 'Stopping…': 'Остановка…',
  Retry: 'Повторить', Stopped: 'Остановлено', Send: 'Отправить', 'Sending…': 'Отправка…',
  'This chat is marked as finished — reopen to continue': 'Этот чат отмечен как завершённый — переоткройте его, чтобы продолжить',
  'The assistant is thinking — send to redirect it': 'Ассистент думает — отправьте, чтобы перенаправить его',
  'Type your question… (Shift+Enter for new line)': 'Введите ваш вопрос… (Shift+Enter — новая строка)',
  'This conversation is solved — reopen to continue.': 'Этот диалог решён — переоткройте его, чтобы продолжить.',
  'This conversation is not solved — reopen to continue.': 'Этот диалог не решён — переоткройте его, чтобы продолжить.',
  "This conversation won't be solved — reopen to continue.": 'Этот диалог не будет решён — переоткройте его, чтобы продолжить.',
  "The assistant couldn't finish this reply. You can retry, or ask a platform admin to step in manually.": 'Ассистент не смог завершить этот ответ. Вы можете повторить попытку или попросить администратора платформы вмешаться вручную.',
  'Close conversations menu': 'Закрыть меню диалогов', 'Open conversations menu': 'Открыть меню диалогов',
  'Language': 'Язык',
  'Sign in to continue': 'Войдите, чтобы продолжить', 'Sign in to your account': 'Войдите в свой аккаунт',
  Email: 'Эл. почта', Password: 'Пароль', 'Sign in': 'Войти', 'Signing in…': 'Вход…',
  'Login failed': 'Ошибка входа', 'Invalid return URL': 'Недопустимый URL возврата',
  'Continuing…': 'Продолжаем…', 'Invalid email or password': 'Неверная электронная почта или пароль',
  'Support Chat': 'Чат поддержки', 'Recommend replies using your company guidelines': 'Рекомендуйте ответы на основе правил вашей компании',
  'Search chats…': 'Поиск чатов…', 'Pinned': 'Закреплено', 'Archived': 'В архиве',
  'No conversations yet.': 'Диалогов пока нет.', 'Untitled chat': 'Чат без названия',
  'Main navigation': 'Основная навигация', 'Chat (opens in new tab)': 'Чат (открывается в новой вкладке)',
  agent: 'агент', admin: 'администратор', manager: 'менеджер', root: 'root',
};

const UR_PK: Record<string, string> = {
  Home: 'ہوم', History: 'تاریخ', Companies: 'کمپنیاں', Users: 'صارفین',
  Chat: 'چیٹ', Company: 'کمپنی', Menu: 'مینو', Close: 'بند کریں', 'Log out': 'لاگ آؤٹ',
  'AI Support Assistant': 'اے آئی سپورٹ اسسٹنٹ', Loading: 'لوڈ ہو رہا ہے',
  'Loading session…': 'سیشن لوڈ ہو رہا ہے…', 'Signed in to the AI Support Assistant': 'اے آئی سپورٹ اسسٹنٹ میں سائن ان کیا',
  User: 'صارف', Role: 'کردار', 'Active company': 'موجودہ کمپنی', None: 'کوئی نہیں',
  'None selected': 'کچھ منتخب نہیں', 'No company': 'کوئی کمپنی نہیں',
  'New chat': 'نئی چیٹ', Conversations: 'گفتگوئیں',
  'No messages in this conversation yet.': 'اس گفتگو میں ابھی کوئی پیغام نہیں۔',
  'Type a question to get started.': 'شروع کرنے کے لیے ایک سوال لکھیں۔',
  'All statuses': 'تمام حالتیں', Open: 'کھلی', Solved: 'حل شدہ',
  'Not solved': 'غیر حل شدہ', "Won't solve": 'حل نہیں ہوگی',
  Reopen: 'دوبارہ کھولیں', Pin: 'پن کریں', Unpin: 'ان پن کریں', Archive: 'آرکائیو کریں',
  Unarchive: 'ان آرکائیو کریں', Delete: 'حذف کریں', Rate: 'ریٹنگ دیں', clear: 'صاف کریں',
  'Rate once the chat is solved / not solved': 'چیٹ حل / غیر حل ہونے پر ریٹنگ دیں',
  'Rate this conversation': 'اس گفتگو کی ریٹنگ دیں', platform: 'پلیٹ فارم',
  'Guidance bound': 'ہدایات سے منسلک', 'No guidance bound': 'کوئی ہدایات منسلک نہیں',
  'Thinking…': 'سوچ رہا ہے…', Stop: 'روکیں', 'Stopping…': 'روکا جا رہا ہے…',
  Retry: 'دوبارہ کوشش', Stopped: 'روک دیا گیا', Send: 'بھیجیں', 'Sending…': 'بھیجا جا رہا ہے…',
  'This chat is marked as finished — reopen to continue': 'یہ چیٹ مکمل قرار دی گئی ہے — جاری رکھنے کے لیے دوبارہ کھولیں',
  'The assistant is thinking — send to redirect it': 'اسسٹنٹ سوچ رہا ہے — اسے دوبارہ ہدایت دینے کے لیے بھیجیں',
  'Type your question… (Shift+Enter for new line)': 'اپنا سوال لکھیں… (نئی لائن کے لیے Shift+Enter)',
  'This conversation is solved — reopen to continue.': 'یہ گفتگو حل ہو گئی ہے — جاری رکھنے کے لیے دوبارہ کھولیں۔',
  'This conversation is not solved — reopen to continue.': 'یہ گفتگو حل نہیں ہوئی — جاری رکھنے کے لیے دوبارہ کھولیں۔',
  "This conversation won't be solved — reopen to continue.": 'یہ گفتگو حل نہیں ہوگی — جاری رکھنے کے لیے دوبارہ کھولیں۔',
  "The assistant couldn't finish this reply. You can retry, or ask a platform admin to step in manually.": 'اسسٹنٹ یہ جواب مکمل نہیں کر سکا۔ آپ دوبارہ کوشش کر سکتے ہیں یا پلیٹ فارم منتظم سے مداخلت کی درخواست کر سکتے ہیں۔',
  'Close conversations menu': 'گفتگو مینو بند کریں', 'Open conversations menu': 'گفتگو مینو کھولیں',
  'Language': 'زبان',
  'Sign in to continue': 'جاری رکھنے کے لیے سائن ان کریں', 'Sign in to your account': 'اپنے اکاؤنٹ میں سائن ان کریں',
  Email: 'ای میل', Password: 'پاس ورڈ', 'Sign in': 'سائن ان', 'Signing in…': 'سائن ان ہو رہا ہے…',
  'Login failed': 'لاگ ان ناکام', 'Invalid return URL': 'غلط ریٹرن URL',
  'Continuing…': 'جاری ہے…', 'Invalid email or password': 'ای میل یا پاس ورڈ غلط ہے',
  'Support Chat': 'سپورٹ چیٹ', 'Recommend replies using your company guidelines': 'اپنی کمپنی کی ہدایات کے مطابق جوابات تجویز کریں',
  'Search chats…': 'چیٹس تلاش کریں…', 'Pinned': 'پن کیا گیا', 'Archived': 'آرکائیو شدہ',
  'No conversations yet.': 'ابھی کوئی گفتگو نہیں۔', 'Untitled chat': 'بے عنوان چیٹ',
  'Main navigation': 'مرکزی نیویگیشن', 'Chat (opens in new tab)': 'چیٹ (نئے ٹیب میں کھلتا ہے)',
  agent: 'ایجنٹ', admin: 'منتظم', manager: 'منیجر', root: 'روٹ',
};

const LOCALE_DICTIONARIES: Partial<Record<Locale, Record<string, string>>> = {
  'zh-CN': ZH_CN,
  'hi-IN': HI_IN,
  'es-ES': ES_ES,
  'fr-FR': FR_FR,
  'ar-SA': AR_SA,
  'bn-BD': BN_BD,
  'pt-BR': PT_BR,
  'ru-RU': RU_RU,
  'ur-PK': UR_PK,
};

export function translate(value: string, locale: Locale): string {
  return LOCALE_DICTIONARIES[locale]?.[value] ?? value;
}

export function formatLocaleDate(value: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  apiBase: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  // Let the browser set multipart boundary for FormData uploads.
  if (!headers.has('Content-Type') && options.body && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const base = apiBase.replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Login returns 401 with "Invalid email or password"; other routes mean
    // the session is gone. Always prefer the API message when present.
    let message = 'Unauthorized';
    try {
      const data = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(data.message)) {
        message = data.message.join(', ');
      } else if (typeof data.message === 'string' && data.message.trim()) {
        message = data.message;
      }
    } catch {
      // ignore parse errors
    }
    if (!path.includes('/auth/login')) {
      clearToken();
    }
    throw new ApiError(401, message);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(data.message)) {
        message = data.message.join(', ');
      } else if (data.message) {
        message = data.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export type Role = 'root' | 'admin' | 'owner' | 'manager' | 'agent';

export function isCompanyRole(role: Role): boolean {
  return role === 'owner' || role === 'manager' || role === 'agent';
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  locale?: Locale | null;
}

export interface SessionPayload {
  user: SessionUser;
  activeCompany: { id: string; name: string } | null;
}

export interface LoginResponse extends SessionPayload {
  token: string;
}

export function isPlatformRole(role: Role): boolean {
  return role === 'root' || role === 'admin';
}

export function getSession(apiBase: string): Promise<SessionPayload> {
  return apiFetch<SessionPayload>(apiBase, '/auth/me');
}

/** Build main-app login URL that returns to an MFE after SSO. */
export function buildLoginRedirectUrl(
  mainOrigin: string,
  returnUrl: string,
): string {
  const url = new URL('/login', mainOrigin.replace(/\/$/, ''));
  url.searchParams.set('returnUrl', returnUrl);
  return url.toString();
}

/**
 * Allowlist check for SSO return URLs.
 * Origins may be exact (`http://localhost:8081`) or listed as host:port.
 */
export function isAllowedReturnUrl(
  returnUrl: string,
  allowedOrigins: string[],
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(returnUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const origin = parsed.origin;
  return allowedOrigins.some((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return false;
    try {
      return new URL(trimmed).origin === origin;
    } catch {
      return trimmed === origin;
    }
  });
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Read token from `#token=` (preferred) or `?token=`, store it, clean the URL.
 * Returns the token if one was consumed.
 */
export function consumeTokenFromUrl(
  loc: Location = window.location,
): string | null {
  let token: string | null = null;

  if (loc.hash) {
    const hash = loc.hash.startsWith('#') ? loc.hash.slice(1) : loc.hash;
    const params = new URLSearchParams(hash);
    token = params.get('token');
    if (token) {
      params.delete('token');
      const nextHash = params.toString();
      const clean = `${loc.pathname}${loc.search}${nextHash ? `#${nextHash}` : ''}`;
      window.history.replaceState(null, '', clean);
    }
  }

  if (!token) {
    const params = new URLSearchParams(loc.search);
    token = params.get('token');
    if (token) {
      params.delete('token');
      const qs = params.toString();
      const clean = `${loc.pathname}${qs ? `?${qs}` : ''}${loc.hash}`;
      window.history.replaceState(null, '', clean);
    }
  }

  if (token) {
    setToken(token);
  }

  return token;
}

/** Append opaque session token to a return URL using the hash fragment. */
export function appendTokenToReturnUrl(returnUrl: string, token: string): string {
  const url = new URL(returnUrl);
  const hashParams = new URLSearchParams(
    url.hash.startsWith('#') ? url.hash.slice(1) : url.hash,
  );
  hashParams.set('token', token);
  url.hash = hashParams.toString();
  return url.toString();
}

/** Build silent SSO handoff URL on the main app (no login form if already signed in). */
export function buildSsoHandoffUrl(
  mainOrigin: string,
  returnUrl: string,
): string {
  const url = new URL('/sso/handoff', mainOrigin.replace(/\/$/, ''));
  url.searchParams.set('returnUrl', returnUrl);
  return url.toString();
}

export function redirectToLogin(mainOrigin: string, returnUrl?: string): void {
  const target = returnUrl ?? window.location.href;
  window.location.assign(buildLoginRedirectUrl(mainOrigin, target));
}

/** Re-sync MFE session from the main app’s current token (cross-origin localStorage). */
export function redirectToSsoHandoff(
  mainOrigin: string,
  returnUrl?: string,
): void {
  const target = (returnUrl ?? window.location.href).split('#')[0];
  window.location.assign(buildSsoHandoffUrl(mainOrigin, target));
}
