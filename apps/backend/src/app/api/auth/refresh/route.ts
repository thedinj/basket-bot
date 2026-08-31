import { generateAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db/db";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import { LoginResponse, refreshTokenRequestSchema, User } from "@basket-bot/core";
import { NextRequest, NextResponse } from "next/server";

type RefreshTokenRow = Pick<User, "email" | "name"> & {
    id: string;
    userId: string;
    expiresAt: string;
    scopes: string | null;
};

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
                 WHERE rt.token = ?`
            )
            .get(refreshToken) as RefreshTokenRow | undefined;

        // Deliberately hand-rolled rather than `throw new AuthenticationError(...)`: the client
        // distinguishes a dead session from a retryable 401 by the X-Token-Status header
        // (see mobile lib/api/client.ts), and toErrorResponse has no way to attach it.
        if (!tokenRow) {
            const response = NextResponse.json(
                { code: "INVALID_REFRESH_TOKEN", message: "Invalid refresh token" },
                { status: 401 }
            );
            response.headers.set("X-Token-Status", "invalid");
            return response;
        }

        // Check expiry
        const expiresAt = new Date(tokenRow.expiresAt);
        if (expiresAt < new Date()) {
            const response = NextResponse.json(
                { code: "REFRESH_TOKEN_EXPIRED", message: "Refresh token has expired" },
                { status: 401 }
            );
            response.headers.set("X-Token-Status", "invalid");
            return response;
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
        return toErrorResponse(error, req);
    }
}
