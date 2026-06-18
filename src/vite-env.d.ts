/// <reference types="vite/client" />
/// <reference types="web-bluetooth" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_ICU_KEY?: string
  readonly VITE_ICU_ATHLETE?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
