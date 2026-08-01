import LoadingFallback from "@/components/LoadingFallback";
import { ApiError } from "@/lib/api/client";
import { clientErrorLog } from "@/lib/clientErrorLog";
import { showImperativeToast } from "@/lib/imperativeToast";
import { formatErrorMessage, isErrorHandled, shouldQueueError } from "@/utils/errorUtils";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
 *
 * All mutation errors are handled centrally here (MutationCache.onError) rather
 * than per-hook, so no mutation can silently fail to show feedback and no
 * mutation can double-toast by also defining its own onError.
 */
export const queryClient = new QueryClient({
    mutationCache: new MutationCache({
        onError: (error, _variables, _context, mutation) => {
            const operation = mutation.options.meta?.operation as string | undefined;
            const endpoint = error instanceof ApiError ? error.endpoint : undefined;

            // Mutations that already gave the user specific feedback (an inline form
            // error, a silent cache refresh after a 404) mark the error handled so we
            // don't also show a generic toast for the same failure.
            if (!isErrorHandled(error)) {
                if (shouldQueueError(error)) {
                    showImperativeToast(
                        "No connection. This change will sync automatically once reconnected.",
                        "warning"
                    );
                } else {
                    showImperativeToast(formatErrorMessage(error, operation), "error");
                }
            }

            clientErrorLog.record({
                operation,
                endpoint,
                message: error instanceof Error ? error.message : String(error),
                code: error instanceof ApiError ? error.code : undefined,
                status: error instanceof ApiError ? error.status : undefined,
                requestId: error instanceof ApiError ? error.requestId : undefined,
            });
        },
    }),
    defaultOptions: {
        queries: {
            staleTime: 2 * 60 * 1000, // 2 minutes - reduce unnecessary refetches
            gcTime: 10 * 60 * 1000, // 10 minutes - keep cached data longer
            retry: (failureCount, error: unknown) => {
                // Don't retry on 4xx errors except 408 (timeout) and 429 (rate limit)
                const err = error instanceof ApiError ? error : undefined;
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
