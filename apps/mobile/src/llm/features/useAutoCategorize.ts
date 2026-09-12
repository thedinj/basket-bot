/**
 * Hook for auto-categorization feature
 */

import type { StoreAisle, StoreItem, StoreSection } from "@basket-bot/core";
import pluralize from "pluralize";
import { useCallback } from "react";
import { useShield } from "../../components/shield/useShield";
import type { LLMConfig } from "../config/llmConfig";
import { useLLMConfig } from "../config/useLLMConfig";
import { runLLM } from "../shared/runLLM";
import {
    autoCategorizeResultSchema,
    transformAutoCategorizeResult,
    type AutoCategorizeInput,
} from "./autoCategorize";
import { AUTO_CATEGORIZE_PROMPT } from "./autoCategorizePrompt";
import { findDuplicateOf, type DedupeCandidate, type DuplicateMatch } from "./itemDedupe";

/** Everything the duplicate check needs to know about an item already in the store. */
export type ExistingStoreItem = Pick<StoreItem, "id" | "name" | "aisleId" | "sectionId">;

export interface UseAutoCategorizeOptions {
    itemName: string;
    fullAisles: StoreAisle[]; // Full aisle data for ID resolution
    fullSections: StoreSection[]; // Full section data for ID resolution
    /**
     * The store's existing items. Supplying them turns on the duplicate check: once the
     * aisle/section is known, the item is compared against what already lives there. Omit to
     * skip the check entirely.
     */
    existingItems?: ExistingStoreItem[];
    /** Excluded from the candidate list — the row being categorized is not its own duplicate. */
    excludeItemId?: string;
    /**
     * A trailing detail a parser split off the name (bulk import's `notes`). Weighed by the
     * duplicate check only — categorization still goes on the name alone — because it may be
     * the product's identity ("green") or may be unrelated to it ("for lasagna").
     */
    qualifier?: string | null;
}

export interface UseAutoCategorizeResult {
    aisleId: string | null;
    sectionId: string | null;
    aisleName?: string;
    sectionName?: string;
    /**
     * Set when the item turns out to already exist under a different wording. Callers decide
     * what to do with it — `AUTO_MERGE_CONFIDENCE` / `SUGGEST_MERGE_CONFIDENCE` in `itemDedupe`
     * are the thresholds to compare against.
     */
    duplicateOf?: DuplicateMatch;
}

/**
 * Items that share the determined location, which is the candidate set for the duplicate check.
 *
 * A section is the tight blocking key. When the item only landed on an aisle, the whole aisle is
 * used instead — including items filed under that aisle's sections, since an existing copy may
 * well have been given a section the new one wasn't.
 */
function itemsAtLocation(
    items: ExistingStoreItem[],
    sections: StoreSection[],
    aisleId: string | null,
    sectionId: string | null
): DedupeCandidate[] {
    const matches = sectionId
        ? items.filter((item) => item.sectionId === sectionId)
        : aisleId
          ? items.filter((item) => {
                if (item.aisleId === aisleId) return true;
                const section = sections.find((s) => s.id === item.sectionId);
                return section?.aisleId === aisleId;
            })
          : [];

    return matches.map((item) => ({ id: item.id, name: item.name }));
}

/**
 * Hook that provides auto-categorization functionality.
 * Component will suspend until API key is loaded (via Suspense).
 */
export function useAutoCategorize() {
    // `effectiveConfig`, not `config`: the stored one omits every default the user never
    // overrode, so its model fields can be blank.
    const { effectiveConfig: llmConfig, provider, apiKey, isReady } = useLLMConfig();
    const { raiseShield, lowerShield } = useShield();

    const autoCategorize = useCallback(
        async ({
            itemName,
            fullAisles,
            fullSections,
            existingItems,
            excludeItemId,
            qualifier,
        }: UseAutoCategorizeOptions): Promise<UseAutoCategorizeResult> => {
            const shieldId = "auto-categorize";

            try {
                raiseShield(shieldId);

                if (!isReady) {
                    throw new Error(`No ${provider.label} API key configured`);
                }

                if (!itemName?.trim()) {
                    throw new Error("Item name is required");
                }

                if (!fullAisles || fullAisles.length === 0) {
                    throw new Error("No aisles available");
                }

                const located = await resolveLocation({
                    itemName,
                    fullAisles,
                    fullSections,
                    llmConfig,
                    apiKey,
                });

                if (!existingItems?.length) {
                    return located;
                }

                // A failed duplicate check must never sink the categorization that triggered it:
                // the location is already correct and useful on its own.
                try {
                    const candidates = itemsAtLocation(
                        excludeItemId
                            ? existingItems.filter((item) => item.id !== excludeItemId)
                            : existingItems,
                        fullSections,
                        located.aisleId,
                        located.sectionId
                    );

                    const duplicateOf = await findDuplicateOf({
                        itemName,
                        qualifier,
                        candidates,
                        config: llmConfig,
                        apiKey,
                    });

                    return duplicateOf ? { ...located, duplicateOf } : located;
                } catch (error) {
                    console.warn("[useAutoCategorize] Duplicate check failed:", error);
                    return located;
                }
            } finally {
                lowerShield(shieldId);
            }
        },
        [llmConfig, provider, apiKey, isReady, raiseShield, lowerShield]
    );

    return autoCategorize;
}

/** The original categorization: exact aisle/section name match first, then the LLM. */
async function resolveLocation(params: {
    itemName: string;
    fullAisles: StoreAisle[];
    fullSections: StoreSection[];
    llmConfig: LLMConfig;
    apiKey: string | null;
}): Promise<UseAutoCategorizeResult> {
    const { itemName, fullAisles, fullSections, llmConfig, apiKey } = params;

    // First check if there is an exact match in the aisle or section names (case insensitive, singular)
    const normalizedItemName = pluralize.singular(itemName.trim().toLowerCase());

    // Check for exact section match
    for (const section of fullSections) {
        const normalizedSectionName = pluralize.singular(section.name.trim().toLowerCase());
        if (normalizedSectionName === normalizedItemName) {
            const aisle = fullAisles.find((a) => a.id === section.aisleId);
            return {
                aisleId: section.aisleId,
                sectionId: section.id,
                aisleName: aisle?.name,
                sectionName: section.name,
            };
        }
    }

    // Check for exact aisle match
    for (const aisle of fullAisles) {
        const normalizedAisleName = pluralize.singular(aisle.name.trim().toLowerCase());
        if (normalizedAisleName === normalizedItemName) {
            return {
                aisleId: aisle.id,
                sectionId: null,
                aisleName: aisle.name,
                sectionName: undefined,
            };
        }
    }

    // Build minimal structure for LLM (name-only, no IDs)
    const aisles: AutoCategorizeInput["aisles"] = fullAisles.map((aisle) => {
        const aisleSections = fullSections.filter((s) => s.aisleId === aisle.id);
        const aisleData: { name: string; sections?: string[] } = {
            name: aisle.name,
        };
        // Only include sections field if there are sections
        if (aisleSections.length > 0) {
            aisleData.sections = aisleSections.map((s) => s.name);
        }
        return aisleData;
    });

    const input: AutoCategorizeInput = {
        itemName,
        aisles,
    };

    const response = await runLLM({
        tier: "fast",
        schema: autoCategorizeResultSchema,
        prompt: AUTO_CATEGORIZE_PROMPT,
        userText: JSON.stringify(input),
        config: llmConfig,
        apiKey,
    });

    const { aisleId, sectionId } = transformAutoCategorizeResult(
        response.data,
        fullAisles,
        fullSections
    );

    if (!aisleId) {
        throw new Error("Could not determine a matching aisle/section");
    }

    // Find names for the result
    const aisle = fullAisles.find((a) => a.id === aisleId);
    const section = fullSections.find((s) => s.id === sectionId);

    return {
        aisleId,
        sectionId,
        aisleName: aisle?.name,
        sectionName: section?.name,
    };
}
