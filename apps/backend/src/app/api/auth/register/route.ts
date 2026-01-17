import { hashPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/auth/rateLimiter";
import { db } from "@/lib/db/db";
import * as storeService from "@/lib/services/storeService";
import { createUserRequestSchema } from "@basket-bot/core";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    // Rate limit: 3 attempts per hour
    const rateLimitResponse = await checkRateLimit(req, 3, 60 * 60 * 1000);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const body = await req.json();
        const { email, name, password } = createUserRequestSchema.parse(body);

        // Check if user exists
        const existingUser = db.prepare("SELECT * FROM User WHERE email = ?").get(email) as any;
        if (existingUser) {
            return NextResponse.json(
                { code: "CONFLICT", message: "User with this email already exists" },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const userId = randomUUID();
        db.prepare(
            `
            INSERT INTO User (id, email, name, password, scopes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `
        ).run(userId, email, name, hashedPassword, "");

        // Create default example store for new user
        storeService.createDefaultStoreForNewUser(userId);

        return NextResponse.json(
            {
                id: userId,
                email,
                name,
                scopes: [],
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}
