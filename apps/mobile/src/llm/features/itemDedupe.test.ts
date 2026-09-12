/**
 * The two halves of duplicate detection that run without a model.
 *
 * `narrowCandidates` is the free gate in front of the LLM — it decides whether a call is made
 * at all, so a bug there either burns a call on every item or silently disables the feature.
 * `resolveDuplicateMatch` is the last check before a merge, which deletes a row: a name the
 * model invented must never resolve to a real item.
 */

import { describe, expect, it } from "vitest";
import {
    contentTokens,
    narrowCandidates,
    resolveDuplicateMatch,
    type DedupeCandidate,
    type ItemDedupeResult,
} from "./itemDedupe";

const MOZZARELLA: DedupeCandidate = { id: "item-1", name: "Shredded mozzarella" };
const CHEDDAR: DedupeCandidate = { id: "item-2", name: "Sharp cheddar" };
const CANDIDATES = [MOZZARELLA, CHEDDAR];

const cluster = (
    canonicalName: string,
    duplicateNames: string[],
    confidence = 0.95
): ItemDedupeResult => ({
    clusters: [{ canonicalName, duplicateNames, confidence, reasoning: "same product" }],
});

describe("contentTokens", () => {
    it("singularizes each word, so word order cannot hide a match", () => {
        expect(contentTokens("Mozzarella, shredded")).toEqual(
            contentTokens("shredded mozzarellas")
        );
    });

    it("drops stopwords and single characters", () => {
        expect([...contentTokens("Bag of A apples")]).toEqual(["bag", "apple"]);
    });
});

describe("narrowCandidates", () => {
    it("keeps only items sharing a content word", () => {
        expect(narrowCandidates("Mozzarella, shredded", CANDIDATES)).toEqual([MOZZARELLA]);
    });

    it("returns nothing when no candidate can plausibly match, so no call is made", () => {
        expect(narrowCandidates("Paper towels", CANDIDATES)).toEqual([]);
    });

    it("excludes the item's own row — an exact name match is not a duplicate", () => {
        expect(narrowCandidates("shredded MOZZARELLA", CANDIDATES)).toEqual([]);
    });

    /**
     * The cost guarantee. An item landing in a section that holds nothing yet — or landing
     * nowhere at all — must not reach the network, however promising its name.
     */
    it("returns nothing for an empty section, so an empty aisle costs no call", () => {
        expect(narrowCandidates("Shredded mozzarella", [])).toEqual([]);
    });

    // The parser splits "peppers (green)" into name + notes, so the bare name no longer shares
    // "green" with "Green peppers". The qualifier puts that token back into the filter.
    it("widens the net with the qualifier's words", () => {
        const green = { id: "item-3", name: "Green peppers" };
        expect(narrowCandidates("Peppers", [green], "green")).toEqual([green]);
    });

    it("still finds nothing when neither name nor qualifier overlaps", () => {
        expect(narrowCandidates("Peppers", CANDIDATES, "for lasagna")).toEqual([]);
    });
});

describe("resolveDuplicateMatch", () => {
    it("maps a cluster back onto the existing item", () => {
        const match = resolveDuplicateMatch(
            cluster("Shredded mozzarella", ["Mozzarella, shredded"]),
            "Mozzarella, shredded",
            CANDIDATES
        );

        expect(match?.existing).toEqual(MOZZARELLA);
        expect(match?.canonicalName).toBe("Shredded mozzarella");
        expect(match?.confidence).toBe(0.95);
    });

    it("returns null when the cluster does not involve the item being checked", () => {
        expect(
            resolveDuplicateMatch(
                cluster("Sharp cheddar", ["Cheddar, sharp"]),
                "Mozzarella, shredded",
                CANDIDATES
            )
        ).toBeNull();
    });

    it("returns null when the model names an item that was never sent", () => {
        expect(
            resolveDuplicateMatch(
                cluster("Fresh mozzarella", ["Mozzarella, shredded"]),
                "Mozzarella, shredded",
                CANDIDATES
            )
        ).toBeNull();
    });

    it("falls back to the existing item's name when the canonical name was invented", () => {
        const match = resolveDuplicateMatch(
            {
                clusters: [
                    {
                        canonicalName: "Mozzarella (shredded)",
                        duplicateNames: ["Mozzarella, shredded", "Shredded mozzarella"],
                        confidence: 0.9,
                        reasoning: "same product",
                    },
                ],
            },
            "Mozzarella, shredded",
            CANDIDATES
        );

        expect(match?.existing).toEqual(MOZZARELLA);
        expect(match?.canonicalName).toBe("Shredded mozzarella");
    });

    it("returns null for an empty result, the expected answer most of the time", () => {
        expect(
            resolveDuplicateMatch({ clusters: [] }, "Mozzarella, shredded", CANDIDATES)
        ).toBeNull();
    });
});
