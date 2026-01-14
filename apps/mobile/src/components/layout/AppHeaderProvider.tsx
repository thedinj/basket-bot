import { useState, useCallback } from "react";
import { AppHeaderContext } from "./AppHeaderContext";

export const AppHeaderProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const openSettings = useCallback(() => setIsSettingsOpen(true), []);
    const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

    const value = {
        isSettingsOpen,
        openSettings,
        closeSettings,
    };

    return (
        <AppHeaderContext.Provider value={value}>
            {children}
        </AppHeaderContext.Provider>
    );
};
