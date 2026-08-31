import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import { changeUserPassword } from "@/lib/repos/userRepo";
import {
    ValidationError,
    changePasswordRequestSchema,
    changePasswordResponseSchema,
} from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * PATCH /api/user/password
 * Change user password
 */
async function handlePatch(req: AuthenticatedRequest) {
    try {
        const body = await req.json();
        const data = changePasswordRequestSchema.parse(body);

        const success = await changeUserPassword(
            req.auth.sub,
            data.currentPassword,
            data.newPassword
        );

        if (!success) {
            throw new ValidationError("Current password is incorrect");
        }

        const response = changePasswordResponseSchema.parse({ success: true });

        return NextResponse.json(response);
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const PATCH = withAuth(handlePatch);
