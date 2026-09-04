/**
 * The single entry point for every LLM call in the app.
 *
 * Resolves the provider and model from configuration, keeps the screen awake for the
 * duration of the request, and validates the response against the caller's Zod schema.
 * No feature names a vendor, a model, or an endpoint.
 */

import { KeepAwake } from "@capacitor-community/keep-awake";
import { Capacitor } from "@capacitor/core";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { resolveBaseUrl, resolveModel, type LLMConfig } from "../config/llmConfig";
import { getProviderOrDefault } from "../providers/registry";
import type { LLMTier } from "../providers/types";
import type { LLMAttachment, LLMResponse } from "./types";

export interface RunLLMOptions<T> {
    /** The capability the feature needs. Upgraded to `vision` when attachments are present. */
    tier: LLMTier;
    /** Validates the response and gives the caller its parsed type. */
    schema: z.ZodType<T>;
    /** Instructions the user never sees. */
    prompt: string;
    /** Untrusted user input — never merged into the prompt. */
    userText?: string;
    attachments?: LLMAttachment[];
    config: LLMConfig;
    apiKey: string | null;
}

/**
 * A request carrying an image needs a model that can see, whatever tier the feature asked
 * for. Keeping the upgrade here means a text-only bulk import still uses the cheap model.
 */
const effectiveTier = (tier: LLMTier, attachments?: LLMAttachment[]): LLMTier =>
    attachments?.length ? "vision" : tier;

/** Turn a Zod issue list into one line a user can act on. */
const describeIssues = (error: z.ZodError): string =>
    error.issues
        .slice(0, 3)
        .map((issue) => {
            const path = issue.path.join(".");
            return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join("; ");

export const runLLM = async <T>({
    tier,
    schema,
    prompt,
    userText,
    attachments,
    config,
    apiKey,
}: RunLLMOptions<T>): Promise<LLMResponse<T>> => {
    const provider = getProviderOrDefault(config.providerId);

    if (provider.requiresApiKey && !apiKey) {
        throw new Error(`No ${provider.label} API key configured. Add one in Settings.`);
    }

    const resolvedTier = effectiveTier(tier, attachments);

    let response: LLMResponse;
    try {
        // Long requests can outlive the screen timeout; a sleeping device drops the socket.
        if (Capacitor.isNativePlatform()) {
            await KeepAwake.keepAwake();
        }

        response = await provider.adapter.call(
            {
                systemPrompt: prompt,
                userText,
                attachments,
                model: resolveModel(config, resolvedTier),
                tier: resolvedTier,
                jsonSchema: zodToJsonSchema(schema) as Record<string, unknown>,
            },
            { apiKey: apiKey ?? undefined, baseUrl: resolveBaseUrl(config) }
        );
    } catch (error) {
        throw new Error(
            `${provider.label} request failed: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    } finally {
        if (Capacitor.isNativePlatform()) {
            await KeepAwake.allowSleep();
        }
    }

    const parsed = schema.safeParse(response.data);
    if (!parsed.success) {
        throw new Error(
            `${provider.label} returned unexpected data — ${describeIssues(parsed.error)}`
        );
    }

    return { data: parsed.data, raw: response.raw };
};
