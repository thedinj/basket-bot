/**
 * Bulk shopping list import types and schema
 */

import { z } from "zod";

export const parsedShoppingItemSchema = z.object({
    name: z.string(),
    quantity: z.number().nullable(),
    unit: z.string().nullable(),
    notes: z.string().nullable(),
});

export const bulkImportResponseSchema = z.object({
    items: z.array(parsedShoppingItemSchema),
});

export type ParsedShoppingItem = z.infer<typeof parsedShoppingItemSchema>;
export type BulkImportResponse = z.infer<typeof bulkImportResponseSchema>;
