import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/auth/rateLimiter";
import { db } from "@/lib/db/db";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as userRepo from "@/lib/repos/userRepo";
import { AuthenticationError, loginRequestSchema, LoginResponse } from "@basket-bot/core";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    // Rate limit: 5 attempts per 15 minutes
    const rateLimitResponse = await checkRateLimit(req, 5, 15 * 60 * 1000);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const body = await req.json();
        const { email, password } = loginRequestSchema.parse(body);

        // Case-insensitive by way of the repo, matching how registration checks for duplicates.
        // A raw case-sensitive lookup here used to lock people out of accounts registered with
        // any capitalization.
        const credentials = userRepo.getUserWithPasswordByEmail(email);

        // Same message whether the address is unknown or the password is wrong, so the response
        // can't be used to enumerate registered addresses.
        if (!credentials || !(await verifyPassword(password, credentials.passwordHash))) {
            throw new AuthenticationError("Invalid credentials");
        }

        const { user } = credentials;

        // Generate tokens
        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
            scopes: user.scopes,
        });
        const refreshToken = generateRefreshToken();

        // Store refresh token
        const tokenId = randomUUID();
        const expiresAt = getRefreshTokenExpiry();
        db.prepare(
            `
            INSERT INTO RefreshToken (id, userId, token, expiresAt, createdAt)
            VALUES (?, ?, ?, ?, datetime('now'))
        `
        ).run(tokenId, user.id, refreshToken, expiresAt.toISOString());

        const response: LoginResponse = {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                scopes: user.scopes,
            },
        };

        return NextResponse.json(response);
    } catch (error) {
        return toErrorResponse(error, req);
    }
}
