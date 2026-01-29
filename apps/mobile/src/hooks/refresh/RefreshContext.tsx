import { createContext } from "react";

export interface RefreshContextValue {
    /** Whether a refresh is currently in progress */
    isRefreshing: boolean;
    /** The query keys being refreshed, or null if refreshing all queries */
    refreshQueryKeys: string[][] | null;
    /** The configured query keys for the current page/context */
    configuredQueryKeys: string[][] | null;
    /** Set the configured query keys for the current page/context */
    setConfiguredQueryKeys: (queryKeys: string[][] | null) => void;
    /** Trigger a manual refresh */
    refresh: (queryKeys?: string[][]) => Promise<void>;
}

export const RefreshContext = createContext<RefreshContextValue | null>(null);
