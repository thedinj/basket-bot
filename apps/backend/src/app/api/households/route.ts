import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as householdService from "@/lib/services/householdService";
import { createHouseholdRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/households
 * List all households the current user is a member of
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
    try {
        const households = householdService.getUserHouseholds(req.auth.sub);

        return NextResponse.json({ households }, { status: 200 });
    } catch (error: any) {
        console.error("Error listing households:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to list households" },
            { status: 500 }
        );
    }
});

/**
 * POST /api/households
 * Create a new household (user becomes owner)
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
    try {
        const body = await req.json();
        const { name } = createHouseholdRequestSchema.parse(body);

        const household = householdService.createHousehold(name, req.auth.sub);

        return NextResponse.json({ household }, { status: 201 });
    } catch (error: any) {
        console.error("Error creating household:", error);

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

        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to create household" },
            { status: 500 }
        );
    }
});
