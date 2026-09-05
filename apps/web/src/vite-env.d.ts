/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPPORT_ORIGIN?: string;
  readonly VITE_SSO_RETURN_ORIGINS?: string;
  readonly VITE_MAIN_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
