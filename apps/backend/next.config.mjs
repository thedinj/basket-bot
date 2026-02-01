/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@basket-bot/core"],
    // Suppress webpack cache warnings in development
    webpack: (config, { dev, isServer }) => {
        if (dev && !isServer) {
            config.infrastructureLogging = {
                level: "error",
            };
        }
        return config;
    },
};

export default nextConfig;
