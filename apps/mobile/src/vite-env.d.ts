/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SHOW_DATABASE_RESET?: string;
    // Add other env variables here as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
