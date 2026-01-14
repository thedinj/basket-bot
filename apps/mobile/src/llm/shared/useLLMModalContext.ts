import { useContext } from "react";
import { LLMModalContext } from "./LLMModalContextDef";

/**
 * Hook to access LLM modal context
 */
export const useLLMModalContext = () => {
    const context = useContext(LLMModalContext);
    if (!context) {
        throw new Error(
            "useLLMModalContext must be used within LLMModalProvider"
        );
    }
    return context;
};
