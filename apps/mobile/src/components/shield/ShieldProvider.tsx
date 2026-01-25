import type React from "react";
import { useCallback, useMemo, useState, type PropsWithChildren } from "react";
import { Shield } from "./Shield.tsx";
import { ShieldContext } from "./ShieldContext";

export const ShieldProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const [activeShieldIds, setActiveShieldIds] = useState<Set<string>>(new Set());
    const [messageMap, setMessageMap] = useState<Map<string, string>>(new Map());

    const raiseShield = useCallback((id: string, message?: string) => {
        setActiveShieldIds((prev) => new Set(prev).add(id));
        if (message) {
            setMessageMap((prev) => new Map(prev).set(id, message));
        }
    }, []);

    const lowerShield = useCallback((id: string) => {
        setActiveShieldIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        setMessageMap((prev) => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    // Get the most recently added message (last one in the map)
    const currentMessage = useMemo(() => {
        const messages = Array.from(messageMap.values());
        return messages[messages.length - 1];
    }, [messageMap]);

    const value = useMemo(
        () => ({
            activeShieldIds,
            raiseShield,
            lowerShield,
            currentMessage,
        }),
        [activeShieldIds, currentMessage, raiseShield, lowerShield]
    );

    return (
        <ShieldContext.Provider value={value}>
            {children}
            <Shield />
        </ShieldContext.Provider>
    );
};

export default ShieldProvider;
