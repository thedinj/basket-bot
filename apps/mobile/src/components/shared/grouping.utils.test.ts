import { describe, expect, it } from "vitest";
import { createAisleSectionGroups } from "./grouping.utils";

interface TestItem {
    id: string;
    aisleId: string | null;
    sectionId: string | null;
    aisleName?: string | null;
    aisleEmoji?: string | null;
    sectionName?: string | null;
    aisleSortOrder?: number | null;
    sectionSortOrder?: number | null;
}

const item = (overrides: Partial<TestItem> & { id: string }): TestItem => ({
    aisleId: null,
    sectionId: null,
    ...overrides,
});

const BOTH_HEADERS = { showAisleHeaders: true, showSectionHeaders: true };

describe("createAisleSectionGroups", () => {
    it("nests sections as children of their aisle", () => {
        const groups = createAisleSectionGroups(
            [
                item({
                    id: "a",
                    aisleId: "A1",
                    sectionId: "S1",
                    aisleName: "Produce",
                    sectionName: "Fruit",
                }),
                item({
                    id: "b",
                    aisleId: "A1",
                    sectionId: "S2",
                    aisleName: "Produce",
                    sectionName: "Veg",
                }),
            ],
            BOTH_HEADERS
        );

        expect(groups).toHaveLength(1);
        expect(groups[0].header?.label).toBe("Produce");
        expect(groups[0].children).toHaveLength(2);
        expect(groups[0].children?.map((c) => c.header?.label)).toEqual(["Fruit", "Veg"]);
    });

    // Uncategorized is pinned to the top so newly added, unsorted items stay visible rather
    // than sinking below every configured aisle.
    it("sorts the uncategorized aisle first regardless of other sort orders", () => {
        const groups = createAisleSectionGroups(
            [
                item({ id: "a", aisleId: "A1", aisleName: "Produce", aisleSortOrder: 0 }),
                item({ id: "b", aisleId: null }),
            ],
            BOTH_HEADERS
        );

        expect(groups.map((g) => g.header?.label)).toEqual(["Uncategorized", "Produce"]);
    });

    it("orders categorized aisles by their sort order", () => {
        const groups = createAisleSectionGroups(
            [
                item({ id: "a", aisleId: "A2", aisleName: "Dairy", aisleSortOrder: 5 }),
                item({ id: "b", aisleId: "A1", aisleName: "Produce", aisleSortOrder: 1 }),
            ],
            BOTH_HEADERS
        );

        expect(groups.map((g) => g.header?.label)).toEqual(["Produce", "Dairy"]);
    });

    it("falls back to a placeholder label when a categorized row has no name", () => {
        const groups = createAisleSectionGroups(
            [item({ id: "a", aisleId: "A1", sectionId: "S1" })],
            BOTH_HEADERS
        );

        expect(groups[0].header?.label).toBe("Unknown Aisle");
        expect(groups[0].children?.[0].header?.label).toBe("Unknown Section");
    });

    it("treats a missing sort order as 0 for a categorized aisle", () => {
        const groups = createAisleSectionGroups(
            [
                item({ id: "a", aisleId: "A1", aisleName: "NoOrder" }),
                item({ id: "b", aisleId: "A2", aisleName: "Explicit", aisleSortOrder: -5 }),
            ],
            BOTH_HEADERS
        );

        expect(groups.map((g) => g.header?.label)).toEqual(["Explicit", "NoOrder"]);
    });

    // A null section is the "loose items in this aisle" bucket — it must not grow a header
    // that reads "Uncategorized" underneath an already-named aisle.
    it("suppresses the header on the null section even when section headers are on", () => {
        const groups = createAisleSectionGroups(
            [item({ id: "a", aisleId: "A1", aisleName: "Produce", sectionId: null })],
            BOTH_HEADERS
        );

        expect(groups[0].children?.[0].header).toBeUndefined();
        expect(groups[0].children?.[0].items.map((i) => i.id)).toEqual(["a"]);
    });

    it("sorts the null section ahead of named sections in the same aisle", () => {
        const groups = createAisleSectionGroups(
            [
                item({
                    id: "a",
                    aisleId: "A1",
                    sectionId: "S1",
                    sectionName: "Fruit",
                    sectionSortOrder: 0,
                }),
                item({ id: "b", aisleId: "A1", sectionId: null }),
            ],
            BOTH_HEADERS
        );

        expect(groups[0].children?.map((c) => c.items[0].id)).toEqual(["b", "a"]);
    });

    it("omits headers entirely when they are switched off", () => {
        const groups = createAisleSectionGroups(
            [
                item({
                    id: "a",
                    aisleId: "A1",
                    sectionId: "S1",
                    aisleName: "Produce",
                    sectionName: "Fruit",
                }),
            ],
            { showAisleHeaders: false, showSectionHeaders: false }
        );

        expect(groups[0].header).toBeUndefined();
        expect(groups[0].children?.[0].header).toBeUndefined();
    });

    it("indents section groups only when section headers are shown", () => {
        const twoSections = [
            item({ id: "a", aisleId: "A1", sectionId: "S1" }),
            item({ id: "b", aisleId: "A1", sectionId: "S2" }),
        ];
        const [withHeaders] = createAisleSectionGroups(twoSections, BOTH_HEADERS);
        const [withoutHeaders] = createAisleSectionGroups(twoSections, {
            showAisleHeaders: true,
            showSectionHeaders: false,
        });

        expect(withHeaders.children?.[0].indentLevel).toBe(16);
        expect(withoutHeaders.children?.[0].indentLevel).toBe(0);
    });

    it("honours a custom section indent", () => {
        const groups = createAisleSectionGroups(
            [
                item({ id: "a", aisleId: "A1", sectionId: "S1" }),
                item({ id: "b", aisleId: "A1", sectionId: "S2" }),
            ],
            { ...BOTH_HEADERS, sectionIndentLevel: 32 }
        );

        expect(groups[0].children?.[0].indentLevel).toBe(32);
    });

    /**
     * Aisle and section sort orders are *not* the same kind of number, which is surprising
     * enough to be worth pinning: an aisle group's `sortOrder` is a running index offset by
     * `sortOrderOffset` (so callers can interleave several group families), while a section
     * group's is the raw `sectionSortOrder` straight off the row.
     */
    it("numbers aisle groups sequentially from the offset, but sections from their raw order", () => {
        const groups = createAisleSectionGroups(
            [
                item({
                    id: "a",
                    aisleId: "A1",
                    aisleSortOrder: 10,
                    sectionId: "S1",
                    sectionSortOrder: 7,
                }),
                item({ id: "b", aisleId: "A2", aisleSortOrder: 20 }),
            ],
            { ...BOTH_HEADERS, sortOrderOffset: 100 }
        );

        expect(groups.map((g) => g.sortOrder)).toEqual([100, 101]);
        expect(groups[0].children?.[0].sortOrder).toBe(7);
    });

    describe("aisle number badge", () => {
        it("moves a number out of the aisle name into the badge", () => {
            const [group] = createAisleSectionGroups(
                [item({ id: "a", aisleId: "A1", aisleName: "Aisle 7: Baking" })],
                BOTH_HEADERS
            );

            expect(group.header?.badge).toBe("7");
            expect(group.header?.label).toBe("Baking");
        });

        // An empty badge still reserves the plate, keeping labels in one column.
        it("gives unnumbered and uncategorized aisles an empty badge", () => {
            const groups = createAisleSectionGroups(
                [
                    item({ id: "a", aisleId: "A1", aisleName: "Produce" }),
                    item({ id: "b", aisleId: null }),
                ],
                BOTH_HEADERS
            );

            expect(groups.map((g) => [g.header?.badge, g.header?.label])).toEqual([
                ["", "Uncategorized"],
                ["", "Produce"],
            ]);
        });
    });

    describe("aisle plate", () => {
        const header = (overrides: Partial<TestItem>) =>
            createAisleSectionGroups(
                [item({ id: "a", aisleId: "A1", ...overrides })],
                BOTH_HEADERS
            )[0].header;

        it("shows the aisle's emoji, with the full name beside it", () => {
            expect(header({ aisleName: "7 - Baking", aisleEmoji: "🥖" })).toMatchObject({
                badge: "🥖",
                badgeKind: "emoji",
                label: "7 - Baking",
            });
        });

        it("shows the number beside a name when there's no emoji", () => {
            expect(header({ aisleName: "7 - Baking" })).toMatchObject({
                badge: "7",
                badgeKind: "code",
                label: "Baking",
            });
        });

        // "Aisle 12" carries nothing but its number: a sign plate reads "AISLE 12" by itself,
        // rather than a "12" plate beside the word ("twelve aisle").
        it("gives a number-only aisle a sign plate and no label", () => {
            expect(header({ aisleName: "Aisle 12" })).toMatchObject({
                badge: "12",
                badgeKind: "sign",
                label: "",
            });
        });

        it("keeps an empty plate for a named aisle without an emoji", () => {
            expect(header({ aisleName: "Produce" })).toMatchObject({
                badge: "",
                badgeKind: "code",
                label: "Produce",
            });
        });

        it("never shows an emoji on the uncategorized group", () => {
            expect(header({ aisleId: null, aisleEmoji: "🥬" })).toMatchObject({
                badge: "",
                label: "Uncategorized",
            });
        });
    });

    // A lone section used to fold into the aisle header; it now keeps its own ruled row so
    // every section reads the same way.
    it("gives an aisle's only section its own header", () => {
        const [group] = createAisleSectionGroups(
            [
                item({ id: "a", aisleId: "A1", sectionId: "S1", sectionName: "Rubber gloves" }),
                item({ id: "b", aisleId: "A1", sectionId: "S1", sectionName: "Rubber gloves" }),
            ],
            BOTH_HEADERS
        );

        expect(group.children).toHaveLength(1);
        expect(group.children?.[0].header?.label).toBe("Rubber gloves");
        expect(group.children?.[0].items.map((i) => i.id)).toEqual(["a", "b"]);
    });

    it("returns nothing for an empty list", () => {
        expect(createAisleSectionGroups([], BOTH_HEADERS)).toEqual([]);
    });
});
