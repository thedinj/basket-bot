import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/auth/rateLimiter";
import { db } from "@/lib/db/db";
import { loginRequestSchema, LoginResponse } from "@basket-bot/core";
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

        // Find user
        const user = db.prepare("SELECT * FROM User WHERE email = ?").get(email) as any;
        if (!user) {
            return NextResponse.json(
                { code: "AUTHENTICATION_FAILED", message: "Invalid credentials" },
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            return NextResponse.json(
                { code: "AUTHENTICATION_FAILED", message: "Invalid credentials" },
                { status: 401 }
            );
        }

        // Parse scopes
        const scopes = user.scopes ? user.scopes.split(",").filter(Boolean) : [];

        // Generate tokens
        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
            scopes,
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
                scopes,
            },
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}
