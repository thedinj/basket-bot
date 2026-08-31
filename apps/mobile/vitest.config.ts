import { defineConfig } from "vitest/config";

// Node environment on purpose: these suites cover pure derivation logic, so they need neither
// jsdom nor Ionic's custom elements. Keep DOM-dependent concerns out of here rather than
// pulling in a browser-like environment for all tests.
export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
    resolve: {
        alias: {
            "@": new URL("./src", import.meta.url).pathname,
        },
    },
});
