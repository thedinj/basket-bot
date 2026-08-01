/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
    //readonly VITE_SHOW_DATABASE_RESET?: string;
    /** App version from package.json, stamped at build time (see vite.config.ts) */
    readonly VITE_APP_VERSION: string;
    /** Short git commit hash, stamped at build time (see vite.config.ts) */
    readonly VITE_GIT_HASH: string;
    /** ISO build timestamp, stamped at build time (see vite.config.ts) */
    readonly VITE_BUILD_TIME: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
