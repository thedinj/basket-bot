import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { useRefreshContext } from "./useRefreshContext";

interface RefreshConfigProps {
    /** Query keys to use for refresh operations in this context */
    queryKeys?: string[][];
}

/**
 * Wrapper component that configures refresh query keys for its children
 * Use this to wrap page content that supports refresh operations
 *
 * @example
 * <RefreshConfig queryKeys={[["stores"]]}>
 *   <StoresListContent />
 * </RefreshConfig>
 */
const RefreshConfig: React.FC<PropsWithChildren<RefreshConfigProps>> = ({
    queryKeys,
    children,
}) => {
    const { setConfiguredQueryKeys } = useRefreshContext();

    useEffect(() => {
        setConfiguredQueryKeys(queryKeys || null);

        // Clean up on unmount
        return () => {
            setConfiguredQueryKeys(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(queryKeys)]);

    return <>{children}</>;
};

export default RefreshConfig;
