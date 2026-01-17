import type { Household } from "@basket-bot/core";
import { createContext } from "react";

export interface HouseholdContextType {
    households: Household[];
    activeHousehold: Household | null;
    activeHouseholdId: string | null;
    isLoading: boolean;
    setActiveHouseholdId: (householdId: string) => void;
    refreshHouseholds: () => Promise<void>;
    pendingInvitationsCount: number;
}

export const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);
