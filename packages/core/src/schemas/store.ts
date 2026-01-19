import { z } from "zod";

// ========== Shared Fields ==========
// Audit fields used across multiple schemas
const auditFields = {
    createdById: z.string().uuid(),
    updatedById: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
};

// ========== AppSetting ==========
export const appSettingSchema = z.object({
    key: z.string(),
    value: z.string(),
    updatedAt: z.string().datetime(),
});

export type AppSetting = z.infer<typeof appSettingSchema>;

// ========== QuantityUnit ==========
export const quantityUnitSchema = z.object({
    id: z.string(),
    name: z.string(),
    abbreviation: z.string(),
    sortOrder: z.number().int(),
    category: z.string(),
});

export type QuantityUnit = z.infer<typeof quantityUnitSchema>;

// ========== Store ==========
export const storeSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    ...auditFields,
});

export type Store = z.infer<typeof storeSchema>;

export const createStoreRequestSchema = z.object({
    name: z.string().min(1).max(100),
});

export type CreateStoreRequest = z.infer<typeof createStoreRequestSchema>;

export const updateStoreRequestSchema = z.object({
    name: z.string().min(1).max(100),
});

export type UpdateStoreRequest = z.infer<typeof updateStoreRequestSchema>;

// ========== StoreCollaborator ==========
export const storeCollaboratorRoleSchema = z.enum(["owner", "editor"]);

export type StoreCollaboratorRole = z.infer<typeof storeCollaboratorRoleSchema>;

export const storeCollaboratorSchema = z.object({
    id: z.string().uuid(),
    storeId: z.string().uuid(),
    userId: z.string().uuid(),
    role: storeCollaboratorRoleSchema,
    createdAt: z.string().datetime(),
});

export type StoreCollaborator = z.infer<typeof storeCollaboratorSchema>;

export const storeCollaboratorDetailSchema = storeCollaboratorSchema.extend({
    userEmail: z.string().email(),
    userName: z.string(),
});

export type StoreCollaboratorDetail = z.infer<typeof storeCollaboratorDetailSchema>;

export const createStoreCollaboratorRequestSchema = z.object({
    email: z.string().email(),
    role: storeCollaboratorRoleSchema,
});

export type CreateStoreCollaboratorRequest = z.infer<typeof createStoreCollaboratorRequestSchema>;

export const updateStoreCollaboratorRequestSchema = z.object({
    role: storeCollaboratorRoleSchema,
});

export type UpdateStoreCollaboratorRequest = z.infer<typeof updateStoreCollaboratorRequestSchema>;

// ========== StoreInvitation ==========
export const storeInvitationStatusSchema = z.enum(["pending", "accepted"]);

export type StoreInvitationStatus = z.infer<typeof storeInvitationStatusSchema>;

export const storeInvitationSchema = z.object({
    id: z.string().uuid(),
    storeId: z.string().uuid(),
    invitedEmail: z.string().email(),
    invitedById: z.string().uuid(),
    role: storeCollaboratorRoleSchema,
    token: z.string().uuid(),
    status: storeInvitationStatusSchema,
    createdAt: z.string().datetime(),
});

export type StoreInvitation = z.infer<typeof storeInvitationSchema>;

export const storeInvitationDetailSchema = storeInvitationSchema.extend({
    inviterName: z.string(),
    inviterEmail: z.string().email(),
    storeName: z.string(),
});

export type StoreInvitationDetail = z.infer<typeof storeInvitationDetailSchema>;

export const createStoreInvitationRequestSchema = z.object({
    email: z.string().email(),
    role: storeCollaboratorRoleSchema,
});

export type CreateStoreInvitationRequest = z.infer<typeof createStoreInvitationRequestSchema>;

// ========== StoreAisle ==========
export const storeAisleSchema = z.object({
    id: z.string().uuid(),
    storeId: z.string().uuid(),
    name: z.string().min(1),
    sortOrder: z.number().int().min(0),
    ...auditFields,
});

export type StoreAisle = z.infer<typeof storeAisleSchema>;

export const createStoreAisleRequestSchema = z.object({
    storeId: z.string().uuid(),
    name: z.string().min(1).max(100),
});

export type CreateStoreAisleRequest = z.infer<typeof createStoreAisleRequestSchema>;

export const updateStoreAisleRequestSchema = z.object({
    name: z.string().min(1).max(100),
});

export type UpdateStoreAisleRequest = z.infer<typeof updateStoreAisleRequestSchema>;

export const reorderStoreAislesRequestSchema = z.object({
    updates: z.array(
        z.object({
            id: z.string().uuid(),
            sortOrder: z.number().int().min(0),
        })
    ),
});

export type ReorderStoreAislesRequest = z.infer<typeof reorderStoreAislesRequestSchema>;

// ========== StoreSection ==========
export const storeSectionSchema = z.object({
    id: z.string().uuid(),
    storeId: z.string().uuid(),
    aisleId: z.string().uuid(),
    name: z.string().min(1),
    sortOrder: z.number().int().min(0),
    ...auditFields,
});

export type StoreSection = z.infer<typeof storeSectionSchema>;

export const createStoreSectionRequestSchema = z.object({
    storeId: z.string().uuid(),
    aisleId: z.string().uuid(),
    name: z.string().min(1).max(100),
});

export type CreateStoreSectionRequest = z.infer<typeof createStoreSectionRequestSchema>;

export const updateStoreSectionRequestSchema = z.object({
    name: z.string().min(1).max(100),
    aisleId: z.string().uuid(),
});

export type UpdateStoreSectionRequest = z.infer<typeof updateStoreSectionRequestSchema>;

export const reorderStoreSectionsRequestSchema = z.object({
    updates: z.array(
        z.object({
            id: z.string().uuid(),
            sortOrder: z.number().int().min(0),
        })
    ),
});

export type ReorderStoreSectionsRequest = z.infer<typeof reorderStoreSectionsRequestSchema>;

// ========== StoreItem ==========
export const storeItemSchema = z.object({
    id: z.string().uuid(),
    storeId: z.string().uuid(),
    name: z.string().min(1),
    nameNorm: z.string().min(1),
    aisleId: z.string().uuid().nullable(),
    sectionId: z.string().uuid().nullable(),
    usageCount: z.number().int().min(0),
    lastUsedAt: z.string().datetime().nullable(),
    isHidden: z.boolean(),
    isFavorite: z.boolean(),
    ...auditFields,
});

export type StoreItem = z.infer<typeof storeItemSchema>;

export const storeItemWithDetailsSchema = storeItemSchema.extend({
    sectionName: z.string().nullable(),
    sectionSortOrder: z.number().int().nullable(),
    aisleName: z.string().nullable(),
    aisleSortOrder: z.number().int().nullable(),
});

export type StoreItemWithDetails = z.infer<typeof storeItemWithDetailsSchema>;

export const createStoreItemRequestSchema = z.object({
    storeId: z.string().uuid(),
    name: z.string().min(1).max(200),
    aisleId: z.string().uuid().optional().nullable(),
    sectionId: z.string().uuid().optional().nullable(),
});

export type CreateStoreItemRequest = z.infer<typeof createStoreItemRequestSchema>;

export const updateStoreItemRequestSchema = z.object({
    name: z.string().min(1).max(200),
    aisleId: z.string().uuid().optional().nullable(),
    sectionId: z.string().uuid().optional().nullable(),
});

export type UpdateStoreItemRequest = z.infer<typeof updateStoreItemRequestSchema>;

export const searchStoreItemsRequestSchema = z.object({
    storeId: z.string().uuid(),
    searchTerm: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional().default(10),
});

export type SearchStoreItemsRequest = z.infer<typeof searchStoreItemsRequestSchema>;

// ========== ShoppingListItem ==========
// Shopping list item is a superset of store item with additional shopping-specific fields

// Base shopping list item fields (used for composition)
const shoppingListItemBaseFields = {
    storeItemId: z.string().uuid().nullable(),
    qty: z.number().nullable(),
    unitId: z.string().nullable(),
    notes: z.string().nullable(),
    isChecked: z.boolean(),
    checkedAt: z.string().datetime().nullable(),
    isSample: z.boolean().nullable(),
    isUnsure: z.boolean().nullable(),
    isIdea: z.boolean(),
    snoozedUntil: z.string().datetime().nullable(),
};

export const shoppingListItemSchema = z.object({
    id: z.string().uuid(),
    storeId: z.string().uuid(),
    ...shoppingListItemBaseFields,
    ...auditFields,
});

export type ShoppingListItem = z.infer<typeof shoppingListItemSchema>;

// Shopping list item with details extends storeItemWithDetails structure
export const shoppingListItemWithDetailsSchema = shoppingListItemSchema.extend({
    itemName: z.string().nullable(),
    unitAbbreviation: z.string().nullable(),
    sectionId: z.string().uuid().nullable(),
    aisleId: z.string().uuid().nullable(),
    sectionName: z.string().nullable(),
    sectionSortOrder: z.number().int().nullable(),
    aisleName: z.string().nullable(),
    aisleSortOrder: z.number().int().nullable(),
});

export type ShoppingListItemWithDetails = z.infer<typeof shoppingListItemWithDetailsSchema>;

// ========== Client-Side Input Types (for mobile database operations) ==========
// These types exclude server-controlled fields: createdById, updatedById, createdAt, updatedAt
// The mobile client should never send these values; the backend calculates them based on JWT and server time

const serverControlledFields = ["createdById", "updatedById", "createdAt", "updatedAt"] as const;

export type StoreInput = Omit<Store, "id" | (typeof serverControlledFields)[number]> & {
    id?: string;
};

export type StoreAisleInput = Omit<StoreAisle, "id" | (typeof serverControlledFields)[number]> & {
    id?: string;
};

export type StoreSectionInput = Omit<
    StoreSection,
    "id" | (typeof serverControlledFields)[number]
> & {
    id?: string;
};

export type StoreItemInput = Omit<
    StoreItem,
    "id" | (typeof serverControlledFields)[number] | "nameNorm" | "usageCount" | "lastUsedAt"
> & {
    id?: string;
};

export const shoppingListItemInputSchema = z
    .object({
        id: z.string().uuid().optional(),
        storeId: z.string().uuid(),
        storeItemId: shoppingListItemBaseFields.storeItemId.optional(),
        qty: shoppingListItemBaseFields.qty.optional(),
        unitId: shoppingListItemBaseFields.unitId.optional(),
        notes: shoppingListItemBaseFields.notes.optional(),
        isChecked: shoppingListItemBaseFields.isChecked.optional().default(false),
        isIdea: shoppingListItemBaseFields.isIdea.optional().default(false),
        isSample: shoppingListItemBaseFields.isSample.optional().default(null),
        isUnsure: shoppingListItemBaseFields.isUnsure.optional().default(null),
        snoozedUntil: shoppingListItemBaseFields.snoozedUntil.optional(),
        // name is only used for ideas (when storeItemId is null)
        name: z.string().optional(),
    })
    .refine(
        (data) => {
            // If it's an idea (storeItemId is null/undefined), name must be provided
            if ((data.storeItemId === null || data.storeItemId === undefined) && data.isIdea) {
                return data.name !== undefined && data.name.trim().length > 0;
            }
            // If it's not an idea, storeItemId must be provided
            if (!data.isIdea) {
                return data.storeItemId !== null && data.storeItemId !== undefined;
            }
            return true;
        },
        {
            message: "Ideas require 'name' field; regular items require 'storeItemId'",
        }
    );

export type ShoppingListItemInput = {
    id?: string;
    storeId: string;
    storeItemId?: string | null;
    qty?: number | null;
    unitId?: string | null;
    notes?: string | null;
    isChecked?: boolean;
    isIdea?: boolean;
    isSample?: boolean | null;
    isUnsure?: boolean | null;
    snoozedUntil?: string | null;
    name?: string; // Only for ideas
};

// Request schemas derive from base fields
export const createShoppingListItemRequestSchema = z.object({
    storeId: z.string().uuid(),
    storeItemId: shoppingListItemBaseFields.storeItemId.optional(),
    qty: shoppingListItemBaseFields.qty.optional(),
    unitId: shoppingListItemBaseFields.unitId.optional(),
    notes: z.string().max(500).nullable().optional(),
    isIdea: shoppingListItemBaseFields.isIdea.optional().default(false),
    snoozedUntil: shoppingListItemBaseFields.snoozedUntil.optional(),
});

export type CreateShoppingListItemRequest = z.infer<typeof createShoppingListItemRequestSchema>;

export const updateShoppingListItemRequestSchema = z.object({
    storeItemId: shoppingListItemBaseFields.storeItemId.optional(),
    qty: shoppingListItemBaseFields.qty.optional(),
    unitId: shoppingListItemBaseFields.unitId.optional(),
    notes: z.string().max(500).nullable().optional(),
    isIdea: shoppingListItemBaseFields.isIdea.optional(),
    snoozedUntil: shoppingListItemBaseFields.snoozedUntil.optional(),
});

export type UpdateShoppingListItemRequest = z.infer<typeof updateShoppingListItemRequestSchema>;

export const toggleShoppingListItemCheckedRequestSchema = z.object({
    isChecked: z.boolean(),
});

export type ToggleShoppingListItemCheckedRequest = z.infer<
    typeof toggleShoppingListItemCheckedRequestSchema
>;
