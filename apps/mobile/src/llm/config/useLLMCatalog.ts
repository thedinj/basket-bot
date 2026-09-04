/**
 * Fetches the model catalogue the backend serves.
 *
 * Deliberately a plain `useQuery`, not the `useSuspenseQuery` most data in the app uses: a
 * down backend, an expired session, or a build older than the endpoint must not blank the
 * Settings screen or block an AI action. Every consumer treats `null` as "use the bundled
 * fallbacks" (see `resolveProviderCatalog`), so failure degrades instead of breaking.
 *
 * Model names change on the order of months, so the catalogue is cached hard and refetched
 * lazily rather than being treated as live data.
 */

import { llmCatalogResponseSchema, type LLMCatalog } from "@basket-bot/core";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/db/queryKeys";
import { apiClient } from "../../lib/api/client";

/** Long enough that a session rarely refetches, short enough to pick up a redeploy. */
const CATALOG_STALE_TIME_MS = 60 * 60 * 1000;

const fetchLLMCatalog = async (): Promise<LLMCatalog> => {
    const response = await apiClient.get<unknown>("/api/llm/catalog");
    // Validated rather than trusted: an older app talking to a newer backend must fail
    // over to its fallbacks, not render half a catalogue.
    return llmCatalogResponseSchema.parse(response).catalog;
};

export interface UseLLMCatalogResult {
    /** `null` while loading, and whenever the catalogue could not be fetched. */
    catalog: LLMCatalog | null;
    /**
     * True only on the first fetch, with nothing cached to show. Settings uses it to skeleton
     * the model rows — the alternative is naming the bundled fallback for a moment and then
     * swapping it for the server's, which reads as the UI changing its mind.
     */
    isLoading: boolean;
}

export const useLLMCatalog = (): UseLLMCatalogResult => {
    const { data, isPending } = useQuery({
        queryKey: queryKeys.llmCatalog(),
        queryFn: fetchLLMCatalog,
        staleTime: CATALOG_STALE_TIME_MS,
        gcTime: CATALOG_STALE_TIME_MS,
        // The fallbacks make a failure survivable, so don't spend a long retry chain on it.
        retry: 1,
    });

    return { catalog: data ?? null, isLoading: isPending };
};
