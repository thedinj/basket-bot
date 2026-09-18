/**
 * Aisle emoji suggestions: one emoji per named aisle, shown in its shopping-list plate.
 */

import type { StoreAisle } from "@basket-bot/core";
import { toSingleEmojiOrNull } from "@basket-bot/core";
import { z } from "zod";
import { parseAisleName } from "../../utils/aisleName";

export const aisleEmojiResultSchema = z.object({
    aisles: z.array(
        z.object({
            name: z.string(),
            emoji: z.string().nullable(),
        })
    ),
});

export type AisleEmojiResult = z.infer<typeof aisleEmojiResultSchema>;

type AisleForEmoji = Pick<StoreAisle, "id" | "name" | "emoji">;

export type AisleEmojiSuggestion = {
    aisleId: string;
    name: string;
    emoji: string;
};

/**
 * The aisles worth asking about: named, and without an emoji yet. Number-only aisles ("12",
 * "Aisle 3") are left out — their plate is the "AISLE 3" sign — and so is any aisle the user
 * already gave an emoji, which a suggestion must never overwrite.
 */
export const aislesNeedingEmoji = <T extends AisleForEmoji>(aisles: readonly T[]): T[] =>
    aisles.filter((aisle) => {
        if (aisle.emoji) return false;
        const { code, label } = parseAisleName(aisle.name);
        return !(code && !label);
    });

/**
 * Matches the model's answer back to the aisles that were asked about, by name. Entries it
 * invented, renamed, or answered with something other than one emoji are dropped.
 */
export const matchAisleEmoji = (
    result: AisleEmojiResult,
    candidates: readonly AisleForEmoji[]
): AisleEmojiSuggestion[] => {
    const byName = new Map(
        result.aisles.map((entry) => [entry.name.trim().toLowerCase(), entry.emoji])
    );
    return candidates.flatMap((aisle) => {
        const emoji = toSingleEmojiOrNull(byName.get(aisle.name.trim().toLowerCase()));
        return emoji ? [{ aisleId: aisle.id, name: aisle.name, emoji }] : [];
    });
};

/**
 * Suggests emoji for the aisles that need one. `runModel` is the actual LLM call (injected, so
 * this stays testable); it is never invoked when no aisle needs an emoji.
 */
export const suggestAisleEmoji = async (
    aisles: readonly AisleForEmoji[],
    runModel: (userText: string) => Promise<AisleEmojiResult>
): Promise<AisleEmojiSuggestion[]> => {
    const candidates = aislesNeedingEmoji(aisles);
    if (candidates.length === 0) return [];
    const result = await runModel(JSON.stringify({ aisles: candidates.map((a) => a.name) }));
    return matchAisleEmoji(result, candidates);
};

/**
 * One aisle, on request (the editor's Suggest action): asks about `name` even if the aisle
 * already has an emoji, since the user explicitly asked. Resolves to null — without calling the
 * model — for a blank or number-only name, which has nothing to depict.
 */
export const suggestEmojiForAisleName = async (
    name: string,
    runModel: (userText: string) => Promise<AisleEmojiResult>
): Promise<string | null> => {
    const trimmed = name.trim();
    if (!canSuggestEmojiFor(trimmed)) return null;
    const result = await runModel(JSON.stringify({ aisles: [trimmed] }));
    return matchAisleEmoji(result, [{ id: "", name: trimmed, emoji: null }])[0]?.emoji ?? null;
};

/** True when a name has something an emoji could depict: not blank, not just a number. */
export const canSuggestEmojiFor = (name: string): boolean => {
    if (!name.trim()) return false;
    const { code, label } = parseAisleName(name);
    return !(code && !label);
};
