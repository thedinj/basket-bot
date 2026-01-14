import React, { PropsWithChildren, use, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getDatabase, Database } from "./database";
import { DatabaseContext, type DatabaseContextValue } from "./context";

/**
 * Initialize database and return promise that resolves to it
 */
function initializeDatabase(): Promise<Database> {
    return getDatabase();
}

/**
 * Create QueryClient instance with default options
 */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 0, // Always refetch when component mounts
            gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
            retry: 1,
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
    // Use React 19's use() hook to unwrap the database initialization promise
    // This will automatically suspend while loading and throw errors to boundary
    const databasePromise = useRef(initializeDatabase());
    const database = use(databasePromise.current);

    // Subscribe to database changes and invalidate all queries
    useEffect(() => {
        const unsubscribe = database.onChange(() => {
            // Invalidate all queries when database changes
            queryClient.invalidateQueries();
        });

        return unsubscribe;
    }, [database]);

    const contextValue: DatabaseContextValue = {
        database,
    };

    return (
        <QueryClientProvider client={queryClient}>
            <DatabaseContext.Provider value={contextValue}>
                {children}
            </DatabaseContext.Provider>
        </QueryClientProvider>
    );
};
