import type {
    CheckConflictResult,
    ShoppingListItem,
    ShoppingListItemInput,
    ShoppingListItemWithDetails,
    StoreAisle,
    StoreItem,
    StoreItemWithDetails,
    StoreSection,
} from "@basket-bot/core";
import {
    AuthorizationError,
    ConflictError,
    isSingleEmoji,
    NotFoundError,
    ValidationError,
} from "@basket-bot/core";
import { publishStoreChange } from "../realtime/storeEvents";
import * as aisleRepo from "../repos/aisleRepo";
import * as itemRepo from "../repos/itemRepo";
import * as sectionRepo from "../repos/sectionRepo";
import { normalizeItemName } from "../utils/stringUtils";
import * as shoppingListRepo from "../repos/shoppingListRepo";
import * as storeRepo from "../repos/storeRepo";

/**
 * Service layer for Store-related entity operations (aisles, sections, items, shopping list).
 * Enforces authorization: user must have access to the store.
 */

function verifyStoreAccess(storeId: string, userId: string): void {
    if (!storeRepo.userHasAccessToStore(userId, storeId)) {
        // Message text kept identical to the previous plain Error so routes that
        // still string-match `error.message === "Access denied"` keep working.
        throw new AuthorizationError("Access denied");
    }
}

/**
 * Rejects an aisle/section/item id that exists but belongs to a different store than the URL's.
 * Reported as a 404 — the same as a missing row — so the caller learns nothing about another
 * store's contents. A row that doesn't exist at all is left to each operation's existing
 * behaviour (usually `null`/`false`, which the route turns into a 404 or an idempotent success).
 */
function assertRowInStore(row: { storeId: string } | null, storeId: string, what: string): void {
    if (row && row.storeId !== storeId) {
        throw new NotFoundError(`${what} not found`);
    }
}

/**
 * Requires a loaded row to exist and belong to `storeId`. Missing and foreign rows are the same
 * 404, so an id from another store can't be probed or written through this one. Used both for
 * the row a request acts on and for foreign keys supplied in its body.
 */
function requireRowInStore<T extends { storeId: string }>(
    row: T | null,
    storeId: string,
    what: string
): T {
    if (!row || row.storeId !== storeId) {
        throw new NotFoundError(`${what} not found`);
    }
    return row;
}

function getListItemInStore(id: string, storeId: string): ShoppingListItem {
    return requireRowInStore(
        shoppingListRepo.getShoppingListItemById(id),
        storeId,
        "Shopping list item"
    );
}

/** A body-supplied aisle id (the target of a section or item) must be one of this store's. */
function requireAisleInStore(aisleId: string, storeId: string): StoreAisle {
    return requireRowInStore(aisleRepo.getAisleById(aisleId), storeId, "Aisle");
}

/**
 * Validates an item location from a request body before it is written. Each non-null id must be
 * this store's (404 otherwise). When both are given, the section's aisle is authoritative — the
 * item's own `aisleId` is stored as NULL — so an `aisleId` that contradicts the section is a
 * malformed request rather than something to silently discard.
 */
function assertItemLocationInStore(
    storeId: string,
    aisleId: string | null | undefined,
    sectionId: string | null | undefined
): void {
    if (aisleId) requireAisleInStore(aisleId, storeId);
    if (sectionId) {
        const section = requireRowInStore(
            sectionRepo.getSectionById(sectionId),
            storeId,
            "Section"
        );
        if (aisleId && section.aisleId !== aisleId) {
            throw new ValidationError("Section does not belong to the given aisle");
        }
    }
}

/** Keeps only the `{ id }` updates whose row is one of `ownIds` (the store's own rows). */
function onlyOwnRows<T extends { id: string }>(updates: T[], ownIds: Iterable<string>): T[] {
    const own = new Set(ownIds);
    return updates.filter((update) => own.has(update.id));
}

// ========== Aisle Operations ==========

/**
 * Normalizes a request's `emoji`: undefined stays undefined (leave unchanged), null or blank
 * clears it, anything else must be exactly one emoji.
 */
function parseAisleEmoji(emoji: unknown): string | null | undefined {
    if (emoji === undefined) return undefined;
    if (emoji === null || (typeof emoji === "string" && emoji.trim() === "")) return null;
    if (typeof emoji !== "string" || !isSingleEmoji(emoji)) {
        throw new ValidationError("Aisle emoji must be a single emoji");
    }
    return emoji.trim();
}

export function createAisle(params: {
    storeId: string;
    name: string;
    emoji?: unknown;
    userId: string;
}): StoreAisle {
    verifyStoreAccess(params.storeId, params.userId);

    const nameNorm = normalizeItemName(params.name);
    const conflict = aisleRepo.findAisleByNameNorm(params.storeId, nameNorm, "");
    if (conflict) {
        throw new ConflictError(
            `An aisle named "${conflict.name}" already exists in this store.`,
            "AISLE_NAME_CONFLICT"
        );
    }

    const emoji = parseAisleEmoji(params.emoji);
    const maxOrder = aisleRepo.getMaxSortOrder(params.storeId);

    const aisle = aisleRepo.createAisle({
        storeId: params.storeId,
        name: params.name,
        emoji: emoji ?? null,
        sortOrder: maxOrder + 1,
        createdById: params.userId,
    });
    publishStoreChange([aisle.storeId], "layout");
    return aisle;
}

export function getAislesByStore(storeId: string, userId: string): StoreAisle[] {
    verifyStoreAccess(storeId, userId);
    return aisleRepo.getAislesByStore(storeId);
}

export function updateAisle(params: {
    id: string;
    storeId: string;
    name: string;
    /** Omitted: unchanged. Null or blank: cleared. */
    emoji?: unknown;
    userId: string;
}): StoreAisle | null {
    verifyStoreAccess(params.storeId, params.userId);
    assertRowInStore(aisleRepo.getAisleById(params.id), params.storeId, "Aisle");

    const nameNorm = normalizeItemName(params.name);
    const conflict = aisleRepo.findAisleByNameNorm(params.storeId, nameNorm, params.id);
    if (conflict) {
        throw new ConflictError(
            `An aisle named "${conflict.name}" already exists in this store.`,
            "AISLE_NAME_CONFLICT"
        );
    }

    const aisle = aisleRepo.updateAisle({
        id: params.id,
        name: params.name,
        emoji: parseAisleEmoji(params.emoji),
        updatedById: params.userId,
    });
    if (aisle) publishStoreChange([aisle.storeId], "layout");
    return aisle;
}

export function updateAisleSortOrder(params: {
    id: string;
    storeId: string;
    sortOrder: number;
    userId: string;
}): StoreAisle | null {
    verifyStoreAccess(params.storeId, params.userId);
    assertRowInStore(aisleRepo.getAisleById(params.id), params.storeId, "Aisle");

    const aisle = aisleRepo.updateAisleSortOrder({
        id: params.id,
        sortOrder: params.sortOrder,
        updatedById: params.userId,
    });
    if (aisle) publishStoreChange([aisle.storeId], "layout");
    return aisle;
}

export function reorderAisles(params: {
    storeId: string;
    updates: Array<{ id: string; sortOrder: number }>;
    userId: string;
}): void {
    verifyStoreAccess(params.storeId, params.userId);
    // Ids from another store are dropped rather than renumbered through this one.
    const updates = onlyOwnRows(
        params.updates,
        aisleRepo.getAislesByStore(params.storeId).map((aisle) => aisle.id)
    );
    if (updates.length === 0) return;
    aisleRepo.reorderAisles(updates);
    publishStoreChange([params.storeId], "layout");
}

export function deleteAisle(id: string, storeId: string, userId: string): boolean {
    verifyStoreAccess(storeId, userId);
    const existing = aisleRepo.getAisleById(id);
    assertRowInStore(existing, storeId, "Aisle");
    const deleted = aisleRepo.deleteAisle(id);
    if (deleted && existing) publishStoreChange([existing.storeId], "layout");
    return deleted;
}

// ========== Section Operations ==========

export function createSection(params: {
    storeId: string;
    aisleId: string;
    name: string;
    userId: string;
}): StoreSection {
    verifyStoreAccess(params.storeId, params.userId);
    requireAisleInStore(params.aisleId, params.storeId);

    const nameNorm = normalizeItemName(params.name);
    const conflict = sectionRepo.findSectionByNameNorm(
        params.storeId,
        params.aisleId,
        nameNorm,
        ""
    );
    if (conflict) {
        throw new ConflictError(
            `A section named "${conflict.name}" already exists in this aisle.`,
            "SECTION_NAME_CONFLICT"
        );
    }

    const maxOrder = sectionRepo.getMaxSortOrder(params.aisleId);

    const section = sectionRepo.createSection({
        storeId: params.storeId,
        aisleId: params.aisleId,
        name: params.name,
        sortOrder: maxOrder + 1,
        createdById: params.userId,
    });
    publishStoreChange([section.storeId], "layout");
    return section;
}

export function getSectionsByStore(storeId: string, userId: string): StoreSection[] {
    verifyStoreAccess(storeId, userId);
    return sectionRepo.getSectionsByStore(storeId);
}

export function updateSection(params: {
    id: string;
    storeId: string;
    name?: string;
    aisleId?: string;
    userId: string;
}): StoreSection | null {
    verifyStoreAccess(params.storeId, params.userId);
    const existing = sectionRepo.getSectionById(params.id);
    assertRowInStore(existing, params.storeId, "Section");
    if (params.aisleId !== undefined) requireAisleInStore(params.aisleId, params.storeId);

    if (params.name !== undefined || params.aisleId !== undefined) {
        const nameNorm = normalizeItemName(params.name ?? existing?.name ?? "");
        const aisleId = params.aisleId ?? existing?.aisleId ?? "";
        const conflict = sectionRepo.findSectionByNameNorm(
            params.storeId,
            aisleId,
            nameNorm,
            params.id
        );
        if (conflict) {
            throw new ConflictError(
                `A section named "${conflict.name}" already exists in this aisle.`,
                "SECTION_NAME_CONFLICT"
            );
        }
    }

    const section = sectionRepo.updateSection({
        id: params.id,
        name: params.name,
        aisleId: params.aisleId,
        updatedById: params.userId,
    });
    if (section) publishStoreChange([section.storeId], "layout");
    return section;
}

export function updateSectionLocation(params: {
    id: string;
    storeId: string;
    aisleId: string;
    sortOrder: number;
    userId: string;
}): StoreSection | null {
    verifyStoreAccess(params.storeId, params.userId);

    const existing = sectionRepo.getSectionById(params.id);
    assertRowInStore(existing, params.storeId, "Section");
    requireAisleInStore(params.aisleId, params.storeId);
    if (existing) {
        const conflict = sectionRepo.findSectionByNameNorm(
            params.storeId,
            params.aisleId,
            existing.nameNorm,
            params.id
        );
        if (conflict) {
            throw new ConflictError(
                `A section named "${conflict.name}" already exists in this aisle.`,
                "SECTION_NAME_CONFLICT"
            );
        }
    }

    const section = sectionRepo.updateSectionLocation({
        id: params.id,
        aisleId: params.aisleId,
        sortOrder: params.sortOrder,
        updatedById: params.userId,
    });
    if (section) publishStoreChange([section.storeId], "layout");
    return section;
}

export function reorderSections(params: {
    storeId: string;
    updates: Array<{ id: string; sortOrder: number }>;
    userId: string;
}): void {
    verifyStoreAccess(params.storeId, params.userId);
    // Ids from another store are dropped rather than renumbered through this one.
    const updates = onlyOwnRows(
        params.updates,
        sectionRepo.getSectionsByStore(params.storeId).map((section) => section.id)
    );
    if (updates.length === 0) return;
    sectionRepo.reorderSections(updates);
    publishStoreChange([params.storeId], "layout");
}

export function deleteSection(id: string, storeId: string, userId: string): boolean {
    verifyStoreAccess(storeId, userId);
    const existing = sectionRepo.getSectionById(id);
    assertRowInStore(existing, storeId, "Section");
    const deleted = sectionRepo.deleteSection(id);
    if (deleted && existing) publishStoreChange([existing.storeId], "layout");
    return deleted;
}

// ========== Item Operations ==========

export function createItem(params: {
    storeId: string;
    name: string;
    aisleId?: string | null;
    sectionId?: string | null;
    userId: string;
}): StoreItem {
    verifyStoreAccess(params.storeId, params.userId);
    assertItemLocationInStore(params.storeId, params.aisleId, params.sectionId);

    const nameNorm = normalizeItemName(params.name);
    const conflict = itemRepo.findItemByNameNorm(params.storeId, nameNorm, "");
    if (conflict) {
        throw new ConflictError(
            `An item named "${conflict.name}" already exists in this store.`,
            "ITEM_NAME_CONFLICT"
        );
    }

    const item = itemRepo.createItem({
        storeId: params.storeId,
        name: params.name,
        aisleId: params.aisleId ?? null,
        sectionId: params.sectionId ?? null,
        createdById: params.userId,
    });
    publishStoreChange([item.storeId], "layout");
    return item;
}

export function getItemsByStore(storeId: string, userId: string): StoreItem[] {
    verifyStoreAccess(storeId, userId);
    return itemRepo.getItemsByStore(storeId);
}

export function getItemsByStoreWithDetails(
    storeId: string,
    userId: string
): StoreItemWithDetails[] {
    verifyStoreAccess(storeId, userId);
    return itemRepo.getItemsByStoreWithDetails(storeId);
}

export function updateItem(params: {
    id: string;
    storeId: string;
    name: string;
    aisleId?: string | null;
    sectionId?: string | null;
    userId: string;
}): StoreItem | null {
    verifyStoreAccess(params.storeId, params.userId);
    assertRowInStore(itemRepo.getItemById(params.id), params.storeId, "Item");
    // Checked even though a rename onto an existing name merges and ignores the location: a
    // request naming another store's aisle or section is refused either way.
    assertItemLocationInStore(params.storeId, params.aisleId, params.sectionId);

    const item = applyItemUpdate(params);
    if (item) publishStoreChange([item.storeId], "layout");
    return item;
}

/** `updateItem` minus the access check and the event, shared with `mergeItems`. */
function applyItemUpdate(params: {
    id: string;
    storeId: string;
    name: string;
    aisleId?: string | null;
    sectionId?: string | null;
    userId: string;
}): StoreItem | null {
    const nameNorm = normalizeItemName(params.name);
    const conflict = itemRepo.findItemByNameNorm(params.storeId, nameNorm, params.id);
    if (conflict) {
        // The rename collides with an existing item — merge into it rather than blocking.
        // mergeItemInto already reconciles name/location/stats, so nothing further to apply here;
        // reapplying params.aisleId/sectionId would incorrectly overwrite the winner's location
        // with whatever the edit form happened to show for the item being renamed (the loser).
        return itemRepo.mergeItemInto(params.id, conflict.id);
    }

    return itemRepo.updateItem({
        id: params.id,
        name: params.name,
        aisleId: params.aisleId ?? null,
        sectionId: params.sectionId ?? null,
        updatedById: params.userId,
    });
}

/**
 * Folds `loserId` into `intoItemId` and returns the survivor.
 *
 * This is the front door to `itemRepo.mergeItemInto`, which until now was only reachable as a
 * side effect of renaming an item onto an existing name (see `updateItem`). Auto-Locate's
 * duplicate detection needs to merge two items whose names stay different ("Shredded mozzarella"
 * vs "Mozzarella, shredded"), and it needs to pick which name survives — neither of which the
 * rename path can express.
 *
 * `canonicalName` is applied through `updateItem`, so renaming the survivor onto yet a third
 * item's name merges that one in too rather than violating `UNIQUE (storeId, nameNorm)`.
 */
export function mergeItems(params: {
    loserId: string;
    intoItemId: string;
    storeId: string;
    canonicalName?: string;
    userId: string;
}): StoreItem {
    verifyStoreAccess(params.storeId, params.userId);

    if (params.loserId === params.intoItemId) {
        throw new ValidationError("An item cannot be merged into itself");
    }

    const loser = itemRepo.getItemById(params.loserId);
    const winner = itemRepo.getItemById(params.intoItemId);

    if (!loser || loser.storeId !== params.storeId) {
        throw new NotFoundError("Item not found");
    }
    if (!winner || winner.storeId !== params.storeId) {
        throw new NotFoundError("Item to merge into not found");
    }

    const merged = itemRepo.mergeItemInto(params.loserId, params.intoItemId);
    if (!merged) {
        throw new NotFoundError("Item not found");
    }

    if (!params.canonicalName || normalizeItemName(params.canonicalName) === merged.nameNorm) {
        publishStoreChange([merged.storeId], "layout");
        return merged;
    }

    // The survivor keeps its own location — a rename must not move it.
    const renamed = applyItemUpdate({
        id: merged.id,
        storeId: params.storeId,
        name: params.canonicalName,
        aisleId: merged.aisleId,
        sectionId: merged.sectionId,
        userId: params.userId,
    });

    const survivor = renamed ?? merged;
    publishStoreChange([survivor.storeId], "layout");
    return survivor;
}

export function toggleItemFavorite(id: string, storeId: string, userId: string): StoreItem | null {
    verifyStoreAccess(storeId, userId);
    assertRowInStore(itemRepo.getItemById(id), storeId, "Item");
    const item = itemRepo.toggleItemFavorite(id, userId);
    if (item) publishStoreChange([item.storeId], "layout");
    return item;
}

export function deleteItem(id: string, storeId: string, userId: string): boolean {
    verifyStoreAccess(storeId, userId);
    const existing = itemRepo.getItemById(id);
    assertRowInStore(existing, storeId, "Item");
    const deleted = itemRepo.deleteItem(id);
    // Deleting a store item cascades to the list rows that pointed at it; "layout" refetches both.
    if (deleted && existing) publishStoreChange([existing.storeId], "layout");
    return deleted;
}

/** Items nobody has categorized, favorited, or placed on any list — the obliteration preview. */
export function getOrphanItems(storeId: string, userId: string): StoreItem[] {
    verifyStoreAccess(storeId, userId);
    return itemRepo.getOrphanItems(storeId);
}

export function deleteOrphanItems(
    storeId: string,
    itemIds: string[],
    userId: string
): { deletedCount: number; skippedCount: number } {
    verifyStoreAccess(storeId, userId);
    const deletedCount = itemRepo.deleteOrphanItems(storeId, itemIds);
    if (deletedCount > 0) publishStoreChange([storeId], "layout");
    return { deletedCount, skippedCount: itemIds.length - deletedCount };
}

export function searchStoreItems(
    storeId: string,
    searchTerm: string,
    userId: string,
    limit?: number
): StoreItem[] {
    verifyStoreAccess(storeId, userId);
    return itemRepo.searchStoreItems(storeId, searchTerm, limit);
}

export function getOrCreateStoreItemByName(params: {
    storeId: string;
    name: string;
    aisleId?: string | null;
    sectionId?: string | null;
    userId: string;
}): StoreItem {
    verifyStoreAccess(params.storeId, params.userId);
    assertItemLocationInStore(params.storeId, params.aisleId, params.sectionId);

    const item = itemRepo.getOrCreateStoreItemByName({
        storeId: params.storeId,
        name: params.name,
        aisleId: params.aisleId,
        sectionId: params.sectionId,
        createdById: params.userId,
    });
    // Either a new item or a moved one: both change what the list groups and labels by.
    publishStoreChange([item.storeId], "layout");
    return item;
}

// ========== Shopping List Operations ==========

export function getShoppingListItems(
    storeId: string,
    userId: string
): ShoppingListItemWithDetails[] {
    verifyStoreAccess(storeId, userId);
    return shoppingListRepo.getShoppingListItems(storeId, userId);
}

export function upsertShoppingListItem(
    params: ShoppingListItemInput & { userId: string }
): ShoppingListItem {
    verifyStoreAccess(params.storeId, params.userId);
    if (params.id) {
        // The update branch acts on the id alone; it must not reach into another store's list.
        getListItemInStore(params.id, params.storeId);
    }
    // The row may only point at this store's catalogue. Ideas carry no store item (the repo nulls
    // it), so a stray id on one is dropped rather than refused. The input's `aisleId`/`sectionId`
    // are not written by this operation, so they are not checked here.
    if (params.storeItemId && params.isIdea !== true) {
        requireRowInStore(itemRepo.getItemById(params.storeItemId), params.storeId, "Item");
    }

    const item = shoppingListRepo.upsertShoppingListItem({
        id: params.id,
        storeId: params.storeId,
        storeItemId: params.storeItemId ?? null,
        qty: params.qty ?? null,
        unitId: params.unitId ?? null,
        notes: params.notes ?? null,
        isChecked: params.isChecked ?? false,
        isIdea: params.isIdea === true,
        isSample: params.isSample ?? null,
        isUnsure: params.isUnsure ?? null,
        isPrivate: params.isPrivate ?? null,
        snoozedUntil: params.snoozedUntil ?? null,
        userId: params.userId,
    });
    publishStoreChange([item.storeId], "list");
    return item;
}

export function toggleShoppingListItemChecked(
    id: string,
    isChecked: boolean,
    storeId: string,
    userId: string
): CheckConflictResult {
    verifyStoreAccess(storeId, userId);
    const row = getListItemInStore(id, storeId);
    const result = shoppingListRepo.toggleShoppingListItemChecked(id, isChecked, userId);
    // A conflict means someone else already checked it and nothing was written.
    if (!result.conflict) publishStoreChange([row.storeId], "list");
    return result;
}

/**
 * Remove a shopping list item (does NOT delete the store item)
 */
export function removeShoppingListItem(id: string, storeId: string, userId: string): void {
    verifyStoreAccess(storeId, userId);
    const row = getListItemInStore(id, storeId);
    shoppingListRepo.removeShoppingListItem(id, userId);
    publishStoreChange([row.storeId], "list");
}

/**
 * Delete a shopping list item AND its associated store item
 */
export function deleteShoppingListItem(id: string, storeId: string, userId: string): boolean {
    verifyStoreAccess(storeId, userId);
    const row = getListItemInStore(id, storeId);
    const deleted = shoppingListRepo.deleteShoppingListItem(id, userId);
    // The store item goes too, so this is a catalogue change as well as a list change; "layout"
    // refetches both (it is a superset of "list" on the client).
    if (deleted) publishStoreChange([row.storeId], row.storeItemId ? "layout" : "list");
    return deleted;
}

export function clearCheckedShoppingListItems(storeId: string, userId: string): number {
    verifyStoreAccess(storeId, userId);
    const cleared = shoppingListRepo.clearCheckedShoppingListItems(storeId, userId);
    if (cleared > 0) publishStoreChange([storeId], "list");
    return cleared;
}
