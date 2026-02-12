import { useContext } from "react";
import { RefreshContext, RefreshContextValue } from "./RefreshContext";

/**
 * Hook to access the refresh context
 * Returns null if used outside of RefreshConfig (allows graceful handling)
 */
export const useRefreshContext = (): RefreshContextValue | null => {
    return useContext(RefreshContext);
};
