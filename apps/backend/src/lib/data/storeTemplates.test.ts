import { describe, expect, it } from "vitest";
import {
    BLANK_STORE_TEMPLATE_ID,
    countTemplateSections,
    getStoreTemplate,
    listStoreTemplateSummaries,
    STORE_TEMPLATES,
} from "./storeTemplates";

/**
 * Integrity checks on the template catalog itself — no database involved.
 *
 * These exist so editing a layout can't silently break seeding: a renamed aisle that orphans a
 * sample item, or a duplicated section name that would trip the UNIQUE constraints, fails here
 * rather than at INSERT time in front of a user.
 */

describe("store template catalog", () => {
    it("offers the blank template first so it is the default selection", () => {
        expect(STORE_TEMPLATES[0].id).toBe(BLANK_STORE_TEMPLATE_ID);
        expect(STORE_TEMPLATES[0].aisles).toHaveLength(0);
        expect(STORE_TEMPLATES[0].sampleItems).toHaveLength(0);
    });

    it("has unique template ids", () => {
        const ids = STORE_TEMPLATES.map((template) => template.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("resolves a known id and rejects an unknown one", () => {
        expect(getStoreTemplate("grocery")?.label).toBe("Grocery store");
        expect(getStoreTemplate("no-such-template")).toBeUndefined();
    });

    describe.each(STORE_TEMPLATES.map((template) => [template.id, template] as const))(
        "%s",
        (_id, template) => {
            it("has no duplicate aisle names (UNIQUE storeId, nameNorm)", () => {
                const names = template.aisles.map((aisle) => aisle.name.toLowerCase());
                expect(new Set(names).size).toBe(names.length);
            });

            it("has no duplicate section names within an aisle (UNIQUE storeId, aisleId, nameNorm)", () => {
                for (const aisle of template.aisles) {
                    const names = (aisle.sections ?? []).map((section) => section.toLowerCase());
                    expect(new Set(names).size).toBe(names.length);
                }
            });

            it("keeps every name within the 100-character column limit", () => {
                const names = template.aisles.flatMap((aisle) => [
                    aisle.name,
                    ...(aisle.sections ?? []),
                ]);
                for (const name of [...names, ...template.sampleItems.map((i) => i.name)]) {
                    expect(name.length).toBeGreaterThanOrEqual(1);
                    expect(name.length).toBeLessThanOrEqual(100);
                }
            });

            it("places every sample item somewhere the template actually defines", () => {
                for (const sample of template.sampleItems) {
                    const aisle = template.aisles.find((a) => a.name === sample.location.aisle);
                    expect(aisle, `${sample.name}: aisle "${sample.location.aisle}"`).toBeDefined();

                    if (sample.location.section) {
                        expect(
                            aisle?.sections ?? [],
                            `${sample.name}: section "${sample.location.section}"`
                        ).toContain(sample.location.section);
                    }
                }
            });
        }
    );

    it("derives summary counts from the layout rather than hand-written text", () => {
        const summaries = listStoreTemplateSummaries();
        expect(summaries).toHaveLength(STORE_TEMPLATES.length);

        for (const summary of summaries) {
            const template = getStoreTemplate(summary.id)!;
            expect(summary.aisleCount).toBe(template.aisles.length);
            expect(summary.sectionCount).toBe(countTemplateSections(template));
            expect(summary.label.length).toBeGreaterThan(0);
            expect(summary.description.length).toBeGreaterThan(0);
        }
    });

    it("gives the grocery template a layout a family can shop from", () => {
        const grocery = getStoreTemplate("grocery")!;

        // Guards against someone trimming this back to a token list — the whole point is that
        // it is usable without running the AI store scan.
        expect(grocery.aisles.length).toBeGreaterThanOrEqual(15);
        expect(countTemplateSections(grocery)).toBeGreaterThanOrEqual(30);
        expect(grocery.sampleItems.length).toBeGreaterThan(0);
    });
});
