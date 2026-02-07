import { createContext } from "react";
import type { ToastType } from "../../hooks/useToast";

export interface PageMenuItemConfig {
    id: string;
    icon: string;
    label: React.ReactNode;
    onClick: () => void;
    color?: string;
    disabled?: boolean;
}

export interface MessageGeneratorResult {
    message: string;
    type?: ToastType;
}

export type MessageGenerator = () => MessageGeneratorResult | null | undefined;

export interface GlobalActionConfig {
    id: string;
    icon?: string;
    customIcon?: React.ReactNode;
    title: string;
    ariaLabel: string;
    onClick: () => void;
    color?: string;
    disabled?: boolean;
    messageGenerator?: MessageGenerator;
}

export interface AppHeaderContextValue {
    isSettingsOpen: boolean;
    openSettings: () => void;
    closeSettings: () => void;
    isProfileOpen: boolean;
    openProfile: () => void;
    closeProfile: () => void;
    isPasswordOpen: boolean;
    openPassword: () => void;
    closePassword: () => void;
    isHouseholdsOpen: boolean;
    openHouseholds: () => void;
    closeHouseholds: () => void;
}

export const AppHeaderContext = createContext<AppHeaderContextValue | undefined>(undefined);
