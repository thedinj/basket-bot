import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as notificationService from "@/lib/services/notificationService";
import { notificationCountsSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/notifications
 * Get notification counts for the current user
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
    try {
        const userEmail = req.auth.email;
        if (!userEmail) {
            return NextResponse.json(
                { code: "BAD_REQUEST", message: "User email not found in token" },
                { status: 400 }
            );
        }

        const counts = notificationService.getNotificationCounts(userEmail);
        
        // Validate response
        const validated = notificationCountsSchema.parse(counts);

        return NextResponse.json(validated, { status: 200 });
    } catch (error: any) {
        console.error("Error getting notification counts:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to get notification counts" },
            { status: 500 }
        );
    }
});
