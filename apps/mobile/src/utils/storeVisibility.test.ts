import type { Store } from "@basket-bot/core";
import { describe, expect, it } from "vitest";
import { filterVisibleStores } from "./storeVisibility";

const makeStore = (overrides: Partial<Store> & { id: string }): Store =>
    ({ name: `Store ${overrides.id}`, isHidden: null, ...overrides }) as Store;

const visible = makeStore({ id: "visible" });
const hidden = makeStore({ id: "hidden", isHidden: true });

describe("filterVisibleStores", () => {
    it("returns an empty array while the query is still loading", () => {
        expect(filterVisibleStores(undefined)).toEqual([]);
    });

    it("drops hidden stores by default", () => {
        expect(filterVisibleStores([visible, hidden]).map((s) => s.id)).toEqual(["visible"]);
    });

    it("keeps a hidden store when it is the current selection", () => {
        const result = filterVisibleStores([visible, hidden], { keepStoreId: "hidden" });
        expect(result.map((s) => s.id)).toEqual(["visible", "hidden"]);
    });

    it("drops excluded stores even when they are visible", () => {
        const result = filterVisibleStores([visible, hidden], { excludeStoreIds: ["visible"] });
        expect(result).toEqual([]);
    });

    // Pins the precedence: exclusion is checked first, so "don't offer this store as a
    // destination" wins over "keep the current selection visible".
    it("lets excludeStoreIds win over keepStoreId for the same store", () => {
        const result = filterVisibleStores([visible, hidden], {
            keepStoreId: "hidden",
            excludeStoreIds: ["hidden"],
        });
        expect(result.map((s) => s.id)).toEqual(["visible"]);
    });
});
