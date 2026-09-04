import { ValidationError } from "@basket-bot/core";
import { beforeEach, describe, expect, it } from "vitest";
import { seedAisle, seedSection, seedStore, seedUser } from "../../../test/support/fixtures";
import { resetDb } from "../../../test/support/resetDb";
import { countTemplateSections, getStoreTemplate, STORE_TEMPLATES } from "../data/storeTemplates";
import { db } from "../db/db";
import { normalizeItemName } from "../utils/stringUtils";
import * as storeService from "./storeService";

/**
 * Covers store creation from a template — the path that also backs a new user's example
 * store — plus the transactional guarantee that a store never lands half-seeded.
 */

let owner: string;

beforeEach(() => {
    resetDb();
    owner = seedUser({ name: "Owner" });
});

const aislesOf = (storeId: string) =>
    db
        .prepare(
            `SELECT id, name, nameNorm, sortOrder FROM StoreAisle WHERE storeId = ? ORDER BY sortOrder`
        )
        .all(storeId) as Array<{ id: string; name: string; nameNorm: string; sortOrder: number }>;

const sectionsOf = (storeId: string) =>
    db
        .prepare(
            `SELECT id, aisleId, name, nameNorm, sortOrder FROM StoreSection WHERE storeId = ?`
        )
        .all(storeId) as Array<{
        id: string;
        aisleId: string;
        name: string;
        nameNorm: string;
        sortOrder: number;
    }>;

describe("createStore with a template", () => {
    it("creates an empty store when no template is given", () => {
        const store = storeService.createStore({ name: "Corner Market", userId: owner });

        expect(store.name).toBe("Corner Market");
        expect(aislesOf(store.id)).toHaveLength(0);
        expect(sectionsOf(store.id)).toHaveLength(0);
    });

    it("treats the blank template the same as no template", () => {
        const store = storeService.createStore({
            name: "Empty",
            userId: owner,
            templateId: "blank",
        });

        expect(aislesOf(store.id)).toHaveLength(0);
    });

    it("seeds the grocery layout in template order with normalized names", () => {
        const template = getStoreTemplate("grocery")!;
        const store = storeService.createStore({
            name: "Festival",
            userId: owner,
            templateId: "grocery",
        });

        const aisles = aislesOf(store.id);
        expect(aisles.map((a) => a.name)).toEqual(template.aisles.map((a) => a.name));
        expect(aisles.map((a) => a.sortOrder)).toEqual(template.aisles.map((_, i) => i));
        for (const aisle of aisles) {
            expect(aisle.nameNorm).toBe(normalizeItemName(aisle.name));
        }

        const sections = sectionsOf(store.id);
        expect(sections).toHaveLength(countTemplateSections(template));

        // Each section hangs off its own aisle, numbered from 0 within that aisle.
        const aisleIdsByName = new Map(aisles.map((a) => [a.name, a.id]));
        for (const templateAisle of template.aisles) {
            const expected = templateAisle.sections ?? [];
            const actual = sections
                .filter((s) => s.aisleId === aisleIdsByName.get(templateAisle.name))
                .sort((a, b) => a.sortOrder - b.sortOrder);

            expect(actual.map((s) => s.name)).toEqual([...expected]);
            expect(actual.map((s) => s.sortOrder)).toEqual(expected.map((_, i) => i));
            for (const section of actual) {
                expect(section.nameNorm).toBe(normalizeItemName(section.name));
            }
        }
    });

    it("does not seed sample items for a user-created store", () => {
        const store = storeService.createStore({
            name: "Festival",
            userId: owner,
            templateId: "grocery",
        });

        const itemCount = db
            .prepare(`SELECT COUNT(*) AS n FROM StoreItem WHERE storeId = ?`)
            .get(store.id) as { n: number };
        expect(itemCount.n).toBe(0);
    });

    it("rejects an unknown template without creating anything", () => {
        expect(() =>
            storeService.createStore({ name: "Nope", userId: owner, templateId: "hardware" })
        ).toThrow(ValidationError);

        const stores = db.prepare(`SELECT COUNT(*) AS n FROM Store`).get() as { n: number };
        expect(stores.n).toBe(0);
    });

    it("rolls the store back when seeding fails partway", () => {
        // A user id that violates the createdById foreign key makes the aisle inserts fail
        // after the Store row is written — exactly the partial-failure case the transaction
        // exists to prevent.
        expect(() =>
            storeService.createStore({
                name: "Doomed",
                userId: "missing-user",
                templateId: "grocery",
            })
        ).toThrow();

        const stores = db.prepare(`SELECT COUNT(*) AS n FROM Store`).get() as { n: number };
        expect(stores.n).toBe(0);
    });
});

describe("createDefaultStoreForNewUser", () => {
    it("seeds the grocery layout plus sample items on the shopping list", () => {
        const template = getStoreTemplate("grocery")!;
        const storeId = storeService.createDefaultStoreForNewUser(owner, "Ada");

        const store = db.prepare(`SELECT name FROM Store WHERE id = ?`).get(storeId) as {
            name: string;
        };
        expect(store.name).toBe("Ada's Example Store");
        expect(aislesOf(storeId)).toHaveLength(template.aisles.length);

        const items = db
            .prepare(`SELECT id, name, aisleId, sectionId FROM StoreItem WHERE storeId = ?`)
            .all(storeId) as Array<{
            id: string;
            name: string;
            aisleId: string | null;
            sectionId: string | null;
        }>;

        expect(items.map((i) => i.name).sort()).toEqual(
            template.sampleItems.map((i) => i.name).sort()
        );

        // An item is filed under an aisle or a section, never both and never neither.
        for (const item of items) {
            expect(Boolean(item.aisleId) !== Boolean(item.sectionId)).toBe(true);
        }

        const listItems = db
            .prepare(`SELECT storeItemId, isSample FROM ShoppingListItem WHERE storeId = ?`)
            .all(storeId) as Array<{ storeItemId: string; isSample: number | null }>;

        expect(listItems).toHaveLength(template.sampleItems.length);
        expect(listItems.every((row) => row.isSample === 1)).toBe(true);
        expect(listItems.map((row) => row.storeItemId).sort()).toEqual(
            items.map((i) => i.id).sort()
        );
    });

    it("references only real quantity units", () => {
        // unitId is a QuantityUnit foreign key, not a display label ("pound", not "lb"), so a
        // typo here would fail the sample-item insert for every new registration.
        const unitIds = new Set(
            (db.prepare(`SELECT id FROM QuantityUnit`).all() as Array<{ id: string }>).map(
                (row) => row.id
            )
        );

        for (const template of STORE_TEMPLATES) {
            for (const sample of template.sampleItems) {
                if (sample.unitId) expect(unitIds, sample.name).toContain(sample.unitId);
            }
        }
    });
});

describe("duplicateStore", () => {
    /**
     * Regression: the aisle and section inserts omitted `nameNorm`, which is NOT NULL on both
     * tables, so duplicating any store that had a layout failed outright.
     */
    it("copies aisles and sections, carrying their normalized names", () => {
        const source = storeService.createStore({
            name: "Source",
            userId: owner,
            templateId: "grocery",
        });

        const copy = storeService.duplicateStore({
            sourceStoreId: source.id,
            newStoreName: "Copy",
            userId: owner,
            includeItems: false,
        });

        const sourceAisles = aislesOf(source.id);
        const copiedAisles = aislesOf(copy.id);

        expect(copiedAisles.map((a) => a.name)).toEqual(sourceAisles.map((a) => a.name));
        for (const aisle of copiedAisles) {
            expect(aisle.nameNorm).toBe(normalizeItemName(aisle.name));
        }

        const copiedSections = sectionsOf(copy.id);
        expect(copiedSections).toHaveLength(sectionsOf(source.id).length);
        for (const section of copiedSections) {
            expect(section.nameNorm).toBe(normalizeItemName(section.name));
        }
    });

    it("copies a hand-built store's sections too", () => {
        const storeId = seedStore({ ownerId: owner, name: "Manual" });
        const aisleId = seedAisle({ storeId, ownerId: owner, name: "Aisle 1" });
        seedSection({ storeId, aisleId, ownerId: owner, name: "Canned Goods" });

        const copy = storeService.duplicateStore({
            sourceStoreId: storeId,
            newStoreName: "Manual Copy",
            userId: owner,
            includeItems: false,
        });

        expect(sectionsOf(copy.id).map((s) => s.name)).toEqual(["Canned Goods"]);
    });
});
