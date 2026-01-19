import { useCallback, useMemo } from "react";
import { usePreference } from "./usePreference";

const SHOW_SNOOZED_KEY = "showSnoozedItems";

export const useShowSnoozedItems = () => {
    const { value, savePreference } = usePreference(SHOW_SNOOZED_KEY);

    // Default to "false" (hide snoozed items by default)
    const showSnoozed = value === "true";

    const toggleShowSnoozed = useCallback(async () => {
        await savePreference(showSnoozed ? "false" : "true");
    }, [showSnoozed, savePreference]);

    // Memoize return object to prevent unnecessary re-renders
    return useMemo(
        () => ({
            showSnoozed,
            toggleShowSnoozed,
        }),
        [showSnoozed, toggleShowSnoozed]
    );
};
