import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as storeInvitationService from "@/lib/services/storeInvitationService";
import * as storeRepo from "@/lib/repos/storeRepo";
import { createStoreInvitationRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/stores/[storeId]/collaborators
 * Get all collaborators for a store
 */
export const GET = withAuth(
    async (req: AuthenticatedRequest, { params }: { params: Promise<Record<string, string>> }) => {
        try {
            const { storeId } = await params;
            const userId = req.auth.sub;

            // Verify user has access to this store
            if (!storeRepo.userHasAccessToStore(userId, storeId)) {
                return NextResponse.json(
                    { code: "FORBIDDEN", message: "You do not have access to this store" },
                    { status: 403 }
                );
            }

            const collaborators = storeRepo.getStoreCollaborators(storeId);

            return NextResponse.json({ collaborators }, { status: 200 });
        } catch (error: any) {
            console.error("Error getting store collaborators:", error);
            return NextResponse.json(
                { code: "INTERNAL_ERROR", message: "Failed to get collaborators" },
                { status: 500 }
            );
        }
    }
);

/**
 * POST /api/stores/[storeId]/collaborators
 * Invite a new collaborator to a store
 */
export const POST = withAuth(
    async (req: AuthenticatedRequest, { params }: { params: Promise<Record<string, string>> }) => {
        try {
            const { storeId } = await params;
            const userId = req.auth.sub;
            const body = await req.json();

            // Validate request body
            const { email, role } = createStoreInvitationRequestSchema.parse(body);

            const invitation = storeInvitationService.createStoreInvitation(
                storeId,
                email,
                role,
                userId
            );

            return NextResponse.json({ invitation }, { status: 201 });
        } catch (error: any) {
            console.error("Error creating store invitation:", error);

            if (error.name === "ZodError") {
                return NextResponse.json(
                    { code: "VALIDATION_ERROR", message: "Invalid request data", details: error.errors },
                    { status: 400 }
                );
            }

            if (error.message.includes("NOT_FOUND")) {
                return NextResponse.json(
                    { code: "NOT_FOUND", message: "Store not found" },
                    { status: 404 }
                );
            }

            if (error.message.includes("FORBIDDEN")) {
                return NextResponse.json(
                    { code: "FORBIDDEN", message: error.message.replace("FORBIDDEN: ", "") },
                    { status: 403 }
                );
            }

            if (error.message.includes("CONFLICT")) {
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
    }
);
