import { z } from "zod";

// URL validation helper
const urlSchema = z
    .string()
    .optional()
    .refine(
        (val) => {
            if (!val || val.trim() === "") return true;
            try {
                const url = new URL(val);
                return url.protocol === "http:" || url.protocol === "https:";
            } catch {
                return false;
            }
        },
        { message: "Must be a valid HTTP or HTTPS URL" }
    );

export const settingsSchema = z.object({
    openaiApiKey: z.string().optional(),
    remoteApiUrl: urlSchema,
});

export type SettingsFormData = z.infer<typeof settingsSchema>;
