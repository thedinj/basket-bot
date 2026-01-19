import type {
    ShoppingListItem,
    ShoppingListItemInput,
    ShoppingListItemWithDetails,
    StoreAisle,
    StoreItem,
    StoreItemWithDetails,
    StoreSection,
} from "@basket-bot/core";
import * as aisleRepo from "../repos/aisleRepo";
import * as itemRepo from "../repos/itemRepo";
import * as sectionRepo from "../repos/sectionRepo";
import * as shoppingListRepo from "../repos/shoppingListRepo";
import * as storeRepo from "../repos/storeRepo";

/**
 * Service layer for Store-related entity operations (aisles, sections, items, shopping list).
 * Enforces authorization: user must have access to the store.
 */

function verifyStoreAccess(storeId: string, userId: string): void {
    if (!storeRepo.userHasAccessToStore(userId, storeId)) {
        throw new Error("Access denied");
    }
}

// ========== Aisle Operations ==========

export function createAisle(params: { storeId: string; name: string; userId: string }): StoreAisle {
    verifyStoreAccess(params.storeId, params.userId);

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

    return aisleRepo.updateAisle({
        id: params.id,
        name: params.name,
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
    name: string;
    aisleId: string;
    userId: string;
}): StoreSection | null {
    verifyStoreAccess(params.storeId, params.userId);

    return sectionRepo.updateSection({
        id: params.id,
        name: params.name,
        aisleId: params.aisleId,
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
    return shoppingListRepo.getShoppingListItems(storeId);
}

export function upsertShoppingListItem(
    params: ShoppingListItemInput & { userId: string }
): ShoppingListItem {
    verifyStoreAccess(params.storeId, params.userId);

    return shoppingListRepo.upsertShoppingListItem({
        id: params.id,
        storeId: params.storeId,
        storeItemId: params.storeItemId,
        qty: params.qty,
        unitId: params.unitId,
        notes: params.notes,
        isChecked: params.isChecked,
        isIdea: params.isIdea,
        isSample: params.isSample,
        isUnsure: params.isUnsure,
        snoozedUntil: params.snoozedUntil,
        userId: params.userId,
    });
}

export function toggleShoppingListItemChecked(
    id: string,
    isChecked: boolean,
    storeId: string,
    userId: string
): void {
    verifyStoreAccess(storeId, userId);
    shoppingListRepo.toggleShoppingListItemChecked(id, isChecked, userId);
}

/**
 * Remove a shopping list item (does NOT delete the store item)
 */
export function removeShoppingListItem(id: string, storeId: string, userId: string): boolean {
    verifyStoreAccess(storeId, userId);
    return shoppingListRepo.removeShoppingListItem(id);
}

/**
 * Delete a shopping list item AND its associated store item
 */
export function deleteShoppingListItem(id: string, storeId: string, userId: string): boolean {
    verifyStoreAccess(storeId, userId);
    return shoppingListRepo.deleteShoppingListItem(id);
}

export function clearCheckedShoppingListItems(storeId: string, userId: string): number {
    verifyStoreAccess(storeId, userId);
    return shoppingListRepo.clearCheckedShoppingListItems(storeId);
}
