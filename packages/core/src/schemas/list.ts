import { z } from "zod";

// List schemas
export const listSchema = z.object({
    id: z.string().uuid(),
    householdId: z.string().uuid(),
    name: z.string().min(1),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type List = z.infer<typeof listSchema>;

export const listItemSchema = z.object({
    id: z.string().uuid(),
    listId: z.string().uuid(),
    name: z.string().min(1),
    quantity: z.number().int().positive().optional(),
    unit: z.string().optional(),
    checked: z.boolean().default(false),
    notes: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type ListItem = z.infer<typeof listItemSchema>;

export const createListRequestSchema = z.object({
    householdId: z.string().uuid(),
    name: z.string().min(1),
});

export type CreateListRequest = z.infer<typeof createListRequestSchema>;

export const updateListRequestSchema = z.object({
    name: z.string().min(1).optional(),
});

export type UpdateListRequest = z.infer<typeof updateListRequestSchema>;

export const createListItemRequestSchema = z.object({
    name: z.string().min(1),
    quantity: z.number().int().positive().optional(),
    unit: z.string().optional(),
    notes: z.string().optional(),
});

export type CreateListItemRequest = z.infer<typeof createListItemRequestSchema>;

export const updateListItemRequestSchema = z.object({
    name: z.string().min(1).optional(),
    quantity: z.number().int().positive().optional().nullable(),
    unit: z.string().optional().nullable(),
    checked: z.boolean().optional(),
    notes: z.string().optional().nullable(),
});

export type UpdateListItemRequest = z.infer<typeof updateListItemRequestSchema>;
