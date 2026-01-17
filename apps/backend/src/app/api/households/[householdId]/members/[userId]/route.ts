import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as householdService from "@/lib/services/householdService";
import { updateMemberRoleRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * PUT /api/households/[householdId]/members/[userId]
 * Update a member's role
 */
export const PUT = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId, userId } = await context.params;
        const body = await req.json();
        const { role } = updateMemberRoleRequestSchema.parse(body);

        householdService.updateMemberRole(householdId, userId, role, req.auth.sub);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        console.error("Error updating member role:", error);

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

        if (error.message?.startsWith("FORBIDDEN")) {
            return NextResponse.json(
                { code: "FORBIDDEN", message: error.message.replace("FORBIDDEN: ", "") },
                { status: 403 }
            );
        }

        if (error.message?.startsWith("NOT_FOUND")) {
            return NextResponse.json(
                { code: "NOT_FOUND", message: error.message.replace("NOT_FOUND: ", "") },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to update member role" },
            { status: 500 }
        );
    }
});

/**
 * DELETE /api/households/[householdId]/members/[userId]
 * Remove a member from the household
 */
export const DELETE = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId, userId } = await context.params;
        householdService.removeMember(householdId, userId, req.auth.sub);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        console.error("Error removing member:", error);

        if (error.message?.startsWith("FORBIDDEN")) {
            return NextResponse.json(
                { code: "FORBIDDEN", message: error.message.replace("FORBIDDEN: ", "") },
                { status: 403 }
            );
        }

        if (error.message?.startsWith("NOT_FOUND")) {
            return NextResponse.json(
                { code: "NOT_FOUND", message: error.message.replace("NOT_FOUND: ", "") },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to remove member" },
            { status: 500 }
        );
    }
});
