/**
 * `transformAutoCategorizeResult` maps the names a model returns back onto real aisle and
 * section rows. It is the last check before an item is filed: an unmatched name must come
 * back as null so the caller can refuse, rather than resolving to some other aisle. Unlike
 * the store scan, matching here is exact-but-case-insensitive — there is no fuzzy fallback.
 */

import type { StoreAisle, StoreSection } from "@basket-bot/core";
import { describe, expect, it } from "vitest";
import { transformAutoCategorizeResult, type AutoCategorizeResult } from "./autoCategorize";

const aisle = (id: string, name: string): StoreAisle =>
    ({ id, name, storeId: "store-1", sortOrder: 0 }) as StoreAisle;

const section = (id: string, name: string, aisleId: string): StoreSection =>
    ({ id, name, aisleId, storeId: "store-1", sortOrder: 0 }) as StoreSection;

const suggestion = (aisleName: string, sectionName: string | null): AutoCategorizeResult => ({
    aisleName,
    sectionName,
    confidence: 0.9,
    reasoning: "because",
});

const AISLES = [aisle("aisle-dairy", "Dairy"), aisle("aisle-bakery", "Bakery")];
const SECTIONS = [
    section("section-cheese", "Cheese", "aisle-dairy"),
    section("section-bread", "Bread", "aisle-bakery"),
];

describe("transformAutoCategorizeResult", () => {
    it("resolves an aisle and section pair to their ids", () => {
        expect(
            transformAutoCategorizeResult(suggestion("Dairy", "Cheese"), AISLES, SECTIONS)
        ).toEqual({ aisleId: "aisle-dairy", sectionId: "section-cheese" });
    });

    it("matches names case-insensitively", () => {
        expect(
            transformAutoCategorizeResult(suggestion("dairy", "CHEESE"), AISLES, SECTIONS)
        ).toEqual({ aisleId: "aisle-dairy", sectionId: "section-cheese" });
    });

    it("resolves an aisle-only suggestion", () => {
        expect(transformAutoCategorizeResult(suggestion("Bakery", null), AISLES, SECTIONS)).toEqual(
            {
                aisleId: "aisle-bakery",
                sectionId: null,
            }
        );
    });

    it("returns nulls for an aisle the store does not have", () => {
        expect(
            transformAutoCategorizeResult(suggestion("Hardware", "Nails"), AISLES, SECTIONS)
        ).toEqual({ aisleId: null, sectionId: null });
    });

    it("keeps the aisle but drops an unknown section", () => {
        expect(
            transformAutoCategorizeResult(
                suggestion("Dairy", "Artisanal Yak Butter"),
                AISLES,
                SECTIONS
            )
        ).toEqual({ aisleId: "aisle-dairy", sectionId: null });
    });

    it("refuses a section that belongs to a different aisle", () => {
        // "Bread" exists, but under Bakery — filing it under Dairy would put the item in a
        // section its own aisle does not contain.
        expect(
            transformAutoCategorizeResult(suggestion("Dairy", "Bread"), AISLES, SECTIONS)
        ).toEqual({ aisleId: "aisle-dairy", sectionId: null });
    });

    it("does not fuzzy-match a near miss the way the store scan does", () => {
        expect(
            transformAutoCategorizeResult(suggestion("Fresh Dairy", null), AISLES, SECTIONS)
        ).toEqual({ aisleId: null, sectionId: null });
    });

    it("returns nulls when the store has no aisles at all", () => {
        expect(transformAutoCategorizeResult(suggestion("Dairy", "Cheese"), [], [])).toEqual({
            aisleId: null,
            sectionId: null,
        });
    });
});
