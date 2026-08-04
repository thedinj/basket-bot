import { createContext } from "react";

/**
 * A cache key as produced by the `queryKeys` factory. Elements are `unknown` rather than
 * `string` because household-scoped keys carry a `string | null` id (the household is null
 * while it loads), and this matches TanStack's own `QueryKey`.
 */
export type RefreshQueryKey = unknown[];

export interface RefreshContextValue {
    /** Whether a refresh is currently in progress */
    isRefreshing: boolean;
    /** The query keys being refreshed, or null if refreshing all queries */
    refreshQueryKeys: RefreshQueryKey[] | null;
    /** The configured query keys for the current page/context */
    configuredQueryKeys: RefreshQueryKey[] | null;
    /** Set the configured query keys for the current page/context */
    setConfiguredQueryKeys: (queryKeys: RefreshQueryKey[] | null) => void;
    /** Trigger a manual refresh */
    refresh: (queryKeys?: RefreshQueryKey[]) => Promise<void>;
}

export const RefreshContext = createContext<RefreshContextValue | null>(null);
