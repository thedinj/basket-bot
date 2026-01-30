import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "../constants/index.js";

// Reusable password validation schema
export const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH, {
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
});

// Reusable password with confirmation schema
export const passwordWithConfirmationSchema = z
    .object({
        password: passwordSchema,
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    });

// User schemas
export const userSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().min(1),
    scopes: z.array(z.string()),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type User = z.infer<typeof userSchema>;

export const createUserRequestSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    password: passwordSchema,
    invitationCode: z.string().optional(),
});

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

// Profile update (name only, email is view-only)
export const updateProfileRequestSchema = z.object({
    name: z.string().min(1, "Name is required"),
});

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const updateProfileResponseSchema = userSchema;

export type UpdateProfileResponse = z.infer<typeof updateProfileResponseSchema>;

// Password change
export const changePasswordRequestSchema = z
    .object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: passwordSchema,
        confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    });

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const changePasswordResponseSchema = z.object({
    success: z.boolean(),
});

export type ChangePasswordResponse = z.infer<typeof changePasswordResponseSchema>;
