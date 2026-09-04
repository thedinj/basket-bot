/**
 * Adapter for any server speaking the OpenAI Chat Completions protocol.
 *
 * The base URL is injected rather than baked in, so one adapter covers OpenAI itself,
 * OpenRouter, Groq, Together, and local servers (Ollama, LM Studio, vLLM).
 *
 * JSON is requested with `response_format: { type: "json_object" }` rather than a strict
 * JSON schema: schema mode is not implemented consistently across OpenAI-compatible
 * servers, whereas plain JSON mode is near-universal. `runLLM` validates the result with
 * the caller's Zod schema regardless, so nothing depends on the server enforcing shape.
 */

import type { LLMResponse } from "../shared/types";
import type { LLMProviderAdapter, LLMProviderContext, LLMRequest } from "./types";

/** Ceiling on generated tokens. Store scans return the largest payloads we produce. */
const MAX_OUTPUT_TOKENS = 8192;

type ChatContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

interface ChatMessage {
    role: "system" | "user";
    content: string | ChatContentPart[];
}

const buildMessages = (request: LLMRequest): ChatMessage[] => {
    // The system/user split is the prompt-injection boundary: instructions go in the
    // system role, anything the user supplied stays in the user role.
    const messages: ChatMessage[] = [{ role: "system", content: request.systemPrompt }];

    const hasAttachments = !!request.attachments?.length;
    if (!request.userText && !hasAttachments) {
        return messages;
    }

    if (!hasAttachments) {
        messages.push({ role: "user", content: request.userText! });
        return messages;
    }

    const parts: ChatContentPart[] = [];
    if (request.userText) {
        parts.push({ type: "text", text: request.userText });
    }
    for (const attachment of request.attachments!) {
        if (typeof attachment.data !== "string") continue;
        parts.push({
            type: "image_url",
            image_url: { url: `data:${attachment.mimeType};base64,${attachment.data}` },
        });
    }
    messages.push({ role: "user", content: parts });

    return messages;
};

export const openAICompatibleProvider: LLMProviderAdapter = {
    async call(request: LLMRequest, context: LLMProviderContext): Promise<LLMResponse> {
        const base = (context.baseUrl ?? "").replace(/\/+$/, "");

        const response = await fetch(`${base}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.apiKey ?? ""}`,
            },
            body: JSON.stringify({
                model: request.model,
                messages: buildMessages(request),
                max_tokens: MAX_OUTPUT_TOKENS,
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            throw new Error(`${response.status}: ${await response.text()}`);
        }

        const body = await response.json();
        const raw = body?.choices?.[0]?.message?.content;
        if (typeof raw !== "string") {
            throw new Error("Response contained no message content");
        }

        return { data: JSON.parse(raw), raw };
    },
};
