/**
 * Adapter for the Anthropic Messages API.
 *
 * Differs from the OpenAI protocol in four ways this file has to bridge:
 * `x-api-key` instead of a bearer token, `system` as a top-level parameter rather than a
 * message, base64 image blocks instead of data-URL `image_url` parts, and JSON enforced
 * through `output_config.format` rather than `response_format`.
 */

import type { LLMResponse } from "../shared/types";
import { toStructuredOutputSchema } from "./jsonSchema";
import type { LLMProviderAdapter, LLMProviderContext, LLMRequest, LLMTier } from "./types";

const ANTHROPIC_VERSION = "2023-06-01";
const MAX_OUTPUT_TOKENS = 8192;

/**
 * Calls originate from the app's WebView/browser context, which the API rejects unless it
 * is told the exposure is intentional. Mirrors the SDK's `dangerouslyAllowBrowser` option.
 */
const BROWSER_ACCESS_HEADER = "anthropic-dangerous-direct-browser-access";

/** Reasoning depth per tier — the `fast` tier exists precisely to avoid paying for more. */
const EFFORT_BY_TIER: Record<LLMTier, string> = {
    fast: "low",
    smart: "medium",
    vision: "medium",
};

type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

const buildContent = (request: LLMRequest): ContentBlock[] => {
    const blocks: ContentBlock[] = [];

    for (const attachment of request.attachments ?? []) {
        if (typeof attachment.data !== "string") continue;
        blocks.push({
            type: "image",
            source: {
                type: "base64",
                media_type: attachment.mimeType,
                data: attachment.data,
            },
        });
    }

    if (request.userText) {
        blocks.push({ type: "text", text: request.userText });
    }

    // The API requires a non-empty first user turn even when the system prompt carries the
    // entire instruction, which is the case for prompts that take no user input at all.
    if (blocks.length === 0) {
        blocks.push({ type: "text", text: "Respond with the requested JSON." });
    }

    return blocks;
};

export const anthropicProvider: LLMProviderAdapter = {
    async call(request: LLMRequest, context: LLMProviderContext): Promise<LLMResponse> {
        const base = (context.baseUrl ?? "").replace(/\/+$/, "");

        const outputConfig: Record<string, unknown> = {
            effort: EFFORT_BY_TIER[request.tier],
        };
        if (request.jsonSchema) {
            outputConfig.format = {
                type: "json_schema",
                schema: toStructuredOutputSchema(request.jsonSchema),
            };
        }

        const response = await fetch(`${base}/v1/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": context.apiKey ?? "",
                "anthropic-version": ANTHROPIC_VERSION,
                [BROWSER_ACCESS_HEADER]: "true",
            },
            body: JSON.stringify({
                model: request.model,
                max_tokens: MAX_OUTPUT_TOKENS,
                system: request.systemPrompt,
                messages: [{ role: "user", content: buildContent(request) }],
                output_config: outputConfig,
            }),
        });

        if (!response.ok) {
            throw new Error(`${response.status}: ${await response.text()}`);
        }

        const body = await response.json();

        if (body?.stop_reason === "refusal") {
            throw new Error("The model declined to answer this request");
        }
        if (body?.stop_reason === "max_tokens") {
            throw new Error("The response was cut off before it finished — try less input");
        }

        const raw = (body?.content ?? []).find(
            (block: { type?: string }) => block?.type === "text"
        )?.text;
        if (typeof raw !== "string") {
            throw new Error("Response contained no text content");
        }

        return { data: JSON.parse(raw), raw };
    },
};
