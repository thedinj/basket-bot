import { z } from "zod";

// Auth schemas
export const loginRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        name: z.string(),
        scopes: z.array(z.string()),
    }),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshTokenRequestSchema = z.object({
    refreshToken: z.string(),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

export const refreshTokenResponseSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
});

export type RefreshTokenResponse = z.infer<typeof refreshTokenResponseSchema>;

export const jwtPayloadSchema = z.object({
    sub: z.string().uuid(), // user id
    email: z.string().email().optional(),
    scopes: z.array(z.string()),
    iat: z.number(),
    exp: z.number(),
    iss: z.string().optional(),
    aud: z.string().optional(),
});

export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
