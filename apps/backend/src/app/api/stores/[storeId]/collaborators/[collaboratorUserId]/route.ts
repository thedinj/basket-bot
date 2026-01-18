import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as storeRepo from "@/lib/repos/storeRepo";
import { updateStoreCollaboratorRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * PATCH /api/stores/[storeId]/collaborators/[collaboratorUserId]
 * Update a collaborator's role (owner only)
 */
export const PATCH = withAuth(
    async (
        req: AuthenticatedRequest,
        { params }: { params: Promise<Record<string, string>> }
    ) => {
        try {
            const { storeId, collaboratorUserId } = await params;
            const userId = req.auth.sub;
            const body = await req.json();

            // Validate request body
            const { role } = updateStoreCollaboratorRequestSchema.parse(body);

            // Only owners can change roles
            if (!storeRepo.userIsStoreOwner(userId, storeId)) {
                return NextResponse.json(
                    { code: "FORBIDDEN", message: "Only store owners can change roles" },
                    { status: 403 }
                );
            }

            // Cannot change your own role
            if (userId === collaboratorUserId) {
                return NextResponse.json(
                    { code: "FORBIDDEN", message: "You cannot change your own role" },
                    { status: 403 }
                );
            }

            // If changing from owner to editor, check that there will still be at least one owner
            const currentRole = storeRepo.getUserStoreRole(collaboratorUserId, storeId);
            if (currentRole === "owner" && role === "editor") {
                const ownerCount = storeRepo.countStoreOwners(storeId);
                if (ownerCount <= 1) {
                    return NextResponse.json(
                        {
                            code: "CONFLICT",
                            message: "Cannot remove the last owner. Promote another collaborator to owner first.",
                        },
                        { status: 409 }
                    );
                }
            }

            const updated = storeRepo.updateStoreCollaboratorRole({
                storeId,
                userId: collaboratorUserId,
                role,
            });

            if (!updated) {
                return NextResponse.json(
                    { code: "NOT_FOUND", message: "Collaborator not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({ message: "Role updated successfully" }, { status: 200 });
        } catch (error: any) {
            console.error("Error updating collaborator role:", error);

            if (error.name === "ZodError") {
                return NextResponse.json(
                    { code: "VALIDATION_ERROR", message: "Invalid request data", details: error.errors },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                { code: "INTERNAL_ERROR", message: "Failed to update role" },
                { status: 500 }
            );
        }
    }
);

/**
 * DELETE /api/stores/[storeId]/collaborators/[collaboratorUserId]
 * Remove a collaborator from a store (owner only)
 */
export const DELETE = withAuth(
    async (
        req: AuthenticatedRequest,
        { params }: { params: Promise<Record<string, string>> }
    ) => {
        try {
            const { storeId, collaboratorUserId } = await params;
            const userId = req.auth.sub;

            // Only owners can remove collaborators
            if (!storeRepo.userIsStoreOwner(userId, storeId)) {
                return NextResponse.json(
                    { code: "FORBIDDEN", message: "Only store owners can remove collaborators" },
                    { status: 403 }
                );
            }

            // Cannot remove yourself
            if (userId === collaboratorUserId) {
                return NextResponse.json(
                    { code: "FORBIDDEN", message: "You cannot remove yourself. Transfer ownership or delete the store instead." },
                    { status: 403 }
                );
            }

            // If removing an owner, check that there will still be at least one owner
            const collaboratorRole = storeRepo.getUserStoreRole(collaboratorUserId, storeId);
            if (collaboratorRole === "owner") {
                const ownerCount = storeRepo.countStoreOwners(storeId);
                if (ownerCount <= 1) {
                    return NextResponse.json(
                        {
                            code: "CONFLICT",
                            message: "Cannot remove the last owner. Promote another collaborator to owner first.",
                        },
                        { status: 409 }
                    );
                }
            }

            const removed = storeRepo.removeStoreCollaborator(storeId, collaboratorUserId);

            if (!removed) {
                return NextResponse.json(
                    { code: "NOT_FOUND", message: "Collaborator not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({ message: "Collaborator removed successfully" }, { status: 200 });
        } catch (error: any) {
            console.error("Error removing collaborator:", error);
            return NextResponse.json(
                { code: "INTERNAL_ERROR", message: "Failed to remove collaborator" },
                { status: 500 }
            );
        }
    }
);
