import { useCallback, useMemo } from "react";
import { usePreference } from "./usePreference";

const SHOW_UNSURE_KEY = "filterUnsureItems";

export const useShowUnsureItems = () => {
    const { value, savePreference } = usePreference(SHOW_UNSURE_KEY);

    // Default to "false" (show the full list by default)
    const showUnsureOnly = value === "true";

    const toggleShowUnsureOnly = useCallback(async () => {
        await savePreference(showUnsureOnly ? "false" : "true");
    }, [showUnsureOnly, savePreference]);

    // Memoize return object to prevent unnecessary re-renders
    return useMemo(
        () => ({
            showUnsureOnly,
            toggleShowUnsureOnly,
        }),
        [showUnsureOnly, toggleShowUnsureOnly]
    );
};
