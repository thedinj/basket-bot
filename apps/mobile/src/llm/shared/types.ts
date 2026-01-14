/**
 * LLM Infrastructure Types
 */

/**
 * Attachment file for LLM requests
 */
export interface LLMAttachment {
    /** File name */
    name: string;
    /** File data as base64 string or File object */
    data: string | File;
    /** MIME type */
    mimeType: string;
}

/**
 * JSON response from LLM API
 */
export interface LLMResponse<T = unknown> {
    /** Parsed JSON data from LLM */
    data: T;
    /** Raw response text (JSON string) */
    raw: string;
}

/**
 * API client interface for making LLM calls
 */
export interface LLMApiClient {
    /**
     * Call the LLM API with a prompt and optional attachments
     * @param params - Request parameters
     * @returns Promise resolving to parsed JSON response
     */
    call<T = unknown>(params: {
        prompt: string;
        model: string;
        attachments?: LLMAttachment[];
        userText?: string;
    }): Promise<LLMResponse<T>>;
}

/**
 * Configuration for opening the LLM modal
 */
export interface LLMModalConfig<T = unknown> {
    /** The system prompt to send to the LLM (not shown to user) */
    prompt: string;
    /** User-facing instructions displayed in the modal */
    userInstructions?: string;
    /** The model to use (e.g., "gpt-4o-mini") */
    model?: string;
    /** Custom render function for the LLM output */
    renderOutput: (response: LLMResponse<T>) => React.ReactNode;
    /** Callback when user accepts the result */
    onAccept: (response: LLMResponse<T>) => void;
    /** Optional callback when user cancels */
    onCancel?: () => void;
    /** Optional validation function for LLM response. Return true if valid, false otherwise. */
    validateResponse?: (response: LLMResponse<T>) => boolean;
    /** Modal title */
    title?: string;
    /** Text for the Run button (default: "Run LLM") */
    buttonText?: string;
    /** Show "This might take a while" patience message during processing */
    showPatienceMessage?: boolean;
}
