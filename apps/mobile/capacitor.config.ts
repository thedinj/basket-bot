import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "com.basketbot.app",
    appName: "Basket Bot",
    webDir: "dist",
    server: {
        androidScheme: "https",
        // Dev mode: load from Vite dev server for live reload
        ...(process.env.CAP_DEV_SERVER === "true" && {
            url: "http://10.0.2.2:8100",
            cleartext: true,
        }),
    },
};

export default config;
