import { useContext } from "react";
import { RefreshContext } from "./RefreshContext";

/**
 * Hook to access the shared refresh context
 * Throws if used outside of RefreshProvider
 */
export const useRefreshContext = () => {
    const context = useContext(RefreshContext);

    if (!context) {
        throw new Error("useRefreshContext must be used within RefreshProvider");
    }

    return context;
};
