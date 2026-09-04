import { defineConfig } from "vitest/config";

// Backend suites run against a real SQLite schema built in memory by `test/setup/inMemoryDb.ts`.
// `pool: "forks"` because better-sqlite3 is a native addon and each file holds its own
// `:memory:` handle — a fresh process per file also gives us a fresh schema for free.
export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        pool: "forks",
        setupFiles: ["./test/setup/inMemoryDb.ts"],
        include: ["src/**/*.test.ts", "test/**/*.test.ts"],
        env: {
            NODE_ENV: "test",
            JWT_SECRET: "test-secret",
        },
    },
    resolve: {
        alias: {
            "@": new URL("./src", import.meta.url).pathname,
        },
    },
});
