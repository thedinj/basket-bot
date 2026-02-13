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
    customIconSrc?: string;
    title: string;
    ariaLabel: string;
    onClick: () => void;
    color?: string;
    disabled?: boolean;
    messageGenerator?: MessageGenerator;
}

export type ModalName = "settings" | "profile" | "password" | "households" | "stores";

export interface AppHeaderContextValue {
    currentModal: ModalName | null;
    openModal: (name: ModalName) => void;
    closeModal: () => void;
    isModalOpen: (name: ModalName) => boolean;
}

export const AppHeaderContext = createContext<AppHeaderContextValue | undefined>(undefined);
