import { z } from "zod";
import { MAX_EMAIL_LENGTH, MAX_TOKEN_LENGTH } from "../constants";
import { userSchema } from "./user";

// Auth schemas
export const loginRequestSchema = z.object({
    email: z
        .string()
        .email()
        .max(MAX_EMAIL_LENGTH, { message: `Email must be ${MAX_EMAIL_LENGTH} characters or less` }),
    password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Login response uses a lighter version of user without timestamps
export const loginUserSchema = userSchema.omit({ createdAt: true, updatedAt: true });

export type LoginUser = z.infer<typeof loginUserSchema>;

export const loginResponseSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: loginUserSchema,
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshTokenRequestSchema = z.object({
    refreshToken: z
        .string()
        .max(MAX_TOKEN_LENGTH, { message: `Token must be ${MAX_TOKEN_LENGTH} characters or less` }),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

export const refreshTokenResponseSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
});

export type RefreshTokenResponse = z.infer<typeof refreshTokenResponseSchema>;

export const jwtPayloadSchema = z.object({
    sub: z.string().uuid(), // user id
    email: z
        .string()
        .email()
        .max(MAX_EMAIL_LENGTH, { message: `Email must be ${MAX_EMAIL_LENGTH} characters or less` })
        .optional(),
    scopes: z.array(z.string()),
    iat: z.number(),
    exp: z.number(),
    iss: z.string().optional(),
    aud: z.string().optional(),
});

export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
