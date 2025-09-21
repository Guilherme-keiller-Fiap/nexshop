/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_IDENTITY_ENDPOINT: string;
    readonly VITE_IDENTITY_API_KEY: string;
    }

    interface ImportMeta {
    readonly env: ImportMetaEnv;
}
