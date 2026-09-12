/**
 * Duplicate detection for store items.
 *
 * Auto-Locate happily creates "Mozzarella, shredded" next to an existing "Shredded mozzarella":
 * `normalizeItemName` only trims/lowercases/collapses whitespace, so the two are distinct
 * `nameNorm` values and distinct rows. Word order, punctuation and adjective position are exactly
 * the kind of difference a model can judge and a string comparison cannot.
 *
 * The aisle/section that Auto-Locate just determined is the blocking key: a section holds a
 * handful of items, so "is this the same product as one of these 12?" is a cheap `fast`-tier
 * question. Candidates are narrowed further by a free local token filter first, so the common
 * case — a genuinely new item sharing no content word with anything nearby — costs no call
 * at all.
 */

import { normalizeItemName, normalizeForSearch } from "@basket-bot/core";
import pluralize from "pluralize";
import { z } from "zod";
import type { LLMConfig } from "../config/llmConfig";
import { runLLM } from "../shared/runLLM";
import { ITEM_DEDUPE_PROMPT } from "./itemDedupePrompt";

/**
 * Merge without asking at or above this confidence. Below it a bulk flow leaves the duplicate
 * alone entirely — a wrong silent merge costs the user more than a duplicate row does.
 */
export const AUTO_MERGE_CONFIDENCE = 0.85;

/**
 * Worth raising with the user in a flow where they are already looking at the screen. Below
 * this the model is guessing and the prompt would be noise.
 */
export const SUGGEST_MERGE_CONFIDENCE = 0.6;

/** How many nearby items are ever sent. Sections are small; this is a runaway guard. */
const MAX_CANDIDATES = 40;

export const duplicateClusterSchema = z.object({
    canonicalName: z.string(),
    duplicateNames: z.array(z.string()),
    confidence: z.number(),
    reasoning: z.string(),
});

export const itemDedupeResultSchema = z.object({
    clusters: z.array(duplicateClusterSchema),
});

export type ItemDedupeResult = z.infer<typeof itemDedupeResultSchema>;

/** The minimum a caller has to know about an item to offer it as a candidate. */
export interface DedupeCandidate {
    id: string;
    name: string;
}

export interface DuplicateMatch {
    /** The existing item the new name turned out to be. */
    existing: DedupeCandidate;
    /** The name the model thinks the survivor should carry. */
    canonicalName: string;
    confidence: number;
    reasoning: string;
}

/**
 * Words that carry no product identity, so sharing one is not evidence of a duplicate.
 * Deliberately short: the filter only has to be cheap and generous, the model does the judging.
 */
const STOPWORDS = new Set([
    "a",
    "an",
    "and",
    "in",
    "of",
    "or",
    "the",
    "with",
    "without",
    "free",
    "style",
]);

/**
 * Content tokens of a name: singularized per word, so "shredded mozzarella" and
 * "mozzarella, shredded" both yield {shredded, mozzarella}. `normalizeForSearch` singularizes
 * the whole string (only its last word), which is not enough here.
 */
export function contentTokens(name: string): Set<string> {
    return new Set(
        normalizeItemName(name)
            .split(/[^a-z0-9]+/)
            .filter((token) => token.length > 1 && !STOPWORDS.has(token))
            .map((token) => pluralize.singular(token))
    );
}

/**
 * The free gate in front of the LLM: only items sharing a content word with `itemName` can
 * plausibly be the same product. Returns them in the caller's order, capped.
 *
 * An empty candidate list — the common case of a section that holds nothing yet — falls
 * straight through to an empty result, so `findDuplicateOf` never reaches the network.
 *
 * `qualifier` only widens the net: its words let "Peppers" reach "Green peppers". It is
 * deliberately not used to *exclude* anything, because it may be unrelated to the product.
 */
export function narrowCandidates(
    itemName: string,
    candidates: DedupeCandidate[],
    qualifier?: string | null
) {
    const tokens = contentTokens(itemName);
    for (const token of contentTokens(qualifier ?? "")) {
        tokens.add(token);
    }
    if (tokens.size === 0) return [];

    const target = normalizeItemName(itemName);

    return candidates
        .filter((candidate) => {
            // An exact-name match is the same row, not a duplicate to merge.
            if (normalizeItemName(candidate.name) === target) return false;
            for (const token of contentTokens(candidate.name)) {
                if (tokens.has(token)) return true;
            }
            return false;
        })
        .slice(0, MAX_CANDIDATES);
}

/** Index candidates by both normalizations, so a model reply matches on either. */
function indexByName(candidates: DedupeCandidate[]): Map<string, DedupeCandidate> {
    const index = new Map<string, DedupeCandidate>();
    for (const candidate of candidates) {
        index.set(normalizeItemName(candidate.name), candidate);
        index.set(normalizeForSearch(candidate.name), candidate);
    }
    return index;
}

/**
 * Maps a model reply back onto real items.
 *
 * Names are matched against the candidates that were sent; anything else the model produced is
 * dropped rather than trusted, the same hallucination guard `transformAutoCategorizeResult` uses.
 * Returns null unless a cluster actually pairs `itemName` with an existing item.
 */
export function resolveDuplicateMatch(
    result: ItemDedupeResult,
    itemName: string,
    candidates: DedupeCandidate[]
): DuplicateMatch | null {
    const index = indexByName(candidates);
    const targets = new Set([normalizeItemName(itemName), normalizeForSearch(itemName)]);

    for (const cluster of result.clusters) {
        const names = cluster.duplicateNames.concat(cluster.canonicalName);
        if (!names.some((name) => targets.has(normalizeItemName(name)))) continue;

        // The first candidate the cluster names that we actually know about wins. Multiple
        // matches would mean the section already holds duplicates of its own; merging one pair
        // at a time still converges.
        const existing = names
            .map(
                (name) => index.get(normalizeItemName(name)) ?? index.get(normalizeForSearch(name))
            )
            .find((candidate): candidate is DedupeCandidate => candidate !== undefined);

        if (!existing) continue;

        // The canonical name has to be one of the real names in play — either a candidate that
        // was sent or the item being checked. A model that rewords both into a third spelling
        // would otherwise get to rename the survivor to something the user never typed.
        const canonicalNorm = normalizeItemName(cluster.canonicalName);
        const canonicalName =
            index.has(canonicalNorm) || targets.has(canonicalNorm)
                ? cluster.canonicalName
                : existing.name;

        return {
            existing,
            canonicalName,
            confidence: cluster.confidence,
            reasoning: cluster.reasoning,
        };
    }

    return null;
}

/**
 * Asks whether `itemName` is the same product as something already nearby.
 *
 * Resolves to null — without spending a call — whenever the local filter finds nothing that
 * could plausibly match. A thrown error is the caller's to swallow: a failed duplicate check
 * must never sink the Auto-Locate that triggered it.
 */
export async function findDuplicateOf(params: {
    itemName: string;
    /**
     * A trailing detail the caller split off the name — bulk import's `notes`. Sometimes it
     * *is* the product's identity ("green", "2%", "shredded"); just as often it is a recipe
     * ("for lasagna"), a brand, or an errand note that says nothing about which product this
     * is. So it travels as its own labelled field for the model to weigh and discard, never
     * glued onto the name where it would silently become part of the identity.
     */
    qualifier?: string | null;
    candidates: DedupeCandidate[];
    config: LLMConfig;
    apiKey: string | null;
}): Promise<DuplicateMatch | null> {
    const narrowed = narrowCandidates(params.itemName, params.candidates, params.qualifier);
    if (narrowed.length === 0) return null;

    const qualifier = params.qualifier?.trim();

    const response = await runLLM({
        tier: "fast",
        schema: itemDedupeResultSchema,
        prompt: ITEM_DEDUPE_PROMPT,
        userText: JSON.stringify({
            newItem: params.itemName,
            ...(qualifier ? { qualifier } : {}),
            existingItems: narrowed.map((candidate) => candidate.name),
        }),
        config: params.config,
        apiKey: params.apiKey,
    });

    return resolveDuplicateMatch(response.data, params.itemName, narrowed);
}
