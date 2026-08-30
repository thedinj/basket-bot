import { useCallback, useMemo } from "react";
import { usePreference } from "./usePreference";

const AISLE_SORT_MODE_KEY = "aisleSortMode";
export type AisleSortMode = "alphabetical" | "storeOrder";

export const useAisleSortMode = () => {
    const { value, savePreference } = usePreference(AISLE_SORT_MODE_KEY);

    // Default to "alphabetical" (existing behavior) until a user opts into store order
    const sortMode: AisleSortMode = value === "storeOrder" ? "storeOrder" : "alphabetical";

    const setSortMode = useCallback(
        async (mode: AisleSortMode) => {
            await savePreference(mode);
        },
        [savePreference]
    );

    return useMemo(() => ({ sortMode, setSortMode }), [sortMode, setSortMode]);
};
