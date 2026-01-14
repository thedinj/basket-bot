import { createContext } from "react";

export interface PageMenuItemConfig {
    id: string;
    icon: string;
    label: React.ReactNode;
    onClick: () => void;
    color?: string;
    disabled?: boolean;
}

export interface AppHeaderContextValue {
    isSettingsOpen: boolean;
    openSettings: () => void;
    closeSettings: () => void;
}

export const AppHeaderContext = createContext<
    AppHeaderContextValue | undefined
>(undefined);
