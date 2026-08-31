import { hashPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/auth/rateLimiter";
import { db } from "@/lib/db/db";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as referenceRepo from "@/lib/repos/referenceRepo";
import * as userRepo from "@/lib/repos/userRepo";
import * as storeService from "@/lib/services/storeService";
import { ConflictError, createUserRequestSchema } from "@basket-bot/core";
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
        const { email, name, password, invitationCode } = createUserRequestSchema.parse(body);

        // Check invitation code if required.
        // These two responses stay hand-rolled deliberately: Register.tsx keys off the exact
        // `INVITATION_CODE_REQUIRED` / `INVALID_INVITATION_CODE` codes to show inline field
        // errors, and ValidationError would rewrite both to VALIDATION_FAILED (and 400 -> 422).
        const setting = referenceRepo.getAppSetting("REGISTRATION_INVITATION_CODE");
        const requiredInvitationCode = setting?.value || "";
        if (requiredInvitationCode && requiredInvitationCode.trim().length > 0) {
            if (!invitationCode) {
                return NextResponse.json(
                    {
                        code: "INVITATION_CODE_REQUIRED",
                        message: "Registration requires an invitation code",
                    },
                    { status: 400 }
                );
            }

            const providedCode = invitationCode.trim().toLowerCase();
            const expectedCode = requiredInvitationCode.trim().toLowerCase();

            if (providedCode !== expectedCode) {
                return NextResponse.json(
                    {
                        code: "INVALID_INVITATION_CODE",
                        message: "Invalid invitation code",
                    },
                    { status: 400 }
                );
            }
        }

        // Store the address lowercased. The duplicate check below and the sign-in lookup are both
        // case-insensitive, so persisting the raw casing bought nothing and left rows that only
        // a case-insensitive query could find.
        const normalizedEmail = email.toLowerCase();

        // Check if user exists (case-insensitive, matching the login lookup so
        // "Alice@x.com" and "alice@x.com" cannot both register)
        const existingUser = userRepo.getUserByEmail(normalizedEmail);
        if (existingUser) {
            throw new ConflictError("User with this email already exists");
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const userId = randomUUID();
        const now = new Date().toISOString();
        db.prepare(
            `
            INSERT INTO User (id, email, name, password, scopes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        ).run(userId, normalizedEmail, name, hashedPassword, "", now, now);

        // Create default example store for new user
        storeService.createDefaultStoreForNewUser(userId, name);

        return NextResponse.json(
            {
                id: userId,
                email: normalizedEmail,
                name,
                scopes: [],
            },
            { status: 201 }
        );
    } catch (error) {
        return toErrorResponse(error, req);
    }
}
