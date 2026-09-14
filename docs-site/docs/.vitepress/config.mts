import { defineConfig } from 'vitepress'

function sidebarEn() {
  return [
    {
      text: 'Overview',
      items: [{ text: 'Ecosystem', link: '/en/' }],
    },
    {
      text: 'Standards',
      items: [
        { text: 'Guardrails', link: '/en/standards/guardrails' },
        { text: 'Model ladder & budgets', link: '/en/standards/model-ladder-and-budgets' },
        { text: 'Observability', link: '/en/standards/observability' },
      ],
    },
    {
      text: 'PromptDesk',
      items: [
        { text: 'Architecture', link: '/en/promptdesk/architecture' },
        { text: 'Copilot flow', link: '/en/promptdesk/copilot-flow' },
        { text: 'Guidelines', link: '/en/promptdesk/guidelines' },
        { text: 'Model ladder', link: '/en/promptdesk/model-ladder' },
        { text: 'Failure & limits', link: '/en/promptdesk/failure-and-limits' },
        { text: 'Known gaps', link: '/en/promptdesk/known-gaps' },
      ],
    },
    {
      text: 'Quizzeira',
      items: [
        { text: 'Architecture', link: '/en/quizzeira/architecture' },
        { text: 'Ingestion', link: '/en/quizzeira/ingestion' },
        { text: 'Content generation', link: '/en/quizzeira/content-generation' },
        { text: 'Eval gate', link: '/en/quizzeira/eval-gate' },
        { text: 'Sampling & study', link: '/en/quizzeira/sampling-and-study' },
        { text: 'Embeddings & retrieval', link: '/en/quizzeira/embeddings-and-retrieval' },
        { text: 'Known gaps', link: '/en/quizzeira/known-gaps' },
      ],
    },
    {
      text: 'Argus',
      items: [
        { text: 'Architecture', link: '/en/argus/architecture' },
        { text: 'Vision pipeline', link: '/en/argus/vision-pipeline' },
        { text: 'Prompt-eval & VLM', link: '/en/argus/prompt-eval-and-vlm' },
        { text: 'HITL triage', link: '/en/argus/hitl-triage' },
        { text: 'RAG & feedback', link: '/en/argus/rag-and-feedback' },
        { text: 'Known gaps', link: '/en/argus/known-gaps' },
      ],
    },
    {
      text: 'Reference',
      items: [
        { text: 'Comparison matrix', link: '/en/reference/comparison-matrix' },
        { text: 'Defaults cheatsheet', link: '/en/reference/defaults-cheatsheet' },
        { text: 'Status legend', link: '/en/reference/status-legend' },
        { text: 'Not in scope', link: '/en/reference/not-in-scope' },
      ],
    },
  ]
}

function sidebarPt() {
  return [
    {
      text: 'Visão geral',
      items: [{ text: 'Ecossistema', link: '/pt/' }],
    },
    {
      text: 'Padrões',
      items: [
        { text: 'Guardrails', link: '/pt/standards/guardrails' },
        { text: 'Ladder e orçamentos', link: '/pt/standards/model-ladder-and-budgets' },
        { text: 'Observabilidade', link: '/pt/standards/observability' },
      ],
    },
    {
      text: 'PromptDesk',
      items: [
        { text: 'Arquitetura', link: '/pt/promptdesk/architecture' },
        { text: 'Lacunas conhecidas', link: '/pt/promptdesk/known-gaps' },
      ],
    },
    {
      text: 'Quizzeira',
      items: [
        { text: 'Arquitetura', link: '/pt/quizzeira/architecture' },
        { text: 'Lacunas conhecidas', link: '/pt/quizzeira/known-gaps' },
      ],
    },
    {
      text: 'Argus',
      items: [
        { text: 'Arquitetura', link: '/pt/argus/architecture' },
        { text: 'Lacunas conhecidas', link: '/pt/argus/known-gaps' },
      ],
    },
    {
      text: 'Referência',
      items: [
        { text: 'Matriz comparativa', link: '/pt/reference/comparison-matrix' },
        { text: 'Legenda de status', link: '/pt/reference/status-legend' },
      ],
    },
  ]
}

export default defineConfig({
  base: '/promptdesk/',
  title: 'Ferre Ecosystem',
  description:
    'Technical architecture docs for PromptDesk, Quizzeira, and Argus — audit-backed, status-tagged.',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
  },
  locales: {
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Overview', link: '/en/' },
          { text: 'Standards', link: '/en/standards/guardrails' },
          { text: 'PromptDesk', link: '/en/promptdesk/architecture' },
          { text: 'Quizzeira', link: '/en/quizzeira/architecture' },
          { text: 'Argus', link: '/en/argus/architecture' },
          { text: 'Reference', link: '/en/reference/comparison-matrix' },
        ],
        sidebar: sidebarEn(),
        outline: { level: [2, 3] },
      },
    },
    pt: {
      label: 'Português',
      lang: 'pt-BR',
      link: '/pt/',
      themeConfig: {
        nav: [
          { text: 'Visão geral', link: '/pt/' },
          { text: 'Padrões', link: '/pt/standards/guardrails' },
          { text: 'PromptDesk', link: '/pt/promptdesk/architecture' },
          { text: 'Quizzeira', link: '/pt/quizzeira/architecture' },
          { text: 'Argus', link: '/pt/argus/architecture' },
          { text: 'Referência', link: '/pt/reference/comparison-matrix' },
        ],
        sidebar: sidebarPt(),
        outline: { level: [2, 3] },
        darkModeSwitchLabel: 'Tema',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Voltar ao topo',
        docFooter: { prev: 'Anterior', next: 'Próximo' },
      },
    },
  },
  themeConfig: {
    siteTitle: 'Ferre Ecosystem',
    logo: '/icons/promptdesk.svg',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Guilheeeeeeerme/promptdesk' },
    ],
    search: { provider: 'local' },
  },
})
