import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { changeUserPassword } from "@/lib/repos/userRepo";
import { changePasswordRequestSchema, changePasswordResponseSchema } from "@basket-bot/core";
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
            return NextResponse.json(
                {
                    code: "INVALID_PASSWORD",
                    message: "Current password is incorrect",
                },
                { status: 400 }
            );
        }

        const response = changePasswordResponseSchema.parse({ success: true });

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
        console.error("Change password error:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}

export const PATCH = withAuth(handlePatch);
