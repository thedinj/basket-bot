import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as householdService from "@/lib/services/householdService";
import * as invitationService from "@/lib/services/invitationService";
import { createInvitationRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/households/[householdId]/members
 * Get household members
 */
export const GET = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId } = await context.params;
        const members = householdService.getHouseholdMembers(householdId, req.auth.sub);

        return NextResponse.json({ members }, { status: 200 });
    } catch (error: any) {
        console.error("Error getting members:", error);

        if (error.message?.startsWith("FORBIDDEN")) {
            return NextResponse.json(
                { code: "FORBIDDEN", message: error.message.replace("FORBIDDEN: ", "") },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to get members" },
            { status: 500 }
        );
    }
});

/**
 * POST /api/households/[householdId]/members
 * Create an invitation to join the household
 */
export const POST = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId } = await context.params;
        const body = await req.json();
        const { email } = createInvitationRequestSchema.parse(body);

        const invitation = invitationService.createInvitation(householdId, email, req.auth.sub);

        return NextResponse.json({ invitation }, { status: 201 });
    } catch (error: any) {
        console.error("Error creating invitation:", error);

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

        if (error.message?.startsWith("CONFLICT")) {
            return NextResponse.json(
                { code: "CONFLICT", message: error.message.replace("CONFLICT: ", "") },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to create invitation" },
            { status: 500 }
        );
    }
});
