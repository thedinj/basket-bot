import { z } from "zod";

export const themeModeSchema = z.enum(["system", "light", "dark"]);
export type ThemeMode = z.infer<typeof themeModeSchema>;

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
    themeMode: themeModeSchema.optional(),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;
