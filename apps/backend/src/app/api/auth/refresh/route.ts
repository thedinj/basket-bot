import { generateAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db/db";
import { LoginResponse, refreshTokenRequestSchema } from "@basket-bot/core";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { refreshToken } = refreshTokenRequestSchema.parse(body);

        // Find refresh token
        const tokenRow = db
            .prepare(
                `SELECT rt.id, rt.userId, rt.expiresAt, u.id as userId, u.email, u.name, u.scopes
                 FROM RefreshToken rt
                 JOIN User u ON rt.userId = u.id
                 WHERE rt.token = ? AND rt.revokedAt IS NULL`
            )
            .get(refreshToken) as any;

        if (!tokenRow) {
            return NextResponse.json(
                { code: "INVALID_REFRESH_TOKEN", message: "Invalid or revoked refresh token" },
                { status: 401 }
            );
        }

        // Check expiry
        const expiresAt = new Date(tokenRow.expiresAt);
        if (expiresAt < new Date()) {
            return NextResponse.json(
                { code: "REFRESH_TOKEN_EXPIRED", message: "Refresh token has expired" },
                { status: 401 }
            );
        }

        // Parse scopes
        const scopes = tokenRow.scopes ? tokenRow.scopes.split(",").filter(Boolean) : [];

        // Generate new access token
        const accessToken = generateAccessToken({
            userId: tokenRow.userId,
            email: tokenRow.email,
            scopes,
        });

        const response: LoginResponse = {
            accessToken,
            refreshToken, // Return the same refresh token
            user: {
                id: tokenRow.userId,
                email: tokenRow.email,
                name: tokenRow.name,
                scopes,
            },
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("Refresh token error:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}
