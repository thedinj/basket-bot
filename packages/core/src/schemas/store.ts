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

// ========== StoreAisle / StoreSection reordering ==========
const reorderItemsSchema = z.object({
    updates: z.array(
        z.object({
            id: z.string().uuid(),
            sortOrder: z.number().int().min(0),
        })
    ),
});

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

export const reorderStoreAislesRequestSchema = reorderItemsSchema;
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

export const reorderStoreSectionsRequestSchema = reorderItemsSchema;
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

export const searchStoreItemsRequestSchema = z.object({
    storeId: z.string().uuid(),
    searchTerm: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional().default(10),
});

export type SearchStoreItemsRequest = z.infer<typeof searchStoreItemsRequestSchema>;

// ========== ShoppingListItem ==========
// Shopping list item is a superset of store item with additional shopping-specific fields

// Shopping context fields that extend the base catalog item
const shoppingContextFields = {
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
    ...shoppingContextFields,
    ...auditFields,
});

export type ShoppingListItem = z.infer<typeof shoppingListItemSchema>;

// Shopping list item with details (includes store item and location details)
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

// ========== Client-Side Input Schemas ==========
// These schemas are used by the mobile app for local database operations
// Server-controlled fields (createdById, updatedById, createdAt, updatedAt) are excluded

const serverControlledFields = ["createdById", "updatedById", "createdAt", "updatedAt"] as const;

// ========== Store Item Input Schemas ==========

// Base schema (no transforms/refines) - used for API request schemas
const storeItemInputBaseSchema = z.object({
    id: z.string().uuid().optional(),
    storeId: z.string().uuid(),
    name: z.string().optional(),
    aisleId: z.string().uuid().nullable().optional(),
    sectionId: z.string().uuid().nullable().optional(),
});

// Form schema with validation and transforms
export const storeItemInputSchema = z
    .object({
        id: z.string().uuid().optional(),
        storeId: z.string().uuid(),
        name: z
            .string()
            .transform((val) => val.trim())
            .optional(),
        aisleId: z.string().uuid().nullable().optional(),
        sectionId: z.string().uuid().nullable().optional(),
    })
    .refine((data) => !data.name || data.name.trim().length > 0, {
        message: "Name cannot be empty.",
        path: ["name"],
    });

export type StoreItemInput = z.infer<typeof storeItemInputSchema>;

// ========== Shopping List Item Input Schemas ==========

// Base schema (no transforms/refines) - used for API request schemas
const shoppingListItemInputBaseSchema = z.object({
    id: z.string().uuid().optional(),
    storeId: z.string().uuid(),
    name: z.string().optional(),
    aisleId: z.string().uuid().nullable().optional(),
    sectionId: z.string().uuid().nullable().optional(),
    storeItemId: z.string().uuid().nullable().optional(),
    qty: z.number().min(0.01).nullable().optional(),
    unitId: z.string().nullable().optional(),
    isChecked: z.boolean().optional(),
    isIdea: z.boolean().nullable().optional(),
    isSample: z.boolean().nullable().optional(),
    isUnsure: z.boolean().nullable().optional(),
    snoozedUntil: z.string().datetime().nullable().optional(),
});

// Form schema with validation and transforms
export const shoppingListItemInputSchema = z
    .object({
        id: z.string().uuid().optional(),
        storeId: z.string().uuid(),
        name: z
            .string()
            .transform((val) => val.trim())
            .optional(),
        aisleId: z.string().uuid().nullable().optional(),
        sectionId: z.string().uuid().nullable().optional(),
        storeItemId: z.string().uuid().nullable().optional(),
        qty: z.number().min(0.01).nullable().optional(),
        unitId: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        isChecked: z.boolean().optional(),
        isIdea: z.boolean().nullable().optional(),
        isSample: z.boolean().nullable().optional(),
        isUnsure: z.boolean().nullable().optional(),
        snoozedUntil: z.string().datetime().nullable().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.isIdea) {
            // Ideas require notes
            if (!data.notes || data.notes.trim().length === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Note is required for an Idea.",
                    path: ["notes"],
                });
            }
        } else {
            // Regular items require either name OR storeItemId
            const hasName = data.name && data.name.trim().length > 0;
            const hasStoreItemId = data.storeItemId;

            if (!hasName && !hasStoreItemId) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Name or store item reference is required.",
                    path: ["name"],
                });
            }
        }

        // Quantity validation
        if (data.qty !== null && data.qty !== undefined) {
            if (data.qty <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Quantity must be greater than 0.",
                    path: ["qty"],
                });
            }
        }
    });

export type ShoppingListItemInput = z.infer<typeof shoppingListItemInputSchema>;

// Form data type aliases (for UI components)
export type ItemFormData = ShoppingListItemInput;
export type StoreItemFormData = StoreItemInput;

// Legacy type exports (for backward compatibility)
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

// ========== Request Schemas (for API endpoints) ==========
// Request schemas use base schemas without refinements to allow omit/partial operations

// Store Item requests
export const createStoreItemRequestSchema = storeItemInputBaseSchema.omit({ id: true });

export type CreateStoreItemRequest = z.infer<typeof createStoreItemRequestSchema>;

export const updateStoreItemRequestSchema = storeItemInputBaseSchema
    .partial()
    .omit({ id: true, storeId: true });

export type UpdateStoreItemRequest = z.infer<typeof updateStoreItemRequestSchema>;

// Shopping List Item requests
export const createShoppingListItemRequestSchema = shoppingListItemInputBaseSchema.omit({
    id: true,
});

export type CreateShoppingListItemRequest = z.infer<typeof createShoppingListItemRequestSchema>;

export const updateShoppingListItemRequestSchema = shoppingListItemInputBaseSchema
    .partial()
    .omit({ id: true, storeId: true });

export type UpdateShoppingListItemRequest = z.infer<typeof updateShoppingListItemRequestSchema>;

export const toggleShoppingListItemCheckedRequestSchema = z.object({
    isChecked: z.boolean(),
});

export type ToggleShoppingListItemCheckedRequest = z.infer<
    typeof toggleShoppingListItemCheckedRequestSchema
>;
