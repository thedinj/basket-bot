import { PropsWithChildren, useCallback, useMemo, useState } from "react";
import { AppHeaderContext } from "./AppHeaderContext";

export const AppHeaderProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const openSettings = useCallback(() => setIsSettingsOpen(true), []);
    const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

    const value = useMemo(
        () => ({
            isSettingsOpen,
            openSettings,
            closeSettings,
        }),
        [isSettingsOpen, openSettings, closeSettings]
    );

    return <AppHeaderContext.Provider value={value}>{children}</AppHeaderContext.Provider>;
};
