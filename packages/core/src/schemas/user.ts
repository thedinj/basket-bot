import { z } from "zod";

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
    password: z.string().min(8),
});

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const updateUserRequestSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
});

export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
