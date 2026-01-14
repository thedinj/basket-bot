/**
 * Direct LLM API calls without modal UI
 */

import { OpenAIClient } from "./openaiClient";
import { LLMResponse } from "./types";

interface DirectCallOptions {
    apiKey?: string;
    prompt: string;
    userText?: string;
    model?: string;
}

/**
 * Call the LLM directly without showing a modal.
 * Validates API key and throws error if missing.
 */
export async function callLLMDirect({
    apiKey,
    prompt,
    userText,
    model = "gpt-4o-mini",
}: DirectCallOptions): Promise<LLMResponse> {
    if (!apiKey) {
        throw new Error(
            "OpenAI API key is required. Please configure it in Settings."
        );
    }

    const client = new OpenAIClient(apiKey);
    return await client.call({
        prompt,
        userText,
        model,
    });
}
