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
 *
 * The output-token limit is the one parameter the protocol has split on: OpenAI renamed
 * `max_tokens` to `max_completion_tokens` and now rejects the old name outright on current
 * models, while most self-hosted servers still only know `max_tokens`. Each provider
 * declares which name it wants (`createOpenAICompatibleProvider`), and a request rejected
 * for that specific parameter is retried once under the other name — because "any server
 * speaking the OpenAI protocol" means servers that predate and postdate the rename, and the
 * user has no way to tell which they are pointing at.
 */

import type { LLMResponse } from "../shared/types";
import type { LLMProviderAdapter, LLMProviderContext, LLMRequest } from "./types";

/** Ceiling on generated tokens. Store scans return the largest payloads we produce. */
const MAX_OUTPUT_TOKENS = 8192;

/** The two names the OpenAI protocol has used for the output-token ceiling. */
export type OutputTokenParam = "max_tokens" | "max_completion_tokens";

const OTHER_PARAM: Record<OutputTokenParam, OutputTokenParam> = {
    max_tokens: "max_completion_tokens",
    max_completion_tokens: "max_tokens",
};

/**
 * Whether a 400 body is the server objecting to the token-limit parameter by name.
 *
 * Matched on the parameter name rather than the prose so a reworded message still routes
 * to the retry; anything else is a real error and must surface unchanged.
 */
const rejectedOutputTokenParam = (body: string, sent: OutputTokenParam): boolean =>
    body.includes(sent) &&
    (body.includes("unsupported_parameter") || body.includes("unsupported parameter"));

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

export interface OpenAICompatibleOptions {
    /**
     * Which name this provider's server expects for the output-token ceiling. Only the
     * starting guess — a rejection for this exact parameter is retried under the other name.
     */
    outputTokenParam?: OutputTokenParam;
}

export const createOpenAICompatibleProvider = ({
    outputTokenParam = "max_tokens",
}: OpenAICompatibleOptions = {}): LLMProviderAdapter => ({
    async call(request: LLMRequest, context: LLMProviderContext): Promise<LLMResponse> {
        const base = (context.baseUrl ?? "").replace(/\/+$/, "");
        const messages = buildMessages(request);

        const post = (tokenParam: OutputTokenParam) =>
            fetch(`${base}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${context.apiKey ?? ""}`,
                },
                body: JSON.stringify({
                    model: request.model,
                    messages,
                    [tokenParam]: MAX_OUTPUT_TOKENS,
                    response_format: { type: "json_object" },
                }),
            });

        let response = await post(outputTokenParam);

        if (response.status === 400) {
            // Read once — the body cannot be consumed twice, and it is needed either to
            // decide on the retry or to report the original failure.
            const body = await response.text();
            if (!rejectedOutputTokenParam(body, outputTokenParam)) {
                throw new Error(`400: ${body}`);
            }
            response = await post(OTHER_PARAM[outputTokenParam]);
        }

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
});

/** Default instance for servers that still use the original parameter name. */
export const openAICompatibleProvider: LLMProviderAdapter = createOpenAICompatibleProvider();
