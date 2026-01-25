import { createContext } from "react";

export interface ShieldContextValue {
    activeShieldIds: Set<string>;
    raiseShield: (id: string, message?: string) => void;
    lowerShield: (id: string) => void;
    currentMessage: string | undefined;
}

export const ShieldContext = createContext<ShieldContextValue | undefined>(
    undefined
);
