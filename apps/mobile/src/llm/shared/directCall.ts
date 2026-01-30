/**
 * Direct LLM API calls without modal UI
 */

import { KeepAwake } from "@capacitor-community/keep-awake";
import { Capacitor } from "@capacitor/core";
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
 * Keeps screen awake during API call to prevent network interruption.
 */
export async function callLLMDirect({
    apiKey,
    prompt,
    userText,
    model = "gpt-4o-mini",
}: DirectCallOptions): Promise<LLMResponse> {
    if (!apiKey) {
        throw new Error("OpenAI API key is required. Please configure it in Settings.");
    }

    try {
        // Keep screen on during API call
        if (Capacitor.isNativePlatform()) {
            await KeepAwake.keepAwake();
        }

        const client = new OpenAIClient(apiKey);
        return await client.call({
            prompt,
            userText,
            model,
        });
    } finally {
        // Allow screen to sleep again
        if (Capacitor.isNativePlatform()) {
            await KeepAwake.allowSleep();
        }
    }
}
