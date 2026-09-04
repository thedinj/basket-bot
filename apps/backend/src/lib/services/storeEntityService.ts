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
import { AuthorizationError, ConflictError } from "@basket-bot/core";
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

// ========== Aisle Operations ==========

export function createAisle(params: { storeId: string; name: string; userId: string }): StoreAisle {
    verifyStoreAccess(params.storeId, params.userId);

    const nameNorm = normalizeItemName(params.name);
    const conflict = aisleRepo.findAisleByNameNorm(params.storeId, nameNorm, "");
    if (conflict) {
        throw new ConflictError(
            `An aisle named "${conflict.name}" already exists in this store.`,
            "AISLE_NAME_CONFLICT"
        );
    }

    const maxOrder = aisleRepo.getMaxSortOrder(params.storeId);

    return aisleRepo.createAisle({
        storeId: params.storeId,
        name: params.name,
        sortOrder: maxOrder + 1,
        createdById: params.userId,
    });
}

export function getAislesByStore(storeId: string, userId: string): StoreAisle[] {
    verifyStoreAccess(storeId, userId);
    return aisleRepo.getAislesByStore(storeId);
}

export function updateAisle(params: {
    id: string;
    storeId: string;
    name: string;
    userId: string;
}): StoreAisle | null {
    verifyStoreAccess(params.storeId, params.userId);

    const nameNorm = normalizeItemName(params.name);
    const conflict = aisleRepo.findAisleByNameNorm(params.storeId, nameNorm, params.id);
    if (conflict) {
        throw new ConflictError(
            `An aisle named "${conflict.name}" already exists in this store.`,
            "AISLE_NAME_CONFLICT"
        );
    }

    return aisleRepo.updateAisle({
        id: params.id,
        name: params.name,
        updatedById: params.userId,
    });
}

export function updateAisleSortOrder(params: {
    id: string;
    storeId: string;
    sortOrder: number;
    userId: string;
}): StoreAisle | null {
    verifyStoreAccess(params.storeId, params.userId);

    return aisleRepo.updateAisleSortOrder({
        id: params.id,
        sortOrder: params.sortOrder,
        updatedById: params.userId,
    });
}

export function reorderAisles(params: {
    storeId: string;
    updates: Array<{ id: string; sortOrder: number }>;
    userId: string;
}): void {
    verifyStoreAccess(params.storeId, params.userId);
    aisleRepo.reorderAisles(params.updates);
}

export function deleteAisle(id: string, storeId: string, userId: string): boolean {
    verifyStoreAccess(storeId, userId);
    return aisleRepo.deleteAisle(id);
}

// ========== Section Operations ==========

export function createSection(params: {
    storeId: string;
    aisleId: string;
    name: string;
    userId: string;
}): StoreSection {
    verifyStoreAccess(params.storeId, params.userId);

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

    return sectionRepo.createSection({
        storeId: params.storeId,
        aisleId: params.aisleId,
        name: params.name,
        sortOrder: maxOrder + 1,
        createdById: params.userId,
    });
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

    if (params.name !== undefined || params.aisleId !== undefined) {
        const existing = sectionRepo.getSectionById(params.id);
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

    return sectionRepo.updateSection({
        id: params.id,
        name: params.name,
        aisleId: params.aisleId,
        updatedById: params.userId,
    });
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

    return sectionRepo.updateSectionLocation({
        id: params.id,
        aisleId: params.aisleId,
        sortOrder: params.sortOrder,
        updatedById: params.userId,
    });
}

export function reorderSections(params: {
    storeId: string;
    updates: Array<{ id: string; sortOrder: number }>;
    userId: string;
}): void {
    verifyStoreAccess(params.storeId, params.userId);
    sectionRepo.reorderSections(params.updates);
}

export function deleteSection(id: string, storeId: string, userId: string): boolean {
    verifyStoreAccess(storeId, userId);
    return sectionRepo.deleteSection(id);
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

    const nameNorm = normalizeItemName(params.name);
    const conflict = itemRepo.findItemByNameNorm(params.storeId, nameNorm, "");
    if (conflict) {
        throw new ConflictError(
            `An item named "${conflict.name}" already exists in this store.`,
            "ITEM_NAME_CONFLICT"
        );
    }

    return itemRepo.createItem({
        storeId: params.storeId,
        name: params.name,
        aisleId: params.aisleId ?? null,
        sectionId: params.sectionId ?? null,
        createdById: params.userId,
    });
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

export function toggleItemFavorite(id: string, storeId: string, userId: string): StoreItem | null {
    verifyStoreAccess(storeId, userId);
    return itemRepo.toggleItemFavorite(id, userId);
}

export function deleteItem(id: string, storeId: string, userId: string): boolean {
    verifyStoreAccess(storeId, userId);
    return itemRepo.deleteItem(id);
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

    return itemRepo.getOrCreateStoreItemByName({
        storeId: params.storeId,
        name: params.name,
        aisleId: params.aisleId,
        sectionId: params.sectionId,
        createdById: params.userId,
    });
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

    return shoppingListRepo.upsertShoppingListItem({
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
}

export function toggleShoppingListItemChecked(
    id: string,
    isChecked: boolean,
    storeId: string,
    userId: string
): CheckConflictResult {
    verifyStoreAccess(storeId, userId);
    return shoppingListRepo.toggleShoppingListItemChecked(id, isChecked, userId);
}

/**
 * Remove a shopping list item (does NOT delete the store item)
 */
export function removeShoppingListItem(id: string, storeId: string, userId: string): void {
    verifyStoreAccess(storeId, userId);
    shoppingListRepo.removeShoppingListItem(id, userId);
}

/**
 * Delete a shopping list item AND its associated store item
 */
export function deleteShoppingListItem(id: string, storeId: string, userId: string): boolean {
    verifyStoreAccess(storeId, userId);
    return shoppingListRepo.deleteShoppingListItem(id, userId);
}

export function clearCheckedShoppingListItems(storeId: string, userId: string): number {
    verifyStoreAccess(storeId, userId);
    return shoppingListRepo.clearCheckedShoppingListItems(storeId, userId);
}
