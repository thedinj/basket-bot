import { z } from "zod";

export const settingsSchema = z.object({
    openaiApiKey: z.string().optional(),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;
