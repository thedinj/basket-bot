import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as notificationService from "@/lib/services/notificationService";
import { ValidationError, notificationCountsSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/notifications
 * Get notification counts for the current user
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
    try {
        const userEmail = req.auth.email;
        if (!userEmail) {
            throw new ValidationError("User email not found in token");
        }

        const counts = notificationService.getNotificationCounts(userEmail);

        // Validate response
        const validated = notificationCountsSchema.parse(counts);

        return NextResponse.json(validated, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});
