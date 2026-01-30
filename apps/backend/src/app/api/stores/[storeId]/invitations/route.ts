import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as storeInvitationService from "@/lib/services/storeInvitationService";
import { NextResponse } from "next/server";

/**
 * GET /api/stores/[storeId]/invitations
 * Get pending outgoing invitations for a store (for owners/editors)
 */
export const GET = withAuth(
    async (
        req: AuthenticatedRequest,
        { params }: { params: Promise<Record<string, string>> }
    ) => {
        try {
            const { storeId } = await params;
            const userId = req.auth.sub;

            const invitations = storeInvitationService.getStoreInvitations(storeId, userId);

            return NextResponse.json({ invitations }, { status: 200 });
        } catch (error: unknown) {
            console.error("Error getting store invitations:", error);

            if (error instanceof Error) {
                if (error.message.startsWith("NOT_FOUND:")) {
                    return NextResponse.json(
                        { code: "NOT_FOUND", message: error.message.replace("NOT_FOUND: ", "") },
                        { status: 404 }
                    );
                }
                if (error.message.startsWith("FORBIDDEN:")) {
                    return NextResponse.json(
                        {
                            code: "FORBIDDEN",
                            message: error.message.replace("FORBIDDEN: ", ""),
                        },
                        { status: 403 }
                    );
                }
            }

            return NextResponse.json(
                { code: "INTERNAL_ERROR", message: "Failed to get store invitations" },
                { status: 500 }
            );
        }
    }
);
