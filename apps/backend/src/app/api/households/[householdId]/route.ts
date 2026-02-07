import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as householdService from "@/lib/services/householdService";
import { updateHouseholdRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/households/[householdId]
 * Get household details with members
 */
export const GET = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId } = await context.params;
        const household = householdService.getHouseholdWithMembers(householdId, req.auth.sub);

        return NextResponse.json({ household }, { status: 200 });
    } catch (error: any) {
        console.error("Error getting household:", error);

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
            { code: "INTERNAL_ERROR", message: "Failed to get household" },
            { status: 500 }
        );
    }
});

/**
 * PUT /api/households/[householdId]
 * Update household name (requires membership)
 */
export const PUT = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId } = await context.params;
        const body = await req.json();
        const { name } = updateHouseholdRequestSchema.parse(body);

        if (!name) {
            return NextResponse.json(
                { code: "VALIDATION_ERROR", message: "Name is required" },
                { status: 400 }
            );
        }

        const household = householdService.updateHousehold(householdId, name, req.auth.sub);

        return NextResponse.json({ household }, { status: 200 });
    } catch (error: any) {
        console.error("Error updating household:", error);

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
            { code: "INTERNAL_ERROR", message: "Failed to update household" },
            { status: 500 }
        );
    }
});

/**
 * DELETE /api/households/[householdId]
 * Delete a household (requires membership)
 */
export const DELETE = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId } = await context.params;
        householdService.deleteHousehold(householdId, req.auth.sub);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        console.error("Error deleting household:", error);

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
            { code: "INTERNAL_ERROR", message: "Failed to delete household" },
            { status: 500 }
        );
    }
});
