/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_UPDATER?: string;
  readonly VITE_LICENSE_SERVER_URL?: string;
  readonly VITE_LICENSE_RESPONSE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
