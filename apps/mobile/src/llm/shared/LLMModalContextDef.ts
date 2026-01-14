import { createContext } from "react";
import type { LLMModalConfig, LLMResponse } from "./types";

/**
 * Context value for LLM modal management
 */
export interface LLMModalContextValue {
    /** Whether the modal is currently open */
    isOpen: boolean;
    /** Current modal configuration */
    config: LLMModalConfig | null;
    /** Open the modal with given configuration */
    openModal: <T = unknown>(config: LLMModalConfig<T>) => void;
    /** Close the modal */
    closeModal: () => void;
    /** Current LLM response (if any) */
    response: LLMResponse | null;
    /** Set the LLM response */
    setResponse: (response: LLMResponse | null) => void;
}

/**
 * Context for managing LLM modal state
 */
export const LLMModalContext = createContext<LLMModalContextValue | undefined>(
    undefined
);
