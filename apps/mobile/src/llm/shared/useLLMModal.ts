import { useLLMModalContext } from "./useLLMModalContext";

/**
 * Hook for accessing LLM modal functionality
 * @returns Object with openModal and closeModal methods
 */
export const useLLMModal = () => {
    const { openModal, closeModal } = useLLMModalContext();

    return {
        openModal,
        closeModal,
    };
};
