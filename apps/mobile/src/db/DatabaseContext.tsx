import LoadingFallback from "@/components/LoadingFallback";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { PropsWithChildren, useEffect, useState } from "react";
import { DatabaseContext, type DatabaseContextValue } from "./context";
import { Database, getDatabase } from "./database";

/**
 * Loading fallback component
 */
/**
 * Create QueryClient instance with default options
 * Optimized for mobile with longer cache times and better retry logic
 * Exported for external access (e.g., mutation queue processing)
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 2 * 60 * 1000, // 2 minutes - reduce unnecessary refetches
            gcTime: 10 * 60 * 1000, // 10 minutes - keep cached data longer
            retry: (failureCount, error: unknown) => {
                // Don't retry on 4xx errors except 408 (timeout) and 429 (rate limit)
                const err = error as { status?: number };
                if (err?.status && err.status >= 400 && err.status < 500) {
                    if (err.status === 408 || err.status === 429) {
                        return failureCount < 3;
                    }
                    return false;
                }
                // Retry network errors and 5xx errors up to 3 times
                return failureCount < 3;
            },
            retryDelay: (attemptIndex) => {
                // Exponential backoff: 1s, 2s, 4s (capped at 30s)
                return Math.min(1000 * 2 ** attemptIndex, 30000);
            },
            refetchOnWindowFocus: false,
        },
    },
});

/**
 * Database provider component
 * Initializes database singleton, subscribes to onChange events,
 * and provides TanStack Query client for data fetching/caching
 */
export const DatabaseProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const [database, setDatabase] = useState<Database | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let cancelled = false;

        getDatabase()
            .then((db) => {
                if (!cancelled) {
                    setDatabase(db);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error("[DB] ❌ Database initialization failed:", err);
                    setError(err);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (error) {
        throw error;
    }

    if (!database) {
        return <LoadingFallback message="Initializing database..." />;
    }

    const contextValue: DatabaseContextValue = {
        database,
    };

    return (
        <QueryClientProvider client={queryClient}>
            <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
        </QueryClientProvider>
    );
};
