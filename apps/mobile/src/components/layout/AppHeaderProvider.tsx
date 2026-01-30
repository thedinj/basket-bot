import { PropsWithChildren, useCallback, useMemo, useState } from "react";
import { AppHeaderContext } from "./AppHeaderContext";

export const AppHeaderProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isPasswordOpen, setIsPasswordOpen] = useState(false);

    const openSettings = useCallback(() => setIsSettingsOpen(true), []);
    const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

    const openProfile = useCallback(() => setIsProfileOpen(true), []);
    const closeProfile = useCallback(() => setIsProfileOpen(false), []);

    const openPassword = useCallback(() => setIsPasswordOpen(true), []);
    const closePassword = useCallback(() => setIsPasswordOpen(false), []);

    const value = useMemo(
        () => ({
            isSettingsOpen,
            openSettings,
            closeSettings,
            isProfileOpen,
            openProfile,
            closeProfile,
            isPasswordOpen,
            openPassword,
            closePassword,
        }),
        [
            isSettingsOpen,
            openSettings,
            closeSettings,
            isProfileOpen,
            openProfile,
            closeProfile,
            isPasswordOpen,
            openPassword,
            closePassword,
        ]
    );

    return <AppHeaderContext.Provider value={value}>{children}</AppHeaderContext.Provider>;
};
