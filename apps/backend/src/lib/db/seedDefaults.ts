import { randomUUID } from "crypto";
import { normalizeItemName } from "../utils/stringUtils";
import { db } from "./db";

// Aisles seeded for a new user's example store, in display order.
const DEFAULT_AISLES = [
    "Deli",
    "Bakery",
    "Produce",
    "Aisle 1",
    "Aisle 2",
    "Dairy & Eggs",
    "Frozen Foods",
    "Wine, Beer, and Liquor",
] as const;

// Sections seeded under a given aisle, in display order.
const DEFAULT_SECTIONS: ReadonlyArray<{ aisle: string; name: string }> = [
    { aisle: "Aisle 1", name: "Canned Goods" },
    { aisle: "Aisle 1", name: "Pasta & Grains" },
];

/**
 * Sample items, each also placed on the shopping list. `location` puts the item under either an
 * aisle or a section — matching the app's rule that an item has one or the other, never both.
 */
const DEFAULT_ITEMS: ReadonlyArray<{
    name: string;
    location: { aisle: string } | { section: string };
    qty: number | null;
    unit: string | null;
    notes: string | null;
}> = [
    {
        name: "Bananas",
        location: { aisle: "Produce" },
        qty: 1,
        unit: "bunch",
        notes: "Ripe, not green",
    },
    { name: "French Bread", location: { aisle: "Bakery" }, qty: null, unit: null, notes: null },
    {
        name: "Penne Pasta",
        location: { section: "Pasta & Grains" },
        qty: null,
        unit: null,
        notes: null,
    },
    { name: "Milk", location: { aisle: "Dairy & Eggs" }, qty: 1, unit: "gallon", notes: null },
];

/**
 * Creates a default store with sample data for a user.
 * Used during user registration to provide an example store with realistic data.
 *
 * Runs in a single transaction: a partial failure here previously left the caller with a
 * committed User row, an empty Store, and a registration that reported failure to the client.
 *
 * @param userId - The ID of the user who will own the store
 * @param userName - The name of the user (used to generate store name)
 * @returns The ID of the created store
 */
export const createDefaultStoreForUser = (userId: string, userName: string): string =>
    db.transaction(() => {
        const storeId = randomUUID();

        // Create the store (private by default, householdId = NULL)
        db.prepare(
            `
        INSERT INTO Store (id, name, householdId, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, NULL, ?, ?, datetime('now'), datetime('now'))
    `
        ).run(storeId, `${userName}'s Example Store`, userId, userId);

        // nameNorm is NOT NULL and carries the UNIQUE(storeId, ...) constraint. It must be
        // derived with the same normalizeItemName() the aisle/section repos use, or seeded rows
        // won't collide-check consistently with ones created through the app.
        const insertAisle = db.prepare(
            `
        INSERT INTO StoreAisle (id, storeId, name, nameNorm, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
        );

        const aisleIdsByName = new Map<string, string>();
        DEFAULT_AISLES.forEach((name, sortOrder) => {
            const id = randomUUID();
            insertAisle.run(id, storeId, name, normalizeItemName(name), sortOrder, userId, userId);
            aisleIdsByName.set(name, id);
        });

        const insertSection = db.prepare(
            `
        INSERT INTO StoreSection (id, storeId, aisleId, name, nameNorm, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
        );

        const sectionIdsByName = new Map<string, string>();
        DEFAULT_SECTIONS.forEach(({ aisle, name }, sortOrder) => {
            const id = randomUUID();
            insertSection.run(
                id,
                storeId,
                aisleIdsByName.get(aisle),
                name,
                normalizeItemName(name),
                sortOrder,
                userId,
                userId
            );
            sectionIdsByName.set(name, id);
        });

        const insertItem = db.prepare(
            `
        INSERT INTO StoreItem (id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), ?, ?, datetime('now'), datetime('now'))
    `
        );

        const insertListItem = db.prepare(
            `
        INSERT INTO ShoppingListItem (id, storeId, storeItemId, qty, unitId, notes, isSample, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))
    `
        );

        for (const { name, location, qty, unit, notes } of DEFAULT_ITEMS) {
            const itemId = randomUUID();
            const aisleId =
                "aisle" in location ? (aisleIdsByName.get(location.aisle) ?? null) : null;
            const sectionId =
                "section" in location ? (sectionIdsByName.get(location.section) ?? null) : null;

            insertItem.run(
                itemId,
                storeId,
                name,
                normalizeItemName(name),
                aisleId,
                sectionId,
                userId,
                userId
            );

            insertListItem.run(randomUUID(), storeId, itemId, qty, unit, notes, userId, userId);
        }

        return storeId;
    })();
