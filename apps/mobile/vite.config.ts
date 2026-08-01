import { execSync } from "child_process";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import packageJson from "./package.json";

function gitShortHash(): string {
    try {
        return execSync("git rev-parse --short HEAD").toString().trim();
    } catch {
        return "unknown";
    }
}

export default defineConfig({
    plugins: [react(), svgr()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 8100,
        host: "0.0.0.0", // Required for Android emulator to access via 10.0.2.2
        strictPort: true,
    },
    define: {
        // Stamped at build time (pnpm build / build:prod) so the About panel and
        // debug log can show exactly which build a user is running, without CI.
        "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
        "import.meta.env.VITE_GIT_HASH": JSON.stringify(gitShortHash()),
        "import.meta.env.VITE_BUILD_TIME": JSON.stringify(new Date().toISOString()),
    },
});
