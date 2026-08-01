import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as householdService from "@/lib/services/householdService";
import { NextResponse } from "next/server";

/**
 * DELETE /api/households/[householdId]/members/[userId]
 * Remove a member from the household
 */
export const DELETE = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId, userId } = await context.params;
        householdService.removeMember(householdId, userId, req.auth.sub);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});
