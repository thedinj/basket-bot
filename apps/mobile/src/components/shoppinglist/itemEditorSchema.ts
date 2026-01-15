import type { StoreAisle, StoreItem, StoreSection } from "@basket-bot/core";
import { z } from "zod";

export const itemFormSchema = z
    .object({
        name: z.string().transform((val) => val.trim()),
        qty: z.number().min(0.01, "Quantity must be greater than 0").nullable().optional(),
        unitId: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        aisleId: z.string().nullable().optional(),
        sectionId: z.string().nullable().optional(),
        isSample: z.boolean().nullable().optional(),
        isIdea: z.boolean().optional(),
        snoozedUntil: z.string().nullable().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.isIdea) {
            // Idea requires notes
            if (!data.notes || data.notes.trim().length === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Note is required for an Idea.",
                    path: ["notes"],
                });
            }
        } else {
            // Regular item requires name
            if (!data.name || data.name.trim().length === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Name is required.",
                    path: ["name"],
                });
            }
        }
    });

export type ItemFormData = z.infer<typeof itemFormSchema>;

export type Aisle = Pick<StoreAisle, "id" | "name">;

export type Section = Pick<StoreSection, "id" | "name" | "aisleId">;

export type AutocompleteItem = Pick<StoreItem, "id" | "name" | "aisleId" | "sectionId">;
