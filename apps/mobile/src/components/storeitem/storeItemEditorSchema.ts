import { z } from "zod";

export const storeItemEditorSchema = z.object({
    name: z
        .string()
        .min(1, "Name is required")
        .transform((val) => val.trim()),
    aisleId: z.string().nullable().optional(),
    sectionId: z.string().nullable().optional(),
});

export type StoreItemFormData = z.infer<typeof storeItemEditorSchema>;
