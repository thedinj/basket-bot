import type {
    NotificationCounts,
    StoreCollaboratorDetail,
    StoreCollaboratorRole,
    StoreInvitationDetail,
} from "@basket-bot/core";
import { apiClient } from "./client";

/**
 * API methods for store invitations and collaborators
 */

// ========== Notifications ==========

export async function getNotificationCounts(): Promise<NotificationCounts> {
    return apiClient.get<NotificationCounts>("/api/notifications");
}

// ========== Store Invitations ==========

export async function getStoreInvitations(): Promise<StoreInvitationDetail[]> {
    const response = await apiClient.get<{ invitations: StoreInvitationDetail[] }>(
        "/api/stores/invitations"
    );
    return response.invitations;
}

export async function acceptStoreInvitation(token: string): Promise<void> {
    await apiClient.post(`/api/stores/invitations/${token}/accept`, {});
}

export async function declineStoreInvitation(token: string): Promise<void> {
    await apiClient.post(`/api/stores/invitations/${token}/decline`, {});
}

// ========== Store Collaborators ==========

export async function getStoreCollaborators(storeId: string): Promise<StoreCollaboratorDetail[]> {
    const response = await apiClient.get<{ collaborators: StoreCollaboratorDetail[] }>(
        `/api/stores/${storeId}/collaborators`
    );
    return response.collaborators;
}

export async function inviteStoreCollaborator(
    storeId: string,
    email: string,
    role: StoreCollaboratorRole
): Promise<void> {
    await apiClient.post(`/api/stores/${storeId}/collaborators`, { email, role });
}

export async function updateStoreCollaboratorRole(
    storeId: string,
    collaboratorUserId: string,
    role: StoreCollaboratorRole
): Promise<void> {
    await apiClient.patch(`/api/stores/${storeId}/collaborators/${collaboratorUserId}`, { role });
}

export async function removeStoreCollaborator(
    storeId: string,
    collaboratorUserId: string
): Promise<void> {
    await apiClient.delete(`/api/stores/${storeId}/collaborators/${collaboratorUserId}`);
}
