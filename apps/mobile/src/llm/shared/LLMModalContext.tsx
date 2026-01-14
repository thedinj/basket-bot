import React, { useState, type PropsWithChildren } from "react";
import { LLMModal } from "./LLMModal";
import {
    LLMModalContext,
    type LLMModalContextValue,
} from "./LLMModalContextDef";
import type { LLMModalConfig, LLMResponse } from "./types";

/**
 * Provider for LLM modal context
 */
export const LLMModalProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<LLMModalConfig | null>(null);
    const [response, setResponse] = useState<LLMResponse | null>(null);

    const openModal = <T = unknown,>(modalConfig: LLMModalConfig<T>) => {
        setConfig(modalConfig as LLMModalConfig);
        setResponse(null);
        setIsOpen(true);
    };

    const closeModal = () => {
        setIsOpen(false);
        setResponse(null);
        // Delay clearing config to allow exit animation
        setTimeout(() => setConfig(null), 300);
    };

    const value: LLMModalContextValue = {
        isOpen,
        config,
        openModal,
        closeModal,
        response,
        setResponse,
    };

    return (
        <LLMModalContext.Provider value={value}>
            {children}
            <LLMModal />
        </LLMModalContext.Provider>
    );
};
