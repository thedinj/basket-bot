/**
 * LLM Infrastructure Types
 */

import type { z } from "zod";
import type { LLMTier } from "../providers/types";

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
 * Configuration for opening the LLM modal.
 *
 * @typeParam T - Shape of the parsed LLM JSON response (immutable after the API call).
 * @typeParam S - Optional interaction state that the modal manages on behalf of the caller
 *               (e.g. `Set<number>` for checked/unchecked rows). Defaults to `void`, meaning
 *               no interaction state is needed. When `S` is not `void`, you must provide
 *               `initialState` to seed the state from the LLM response.
 *
 * @example Non-interactive (existing callers — no changes needed)
 * ```ts
 * openModal<StoreScanResult>({ ..., renderOutput: (r) => <Preview data={r.data} /> })
 * ```
 *
 * @example Interactive with selection state
 * ```ts
 * openModal<BulkImportResponse, Set<number>>({
 *     initialState: () => new Set(),
 *     renderOutput: (r, unchecked, setUnchecked) => (
 *         <ItemList items={r.data.items} uncheckedIds={unchecked}
 *             onToggle={(id, checked) => setUnchecked(prev => {
 *                 const next = new Set(prev);
 *                 checked ? next.delete(id) : next.add(id);
 *                 return next;
 *             })}
 *         />
 *     ),
 *     onAccept: (r, unchecked) => importItems(r.data.items.filter((_, i) => !unchecked.has(i))),
 * })
 * ```
 */
export interface LLMModalConfig<T = unknown, S = void> {
    /** The system prompt to send to the LLM (not shown to user) */
    prompt: string;
    /** User-facing instructions displayed in the modal */
    userInstructions?: string;
    /**
     * The capability this feature needs. Never a model name — the concrete model comes
     * from the user's provider configuration, and a request with an attachment is
     * upgraded to the `vision` tier automatically.
     */
    tier: LLMTier;
    /** Validates the response and types `renderOutput` / `onAccept`. */
    schema: z.ZodType<T>;
    /**
     * Factory that derives initial interaction state from the LLM response.
     * Required when `S` is not `void`. Called once after the API response arrives.
     */
    initialState?: (response: LLMResponse<T>) => S;
    /**
     * Render the LLM output. For interactive modals, use the `state` and `setState`
     * parameters to read and update the caller-defined interaction state.
     * Non-interactive callers can simply ignore the extra parameters.
     */
    renderOutput: (
        response: LLMResponse<T>,
        state: S,
        setState: React.Dispatch<React.SetStateAction<S>>
    ) => React.ReactNode;
    /** Callback when user accepts the result. Receives the immutable LLM response and the final interaction state. */
    onAccept: (response: LLMResponse<T>, state: S) => void;
    /** Optional callback when user cancels */
    onCancel?: () => void;
    /** Modal title */
    title?: string;
    /** Text for the Run button (default: "Run LLM") */
    buttonText?: string;
    /** Message to display on Shield during processing (default: "Processing with AI...") */
    shieldMessage?: string;
}
