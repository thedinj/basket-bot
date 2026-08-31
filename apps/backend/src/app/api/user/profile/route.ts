import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import { updateUserProfile } from "@/lib/repos/userRepo";
import {
    NotFoundError,
    updateProfileRequestSchema,
    updateProfileResponseSchema,
} from "@basket-bot/core";
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
            throw new NotFoundError("User not found");
        }

        // Validate response matches schema
        const response = updateProfileResponseSchema.parse(updatedUser);

        return NextResponse.json(response);
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const PATCH = withAuth(handlePatch);
