import { NextRequest, NextResponse } from "next/server";
import { loginRequestSchema, LoginResponse } from "@basket-bot/core";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password } = loginRequestSchema.parse(body);

        // Find user
        const user = await prisma.user.findUnique({ where: { email } });
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
        await prisma.refreshToken.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt: getRefreshTokenExpiry(),
            },
        });

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
