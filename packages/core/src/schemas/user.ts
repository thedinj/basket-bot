import { z } from "zod";
import {
    MAX_EMAIL_LENGTH,
    MAX_NAME_LENGTH,
    MAX_PASSWORD_HASH_LENGTH,
    MIN_PASSWORD_LENGTH,
} from "../constants/index.js";
import { minMaxLengthString } from "./zodHelpers.js";

// Reusable password validation schema
export const passwordSchema = minMaxLengthString(
    MIN_PASSWORD_LENGTH,
    MAX_PASSWORD_HASH_LENGTH,
    "Password"
);

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
    email: z
        .string()
        .email()
        .max(MAX_EMAIL_LENGTH, { message: `Email must be ${MAX_EMAIL_LENGTH} characters or less` }),
    name: minMaxLengthString(1, MAX_NAME_LENGTH, "Name"),
    scopes: z.array(z.string()),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type User = z.infer<typeof userSchema>;

export const createUserRequestSchema = z.object({
    email: z
        .string()
        .email()
        .max(MAX_EMAIL_LENGTH, { message: `Email must be ${MAX_EMAIL_LENGTH} characters or less` }),
    name: minMaxLengthString(1, MAX_NAME_LENGTH, "Name"),
    password: passwordSchema,
    invitationCode: z.string().optional(),
});

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

// Profile update (name only, email is view-only)
export const updateProfileRequestSchema = z.object({
    name: minMaxLengthString(1, MAX_NAME_LENGTH, "Name"),
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
