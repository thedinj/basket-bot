import type { Household } from "@basket-bot/core";
import { PropsWithChildren, useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { useDatabase } from "../db/hooks";
import { usePreference } from "../hooks/usePreference";
import { householdApi, invitationApi } from "../lib/api/household";
import { HouseholdContext } from "./HouseholdContext";

const ACTIVE_HOUSEHOLD_KEY = "activeHouseholdId";

export const HouseholdProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const database = useDatabase();
    const [households, setHouseholds] = useState<Household[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);
    const { value: activeHouseholdId, savePreference: saveActiveHouseholdId } =
        usePreference(ACTIVE_HOUSEHOLD_KEY);

    const activeHousehold = households.find((h) => h.id === activeHouseholdId) || null;

    const loadHouseholds = useCallback(async () => {
        if (!isAuthenticated) {
            setHouseholds([]);
            setIsLoading(false);
            return;
        }

        try {
            const [userHouseholds, invitations] = await Promise.all([
                householdApi.getUserHouseholds(),
                invitationApi.getUserPendingInvitations(),
            ]);

            setHouseholds(userHouseholds);
            setPendingInvitationsCount(invitations.length);

            // If no active household is set, or the active household doesn't exist, set the first one
            if (userHouseholds.length > 0) {
                const currentActiveExists = userHouseholds.some((h) => h.id === activeHouseholdId);
                if (!activeHouseholdId || !currentActiveExists) {
                    await saveActiveHouseholdId(userHouseholds[0].id);
                }
            } else {
                // No households available
                await saveActiveHouseholdId(null);
            }
        } catch (error) {
            console.error("Error loading households:", error);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, activeHouseholdId, saveActiveHouseholdId]);

    const setActiveHouseholdId = useCallback(
        async (householdId: string) => {
            await saveActiveHouseholdId(householdId);
            // RemoteDatabase tracks household from the context state automatically
        },
        [saveActiveHouseholdId]
    );

    const refreshHouseholds = useCallback(async () => {
        await loadHouseholds();
    }, [loadHouseholds]);

    // Load households on mount and when auth changes
    useEffect(() => {
        loadHouseholds();
    }, [loadHouseholds]);

    // Sync active household with RemoteDatabase whenever it changes
    useEffect(() => {
        if (activeHouseholdId && "setActiveHouseholdId" in database) {
            (database as any).setActiveHouseholdId(activeHouseholdId);
        }
    }, [activeHouseholdId, database]);

    const value = {
        households,
        activeHousehold,
        activeHouseholdId: activeHouseholdId ?? null,
        isLoading,
        setActiveHouseholdId,
        refreshHouseholds,
        pendingInvitationsCount,
    };

    return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
};
