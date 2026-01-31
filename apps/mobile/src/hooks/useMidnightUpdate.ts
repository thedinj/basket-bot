import { useEffect, useState } from "react";

/**
 * Hook that triggers a state update at midnight every day.
 * Useful for recalculating date-dependent logic when the date changes.
 *
 * @param enabled - Whether to schedule midnight updates. If false, returns current date but doesn't set up timers.
 * @returns currentDate - A string representation of the current date that updates at midnight (when enabled)
 */
export const useMidnightUpdate = (enabled: boolean = true): string => {
    const [currentDate, setCurrentDate] = useState(() => new Date().toDateString());

    useEffect(() => {
        if (!enabled) return;

        const scheduleNextUpdate = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const msUntilMidnight = tomorrow.getTime() - now.getTime();

            const timeout = setTimeout(() => {
                setCurrentDate(new Date().toDateString());
                scheduleNextUpdate();
            }, msUntilMidnight);

            return timeout;
        };

        const timeout = scheduleNextUpdate();
        return () => clearTimeout(timeout);
    }, [enabled]);

    return currentDate;
};
