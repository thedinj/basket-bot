import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { updateUserProfile } from "@/lib/repos/userRepo";
import { updateProfileRequestSchema, updateProfileResponseSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * PATCH /api/user/profile
 * Update user profile (name only)
 */
async function handlePatch(req: AuthenticatedRequest) {
    try {
        const body = await req.json();
        const data = updateProfileRequestSchema.parse(body);

        const updatedUser = updateUserProfile(req.auth.sub, data.name);

        if (!updatedUser) {
            return NextResponse.json(
                { code: "USER_NOT_FOUND", message: "User not found" },
                { status: 404 }
            );
        }

        // Validate response matches schema
        const response = updateProfileResponseSchema.parse(updatedUser);

        return NextResponse.json(response);
    } catch (error: any) {
        if (error.name === "ZodError") {
            return NextResponse.json(
                {
                    code: "VALIDATION_ERROR",
                    message: "Invalid request data",
                    details: error.errors,
                },
                { status: 400 }
            );
        }
        console.error("Update profile error:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}

export const PATCH = withAuth(handlePatch);
